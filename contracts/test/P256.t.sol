// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {P256} from "../src/lib/P256.sol";
import {Fixtures} from "./utils/Fixtures.t.sol";

/// @dev RIP-7212 P256VERIFY 预编译地址。
address constant P256VERIFY = address(0x100);

/// @title P256Test — P-256 验签库回归
/// @notice 覆盖：随机向量回归（纯 Solidity 路径）、参数校验、0x100 预编译探测与自动选路。
contract P256Test is Fixtures {
    function _vector(uint256 i) internal view returns (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) {
        string memory base = string.concat(".p256vectors[", vm.toString(i), "]");
        h = _fxBytes32(string.concat(base, ".hash"));
        x = _fxUint(string.concat(base, ".x"));
        y = _fxUint(string.concat(base, ".y"));
        r = _fxUint(string.concat(base, ".r"));
        s = _fxUint(string.concat(base, ".s"));
    }

    // ------------------------------- onCurve ------------------------------ //

    function test_OnCurve_GeneratorOnCurve() public pure {
        assertTrue(P256.onCurve(P256.GX, P256.GY));
    }

    function test_OnCurve_RejectsJunk() public pure {
        assertFalse(P256.onCurve(1, 1));
        assertFalse(P256.onCurve(0, 0));
        assertFalse(P256.onCurve(0, P256.GY));
        assertFalse(P256.onCurve(P256.PP, P256.GY));
        assertFalse(P256.onCurve(P256.GX, 0));
        assertFalse(P256.onCurve(P256.GX, P256.PP));
    }

    // --------------------------- verifySolidity --------------------------- //

    function test_VerifySolidity_AllRandomVectors() public view {
        for (uint256 i = 0; i < 8; i++) {
            (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(i);
            assertTrue(P256.verifySolidity(h, r, s, x, y), "random vector must verify");
        }
    }

    function test_VerifySolidity_TamperedSignatureFails() public view {
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        assertFalse(P256.verifySolidity(h, r + 1, s, x, y));
        assertFalse(P256.verifySolidity(h, r, s + 1, x, y));
        assertFalse(P256.verifySolidity(h, r, s, x, y + 1)); // 离曲线公钥
    }

    function test_Verify_InvalidParams() public view {
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        assertFalse(P256.verify(h, 0, s, x, y));
        assertFalse(P256.verify(h, r, 0, x, y));
        assertFalse(P256.verify(h, r, s, 0, y));
        assertFalse(P256.verify(h, r, s, x, 0));
    }

    // ------------------------------ 自动选路 ------------------------------ //

    function test_Verify_NoPrecompile_UsesSolidityPath() public view {
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        assertFalse(P256.precompileAvailable(), "local EVM has no 0x100");
        assertTrue(P256.verify(h, r, s, x, y));
        assertFalse(P256.verify(h, r + 1, s, x, y));
    }

    function test_Precompile_MockTrue_RoutesToPrecompile() public {
        // mock：任何输入都返回 32 字节的 1
        vm.etch(P256VERIFY, hex"600160005260206000f3");
        assertTrue(P256.precompileAvailable());
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        // 垃圾签名也通过 —— 证明走的是 0x100 而非 Solidity 路径
        assertTrue(P256.verify(h, r + 1, s, x, y));
    }

    function test_Precompile_MockFalse_FallsBackToSolidity() public {
        vm.etch(P256VERIFY, hex"600060005260206000f3");
        assertFalse(P256.precompileAvailable());
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        assertTrue(P256.verify(h, r, s, x, y));
        assertFalse(P256.verify(h, r + 1, s, x, y));
    }

    function test_Precompile_MockEmptyReturn_FallsBackToSolidity() public {
        vm.etch(P256VERIFY, hex"00"); // STOP：staticcall 成功但返回空数据
        assertFalse(P256.precompileAvailable());
        (bytes32 h, uint256 x, uint256 y, uint256 r, uint256 s) = _vector(0);
        assertTrue(P256.verify(h, r, s, x, y));
    }
}
