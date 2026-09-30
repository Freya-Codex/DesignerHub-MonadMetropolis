// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {P256} from "./lib/P256.sol";
import {WebAuthn} from "./lib/WebAuthn.sol";

/// @title P256PasskeyAccount — 无助记词的 WebAuthn/passkey 智能账户
///
/// @notice ## 密钥派生流程（Key Derivation）
///
/// 本合约不生成、不存储、也永远接触不到任何私钥：
///
///   1. 【设备侧生成】用户在网站上调用 `navigator.credentials.create()`，浏览器向
///      平台认证器（iPhone 的 Secure Enclave / Android 的 StrongBox / 笔记本的 TPM）
///      请求生成一对 **P-256 (secp256r1)** 非对称密钥。私钥在安全芯片内部生成，
///      硬件保证其永不可导出（kSecAttrTokenIDSecureEnclave / TPM_NO_DA）。
///   2. 【公钥上链】网站从注册响应的 `getPublicKey()` 取得公钥 (x, y)，通过
///      PasskeyAccountFactory 以 CREATE2（salt = keccak256(x, y, rpIdHash, originHash)）
///   部署本合约。账户地址在部署前即可确定（counterfactual），无需先转 ETH。
///   3. 【签名授权】每笔交易，网站按
///      `challenge = keccak256(account ‖ chainId ‖ nonce ‖ to ‖ value ‖ keccak256(data))`
///      派生 32 字节挑战，调用 `navigator.credentials.get()` 触发 FaceID / TouchID /
///      Windows Hello。认证器按 WebAuthn 规范对
///      `sha256(authenticatorData ‖ sha256(clientDataJSON))` 做 P-256 签名。
///   4. 【链上验证】本合约重算挑战 → 校验 authenticatorData（RP ID 绑定 + UP 标志）→
///      校验 clientDataJSON（type / challenge 匹配）→ P-256 验签（公钥即合约存储的
///      注册公钥）。全部通过才执行调用并递增 nonce（防重放）。
///
/// 全程：无私钥、无助记词、无 keystore 文件；用户身份 = 设备安全芯片里的硬件密钥。
/// 多设备恢复：用旧 passkey 签名调用 addKey() 追加新公钥（上限 4 把）。
///
/// @notice ## Gas 免付（relayer 模式）
///
/// `execute / executeBatch` 的调用者（relayer）不需要任何授权——授权完全来自
/// WebAuthn 签名对「确切操作 + nonce」的覆盖。任何人（包括我们的 /api/relay）都可以
/// 代为提交交易并代付 gas，且无法篡改操作内容（挑战覆盖 calldata 哈希）。
///
/// @dev 挑战派生函数 _challengeSingle / _challengeBatch 为 virtual，测试中用固定
///      挑战的子类覆盖，以便使用离线生成的 WebAuthn 断言夹具做完整回路测试。
contract P256PasskeyAccount {
    using WebAuthn for WebAuthn.Assertion;

    /// @notice 单账户最多注册的 passkey 数量（多设备恢复）。
    uint256 public constant MAX_KEYS = 4;

    /// @notice 交易序号，防重放。
    uint256 public nonce;

    /// @notice 期望的 sha256(RP ID)。RP ID 是网站的注册域，如 "designerhub.xyz"。
    bytes32 public immutable rpIdHash;
    /// @notice 期望的 keccak256(origin URL)（如 "https://designerhub.xyz"）。
    ///         设为 bytes32(0) 表示不校验 origin（本地开发）。
    bytes32 public immutable originHash;

    /// @notice 已注册的 passkey 公钥列表 (x, y)。
    uint256[2][] private _keys;

    event Executed(address indexed to, uint256 value, uint256 nonceAfter);
    event BatchExecuted(uint256 count, uint256 nonceAfter);
    event KeyAdded(uint256 indexed keyIndex, uint256 x, uint256 y);

    error InvalidPublicKey();
    error InvalidSignature();
    error BadOrigin();
    error TooManyKeys();
    error CallFailed(uint256 index);
    error BatchLengthMismatch();
    error CreateFailed();

    constructor(uint256 x, uint256 y, bytes32 _rpIdHash, bytes32 _originHash) {
        if (!P256.onCurve(x, y)) revert InvalidPublicKey();
        _keys.push([x, y]);
        rpIdHash = _rpIdHash;
        originHash = _originHash;
    }

    /// @notice 账户可直接收 ETH（relayer 代付模式下余额非必需，但保留自付能力）。
    receive() external payable {}

    /// @notice 接收 ERC-721（方案 NFT 铸入本账户）：钱包合约标准回调，无状态副作用。
    function onERC721Received(address, address, uint256, bytes calldata) external pure returns (bytes4) {
        return this.onERC721Received.selector;
    }

    // ------------------------------------------------------------------ //
    //                              执行入口                               //
    // ------------------------------------------------------------------ //

    /// @notice 用一次 passkey 签名执行一笔调用（relayer 可代付 gas）。
    function execute(address to, uint256 value, bytes calldata data, WebAuthn.Assertion calldata assertion) external {
        bytes32 challenge = _challengeSingle(nonce, to, value, keccak256(data));
        _verify(challenge, assertion);
        nonce += 1;
        (bool ok,) = to.call{value: value}(data);
        if (!ok) revert CallFailed(0);
        emit Executed(to, value, nonce);
    }

    /// @notice 用一次 passkey 签名原子地执行一批调用。
    ///         Designer Hub 的「导入方案」流程用它一次签名完成 attest + mint。
    function executeBatch(
        address[] calldata to,
        uint256[] calldata value,
        bytes[] calldata data,
        WebAuthn.Assertion calldata assertion
    ) external {
        if (to.length != value.length || to.length != data.length) revert BatchLengthMismatch();
        bytes32[] memory dataHashes = new bytes32[](data.length);
        for (uint256 i = 0; i < data.length; i++) {
            dataHashes[i] = keccak256(data[i]);
        }
        bytes32 challenge = _challengeBatch(nonce, keccak256(abi.encode(to, value, dataHashes)));
        _verify(challenge, assertion);
        nonce += 1;
        for (uint256 i = 0; i < to.length; i++) {
            (bool ok,) = to[i].call{value: value[i]}(data[i]);
            if (!ok) revert CallFailed(i);
        }
        emit BatchExecuted(to.length, nonce);
    }

    // ------------------------------------------------------------------ //
    //                            密钥管理                                 //
    // ------------------------------------------------------------------ //

    /// @notice 追加一把 passkey 公钥（多设备恢复）。仅可通过账户自身的 execute 调用。
    function addKey(uint256 x, uint256 y) external {
        if (msg.sender != address(this)) revert InvalidSignature();
        if (_keys.length >= MAX_KEYS) revert TooManyKeys();
        if (!P256.onCurve(x, y)) revert InvalidPublicKey();
        _keys.push([x, y]);
        emit KeyAdded(_keys.length - 1, x, y);
    }

    /// @notice 已注册的公钥数量。
    function keyCount() external view returns (uint256) {
        return _keys.length;
    }

    /// @notice 第 index 把公钥。
    function keyAt(uint256 index) external view returns (uint256 x, uint256 y) {
        (x, y) = (_keys[index][0], _keys[index][1]);
    }

    // ------------------------------------------------------------------ //
    //                        挑战派生（可覆盖）                           //
    // ------------------------------------------------------------------ //

    /// @notice 挑战预览：web 端 / SDK 用相同公式离线计算，供浏览器发起签名。
    function challengePreview(uint256 n, address to, uint256 value, bytes32 dataHash) external view returns (bytes32) {
        return _challengeSingle(n, to, value, dataHash);
    }

    function _challengeSingle(uint256 n, address to, uint256 value, bytes32 dataHash)
        internal
        view
        virtual
        returns (bytes32)
    {
        // 域分离前缀 + 账户地址 + 链 ID + nonce + 目标 + 金额 + calldata 哈希
        return keccak256(abi.encodePacked("dh/passkey/tx", address(this), block.chainid, n, to, value, dataHash));
    }

    function _challengeBatch(uint256 n, bytes32 batchHash) internal view virtual returns (bytes32) {
        return keccak256(abi.encodePacked("dh/passkey/batch", address(this), block.chainid, n, batchHash));
    }

    // ------------------------------------------------------------------ //
    //                             验签核心                                //
    // ------------------------------------------------------------------ //

    function _verify(bytes32 challenge, WebAuthn.Assertion calldata assertion) internal view {
        // origin 校验（可选：originHash 非零时启用）
        if (originHash != bytes32(0)) {
            (bytes memory origin, bool ok) = _originOf(assertion.clientDataJSON);
            if (!ok || keccak256(origin) != originHash) revert BadOrigin();
        }
        bool valid = false;
        for (uint256 i = 0; i < _keys.length && !valid; i++) {
            valid = WebAuthn.verify(
                WebAuthn.Assertion({
                    authenticatorData: assertion.authenticatorData,
                    clientDataJSON: assertion.clientDataJSON,
                    r: assertion.r,
                    s: assertion.s
                }),
                challenge,
                rpIdHash,
                _keys[i][0],
                _keys[i][1]
            );
        }
        if (!valid) revert InvalidSignature();
    }

    function _originOf(bytes calldata clientDataJSON) private pure returns (bytes memory, bool) {
        // 借用 WebAuthn 库的 JSON 提取逻辑（calldata → memory 转换后查找 "origin" 字段）
        bytes memory cd = abi.encodePacked(clientDataJSON);
        return WebAuthn.extractJsonString(cd, "origin");
    }
}

