// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {AgentRegistry} from "./AgentRegistry.sol";
import {ECDSA} from "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/// @title ProvenanceRegistry — AI 生成内容的确权登记处（协议主角）
///
/// @notice ## 隐私模型（Privacy by Design）
///
/// 链上只保存「承诺」（commitment），不保存任何方案内容：
///
///     commitment = keccak256(abi.encodePacked(contentHash, salt))
///
///   - contentHash = keccak256(canonicalJSON(方案)) —— 房间几何、家具清单等全部
///     原始数据只存在于 IPFS（可选）与用户本地，永不上链；
///   - salt 由用户随机生成 —— 即便两个方案内容相同，承诺也不同，
///     无法通过链上数据做内容关联；
///   - 验证工具：任何人拿原始 JSON + salt 即可本地重算承诺，与链上比对，
///     证明「内容未被篡改 + 确权时间点」。
///
/// @notice ## 免 gas（relayer 代付）
///
/// EOA 用户用 EIP-712 结构化签名授权一次确权请求，relayer 代为提交并支付 gas：
///
///     attestByRelayer(AttestRequest, signature)
///
///     struct AttestRequest {
///         address attestor;      // 签名者 = 确权人
///         bytes32 commitment;    // 内容承诺
///         uint256 agentId;       // AI 归因（0 = 无）
///         string  metadataURI;   // 可选元数据（ipfs://）
///         uint256 nonce;         // 防重放
///         uint256 deadline;      // 签名有效期
///     }
///
/// passkey 用户则由其 P256PasskeyAccount.execute 代发（同样免 gas），
/// 签名授权覆盖「确切操作 + nonce」，relayer 无法篡改。
///
/// @dev 合约不可升级；承诺全局唯一（一个承诺只能被确权一次）。
contract ProvenanceRegistry {
    using ECDSA for bytes32;

    AgentRegistry public immutable agentRegistry;
    bytes32 public immutable DOMAIN_SEPARATOR;

    struct Attestation {
        address attestor; // 确权人
        uint256 agentId; // AI 归因（0 = 人类原创 / 未声明）
        uint64 attestedAt; // 确权时间
        bool exists;
    }

    struct AttestRequest {
        address attestor;
        bytes32 commitment;
        uint256 agentId;
        string metadataURI;
        uint256 nonce;
        uint256 deadline;
    }

    /// @notice commitment → 确权记录。
    mapping(bytes32 => Attestation) public attestations;
    /// @notice relayer 模式下每个 attestor 的签名 nonce（防重放）。
    mapping(address => uint256) public nonces;

    event Attested(address indexed attestor, bytes32 indexed commitment, uint256 indexed agentId, string metadataURI);

    error AlreadyAttested(bytes32 commitment);
    error AgentNotRegistered(uint256 agentId);
    error Expired(uint256 deadline);
    error InvalidSigner(address recovered, address expected);
    error BadNonce(uint256 provided, uint256 expected);
    error NotAttested(bytes32 commitment);

    bytes32 private constant ATTEST_REQUEST_TYPEHASH = keccak256(
        "AttestRequest(address attestor,bytes32 commitment,uint256 agentId,string metadataURI,uint256 nonce,uint256 deadline)"
    );

    constructor(AgentRegistry _agentRegistry) {
        agentRegistry = _agentRegistry;
        DOMAIN_SEPARATOR = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ProvenanceRegistry")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }

    // ------------------------------------------------------------------ //
    //                            确权入口                                 //
    // ------------------------------------------------------------------ //

    /// @notice 直接确权（自付 gas 的 EOA / 智能账户调用）。
    /// @param commitment keccak256(abi.encodePacked(contentHash, salt))。
    /// @param agentId 生成该内容的 AI agent，0 表示无归因；>0 必须已注册。
    /// @param metadataURI 可选元数据 URI（ipfs://...），可为空字符串。
    function attest(bytes32 commitment, uint256 agentId, string calldata metadataURI) external {
        _attest(msg.sender, commitment, agentId, metadataURI);
    }

    /// @notice relayer 代付的确权：EIP-712 签名授权，relayer 提交。
    function attestByRelayer(AttestRequest calldata request, bytes calldata signature) external {
        if (block.timestamp > request.deadline) revert Expired(request.deadline);
        if (request.nonce != nonces[request.attestor]) {
            revert BadNonce(request.nonce, nonces[request.attestor]);
        }
        bytes32 structHash = keccak256(
            abi.encode(
                ATTEST_REQUEST_TYPEHASH,
                request.attestor,
                request.commitment,
                request.agentId,
                keccak256(bytes(request.metadataURI)),
                request.nonce,
                request.deadline
            )
        );
        bytes32 digest = keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
        address recovered = digest.recover(signature);
        if (recovered != request.attestor) revert InvalidSigner(recovered, request.attestor);
        nonces[request.attestor] = request.nonce + 1;
        _attest(request.attestor, request.commitment, request.agentId, request.metadataURI);
    }

    function _attest(address attestor, bytes32 commitment, uint256 agentId, string memory metadataURI) private {
        if (attestations[commitment].exists) revert AlreadyAttested(commitment);
        if (agentId != 0 && !agentRegistry.isRegistered(agentId)) revert AgentNotRegistered(agentId);

        attestations[commitment] =
            Attestation({attestor: attestor, agentId: agentId, attestedAt: uint64(block.timestamp), exists: true});

        // AI 归因声誉：确权即累加（只有本合约能调 addReputation）
        if (agentId != 0) {
            agentRegistry.addReputation(agentId);
        }

        emit Attested(attestor, commitment, agentId, metadataURI);
    }

    // ------------------------------------------------------------------ //
    //                              验证                                   //
    // ------------------------------------------------------------------ //

    /// @notice 查询一个承诺的确权状态（验证工具 / SDK 使用）。
    function verify(bytes32 commitment)
        external
        view
        returns (bool exists, address attestor, uint256 agentId, uint64 attestedAt)
    {
        Attestation storage a = attestations[commitment];
        return (a.exists, a.attestor, a.agentId, a.attestedAt);
    }

    /// @notice 计算 AttestRequest 的 EIP-712 摘要（SDK / 测试使用）。
    function attestRequestDigest(AttestRequest calldata request) external view returns (bytes32) {
        bytes32 structHash = keccak256(
            abi.encode(
                ATTEST_REQUEST_TYPEHASH,
                request.attestor,
                request.commitment,
                request.agentId,
                keccak256(bytes(request.metadataURI)),
                request.nonce,
                request.deadline
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", DOMAIN_SEPARATOR, structHash));
    }
}
