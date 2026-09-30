// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Math} from "@openzeppelin/contracts/utils/math/Math.sol";

/// @title P256 — secp256r1 (P-256 / prime256v1) ECDSA 验签
/// @notice 双路径设计，按优先级：
///         1. RIP-7212 预编译（地址 0x100）：运行时用一组「已知合法向量」探测，可用则使用；
///         2. 纯 Solidity 回退实现（Jacobian 坐标 + mulmod/addmod + OZ `Math.invMod`）。
///
///         2026-09-30 在 Monad 测试网实测：
///         - 0x100 无代码（RIP-7212 未部署）；
///         - 0x05 modexp 返回非标准结果（应 32 字节、实际 416 字节零），不可依赖；
///         - 0x02 sha256 正常。
///         因此在 Monad 上，本文件的第 2 条路径是「主路径」而非兜底。
///         纯 Solidity 实现不依赖任何非标准预编译，NIST 测试向量 + 随机向量在
///         test/P256.t.sol 中全量回归。
/// @dev 参考 FreshCryptoLib（FCL）的算法结构，但为可审计性采用无汇编的直观写法。
library P256 {
    // ------------------------------------------------------------------ //
    //                             曲线常量                                //
    // ------------------------------------------------------------------ //

    /// @notice P-256 素域 p = 2^256 - 2^224 + 2^192 + 2^96 - 1
    uint256 internal constant PP = 0xFFFFFFFF00000001000000000000000000000000FFFFFFFFFFFFFFFFFFFFFFFF;
    /// @notice 曲线阶 n
    uint256 internal constant NN = 0xFFFFFFFF00000000FFFFFFFFFFFFFFFFBCE6FAADA7179E84F3B9CAC2FC632551;
    /// @notice 曲线系数 a = -3（mod p）
    uint256 internal constant AA = PP - 3;
    /// @notice 曲线系数 b
    uint256 internal constant BB = 0x5AC635D8AA3A93E7B3EBBD55769886BC651D06B0CC53B0F63BCE3C3E27D2604B;
    /// @notice 生成元 G 的 x 坐标
    uint256 internal constant GX = 0x6B17D1F2E12C4247F8BCE6E563A440F277037D812DEB33A0F4A13945D898C296;
    /// @notice 生成元 G 的 y 坐标
    uint256 internal constant GY = 0x4FE342E2FE1A7F9B8EE7EB4A7C0F9E162BCE33576B315ECECBB6406837BF51F5;

    // ------------------------------------------------------------------ //
    //                    RIP-7212 预编译探测向量                          //
    // ------------------------------------------------------------------ //

    // 由 contracts/test/fixtures/generate.mjs 生成：
    //   sha256("rip7212-detect") 下对一对 P-256 密钥的有效签名。
    // 用于判断链上 0x100 是否实现了 RIP-7212 的 P256VERIFY 预编译。
    // （静态调用无代码地址会「成功但返回空」，故必须用「已知合法向量返回 1」来判定。）
    bytes32 private constant PROBE_HASH = 0x6e04a7ec0db56113652194af2442c2a1652dc5f43368d8245346e1763da1c8c2;
    uint256 private constant PROBE_X = 0xa427f6707229aca07918ba3a1d30c5932da371cc472074df21d5cdf554610821;
    uint256 private constant PROBE_Y = 0x666d4ab781711bfb4f60d00b305856ee13948637f25567952adba99c0e036233;
    uint256 private constant PROBE_R = 0x45b6a6136b22e57458d8b8be95649ab0088b7b05f296910a692cc19b9961e52c;
    uint256 private constant PROBE_S = 0xd34cb7bf2c50b6ff10783cd4e476eeb157d3589c5d5d313a09164569a5fbdee9;

    // ------------------------------------------------------------------ //
    //                             对外接口                                //
    // ------------------------------------------------------------------ //

    /// @notice 校验一对坐标是否为曲线上的点（排除 (0,0)）。
    function onCurve(uint256 x, uint256 y) internal pure returns (bool) {
        if (x == 0 || x >= PP || y == 0 || y >= PP) return false;
        uint256 lhs = mulmod(y, y, PP);
        uint256 rhs = addmod(addmod(mulmod(mulmod(x, x, PP), x, PP), mulmod(AA, x, PP), PP), BB, PP);
        return lhs == rhs;
    }

    /// @notice 探测链上是否存在 RIP-7212 预编译（0x100）。
    /// @dev 用已知合法向量判定：预编译存在且按规范实现 → 返回 32 字节的 1。
    ///      无代码地址的 staticcall 会成功但 returndatasize 为 0，因此探测可靠。
    function precompileAvailable() internal view returns (bool) {
        return _verifyPrecompile(PROBE_HASH, PROBE_R, PROBE_S, PROBE_X, PROBE_Y);
    }

    /// @notice P-256 ECDSA 验签（自动选择预编译或纯 Solidity 路径）。
    /// @param messageHash 已是 32 字节消息哈希（WebAuthn 中为 sha256 的结果）。
    function verify(bytes32 messageHash, uint256 r, uint256 s, uint256 x, uint256 y) internal view returns (bool) {
        if (!_validParams(r, s, x, y)) return false;
        if (precompileAvailable()) {
            return _verifyPrecompile(messageHash, r, s, x, y);
        }
        return verifySolidity(messageHash, r, s, x, y);
    }

    /// @notice 纯 Solidity 验签路径（不依赖任何预编译；sha256 由 EVM 原生编译为 0x02 预编译）。
    function verifySolidity(bytes32 messageHash, uint256 r, uint256 s, uint256 x, uint256 y)
        internal
        pure
        returns (bool)
    {
        // w = s^-1 mod n（s ∈ [1, n-1] 且 n 为素数，必可逆）
        uint256 w = Math.invMod(s, NN);
        if (w == 0) return false;

        // u1 = e·w mod n，u2 = r·w mod n；e 直接取哈希整数（哈希位长 = n 位长）
        uint256 e = uint256(messageHash);
        uint256 u1 = mulmod(e, w, NN);
        uint256 u2 = mulmod(r, w, NN);

        // R = u1·G + u2·Q
        (uint256 gX, uint256 gY, uint256 gZ) = _jacMul(u1, GX, GY);
        (uint256 qX, uint256 qY, uint256 qZ) = _jacMul(u2, x, y);
        (uint256 a1x, uint256 a1y, bool ok1) = _jacToAffine(gX, gY, gZ);
        (uint256 a2x, uint256 a2y, bool ok2) = _jacToAffine(qX, qY, qZ);
        (uint256 rx,) = _affineAdd(a1x, a1y, ok1, a2x, a2y, ok2);
        if (rx == 0) return false; // R 为无穷远点或 x=0（P-256 上无 x=0 点，双保险）

        // 有效 ⇔ R.x ≡ r (mod n)
        return rx % NN == r;
    }

    // ------------------------------------------------------------------ //
    //                        预编译路径（0x100）                          //
    // ------------------------------------------------------------------ //

    /// @notice 调用 RIP-7212 P256VERIFY 预编译。输入为 160 字节：r‖s‖hash‖x‖y。
    function _verifyPrecompile(bytes32 messageHash, uint256 r, uint256 s, uint256 x, uint256 y)
        private
        view
        returns (bool ok)
    {
        assembly {
            let ptr := mload(0x40)
            mstore(ptr, r)
            mstore(add(ptr, 0x20), s)
            mstore(add(ptr, 0x40), messageHash)
            mstore(add(ptr, 0x60), x)
            mstore(add(ptr, 0x80), y)
            // staticcall(gas, 0x100, in=ptr, insize=160, out=ptr, outsize=32)
            if staticcall(gas(), 0x100, ptr, 0xa0, ptr, 0x20) {
                // 预编译规范返回 32 字节；无代码地址返回空 → 用 returndatasize 区分
                if eq(returndatasize(), 0x20) { ok := eq(mload(ptr), 1) }
            }
        }
    }

    function _validParams(uint256 r, uint256 s, uint256 x, uint256 y) private pure returns (bool) {
        if (r == 0 || r >= NN) return false;
        if (s == 0 || s >= NN) return false;
        return onCurve(x, y);
    }

    // ------------------------------------------------------------------ //
    //                    Jacobian 点运算（a = -3）                        //
    // ------------------------------------------------------------------ //

    /// @dev MSB 优先的倍点-加点标量乘：R = k·P（P 仿射输入）。
    function _jacMul(uint256 k, uint256 px, uint256 py) private pure returns (uint256 X, uint256 Y, uint256 Z) {
        X = 0;
        Y = 1;
        Z = 0; // 无穷远点的 Jacobian 表示
        for (int256 i = 255; i >= 0; i--) {
            (X, Y, Z) = _jacDouble(X, Y, Z);
            if ((k >> uint256(i)) & 1 == 1) {
                (X, Y, Z) = _jacAdd(X, Y, Z, px, py, 1);
            }
        }
    }

    /// @dev Jacobian 倍点（a = -3 优化公式）。
    function _jacDouble(uint256 X, uint256 Y, uint256 Z) private pure returns (uint256 X3, uint256 Y3, uint256 Z3) {
        if (Z == 0 || Y == 0) {
            return (0, 1, 0);
        }
        uint256 a = mulmod(X, X, PP);
        uint256 b = mulmod(Y, Y, PP);
        uint256 c = mulmod(b, b, PP);
        uint256 t = addmod(X, b, PP);
        // D = 2·((X + B)² − A − C)
        uint256 d = mulmod(addmod(addmod(mulmod(t, t, PP), PP - a, PP), PP - c, PP), 2, PP);
        // E = 3A − 3Z⁴
        uint256 zz = mulmod(Z, Z, PP);
        uint256 z4 = mulmod(zz, zz, PP);
        uint256 e = addmod(addmod(a, addmod(a, a, PP), PP), PP - addmod(z4, addmod(z4, z4, PP), PP), PP);
        uint256 f = mulmod(e, e, PP);
        X3 = addmod(f, PP - mulmod(2, d, PP), PP); // F − 2D
        Y3 = addmod(mulmod(e, addmod(d, PP - X3, PP), PP), PP - mulmod(8, c, PP), PP); // E·(D − X3) − 8C
        Z3 = mulmod(mulmod(2, Y, PP), Z, PP); // 2YZ
    }

    /// @dev Jacobian 加点，正确处理无穷远点与 P = Q / P = −Q 的退化情形。
    function _jacAdd(uint256 X1, uint256 Y1, uint256 Z1, uint256 X2, uint256 Y2, uint256 Z2)
        private
        pure
        returns (uint256 X3, uint256 Y3, uint256 Z3)
    {
        if (Z1 == 0) return (X2, Y2, Z2);
        if (Z2 == 0) return (X1, Y1, Z1);
        uint256 z1z1 = mulmod(Z1, Z1, PP);
        uint256 z2z2 = mulmod(Z2, Z2, PP);
        uint256 u1 = mulmod(X1, z2z2, PP);
        uint256 u2 = mulmod(X2, z1z1, PP);
        uint256 s1 = mulmod(mulmod(Y1, Z2, PP), z2z2, PP);
        uint256 s2 = mulmod(mulmod(Y2, Z1, PP), z1z1, PP);
        if (u1 == u2) {
            if (s1 != s2) return (0, 1, 0); // P + (−P) = ∞
            return _jacDouble(X1, Y1, Z1);
        }
        uint256 h = addmod(u2, PP - u1, PP);
        uint256 rr = addmod(s2, PP - s1, PP);
        uint256 hh = mulmod(h, h, PP);
        uint256 hhh = mulmod(h, hh, PP);
        uint256 v = mulmod(u1, hh, PP);
        X3 = addmod(addmod(mulmod(rr, rr, PP), PP - hhh, PP), PP - mulmod(2, v, PP), PP);
        Y3 = addmod(mulmod(rr, addmod(v, PP - X3, PP), PP), PP - mulmod(s1, hhh, PP), PP);
        Z3 = mulmod(mulmod(Z1, Z2, PP), h, PP);
    }

    /// @dev Jacobian → 仿射；Z = 0 表示无穷远点，以 ok = false 标记。
    function _jacToAffine(uint256 X, uint256 Y, uint256 Z) private pure returns (uint256 ax, uint256 ay, bool ok) {
        if (Z == 0) return (0, 0, false);
        uint256 zInv = Math.invMod(Z, PP);
        uint256 zInv2 = mulmod(zInv, zInv, PP);
        return (mulmod(X, zInv2, PP), mulmod(Y, mulmod(zInv2, zInv, PP), PP), true);
    }

    /// @dev 仿射加点；任一输入为无穷远点（ok=false）时透传另一个。
    function _affineAdd(uint256 x1, uint256 y1, bool ok1, uint256 x2, uint256 y2, bool ok2)
        private
        pure
        returns (uint256 x3, uint256 y3)
    {
        if (!ok1) return (x2, y2);
        if (!ok2) return (x1, y1);
        if (x1 == x2) {
            if (addmod(y1, y2, PP) == 0) return (0, 0); // P + (−P) = ∞
            // P = Q → 倍点：λ = (3x² + a) / (2y)
            uint256 lam =
                mulmod(addmod(mulmod(3, mulmod(x1, x1, PP), PP), AA, PP), Math.invMod(mulmod(2, y1, PP), PP), PP);
            x3 = addmod(addmod(mulmod(lam, lam, PP), PP - x1, PP), PP - x1, PP);
            y3 = addmod(mulmod(lam, addmod(x1, PP - x3, PP), PP), PP - y1, PP);
            return (x3, y3);
        }
        // λ = (y2 − y1) / (x2 − x1)
        uint256 lamAdd = mulmod(addmod(y2, PP - y1, PP), Math.invMod(addmod(x2, PP - x1, PP), PP), PP);
        x3 = addmod(addmod(mulmod(lamAdd, lamAdd, PP), PP - x1, PP), PP - x2, PP);
        y3 = addmod(mulmod(lamAdd, addmod(x1, PP - x3, PP), PP), PP - y1, PP);
    }
}