/// @title PasskeyAccountFactory — CREATE2 确定性部署 passkey 账户
/// @notice salt = keccak256(abi.encode(x, y, rpIdHash, originHash))：
///         同一 passkey 在同一站点配置下永远映射到同一地址（counterfactual），
///         注册页可在部署前就把地址展示给用户。
contract PasskeyAccountFactory {
    error CreateFailed();
    error AccountExists(address account);

    event AccountCreated(address indexed account, uint256 x, uint256 y);

    /// @notice 预计算某公钥对应的账户地址（不部署）。
    function accountOf(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash) external view returns (address) {
        return _compute(x, y, rpIdHash, originHash);
    }

    /// @notice 部署账户。若已存在则直接 revert（调用方应先用 accountOf 判断）。
    function createAccount(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash)
        external
        returns (P256PasskeyAccount account)
    {
        address expected = _compute(x, y, rpIdHash, originHash);
        if (expected.code.length != 0) revert AccountExists(expected);
        bytes memory initCode =
            abi.encodePacked(type(P256PasskeyAccount).creationCode, abi.encode(x, y, rpIdHash, originHash));
        bytes32 salt = keccak256(abi.encode(x, y, rpIdHash, originHash));
        address deployed;
        assembly {
            deployed := create2(0, add(initCode, 32), mload(initCode), salt)
        }
        if (deployed == address(0)) revert CreateFailed();
        account = P256PasskeyAccount(payable(deployed));
        emit AccountCreated(deployed, x, y);
    }

    function _compute(uint256 x, uint256 y, bytes32 rpIdHash, bytes32 originHash)
        private
        view
        returns (address predicted)
    {
        bytes memory initCode =
            abi.encodePacked(type(P256PasskeyAccount).creationCode, abi.encode(x, y, rpIdHash, originHash));
        bytes32 salt = keccak256(abi.encode(x, y, rpIdHash, originHash));
        predicted = address(
            uint160(uint256(keccak256(abi.encodePacked(bytes1(0xff), address(this), salt, keccak256(initCode)))))
        );
    }
}
