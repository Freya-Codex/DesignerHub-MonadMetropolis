// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry — AI 生成器（agent）注册与声誉账本
/// @notice 参考 ERC-8004（AI agent 注册表）设计：生成方案的 AI 工具在此登记，
///         方案铸造时携带 agentId 形成「AI 归因」；声誉由 ProvenanceRegistry 在
///         每次确权时自动累加——声誉只能来自真实确权，不能人工刷。
/// @dev 合约不可升级；addReputation 仅允许 ProvenanceRegistry 调用（部署后接线一次）。
contract AgentRegistry is Ownable {
    struct Agent {
        string metadataURI; // agent 元数据（名称、模型、能力声明等），通常为 ipfs://
        uint256 reputation; // 声誉分 = 被确权方案累计次数
        uint64 registeredAt;
        bool registered;
    }

    /// @notice agentId 从 1 开始递增；0 保留给「无 AI 归因」。
    uint256 public nextAgentId = 1;

    mapping(uint256 agentId => Agent) private _agents;

    /// @notice 唯一有权累加声誉的协议合约。
    address public provenanceRegistry;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event ReputationAdded(uint256 indexed agentId, uint256 newReputation, uint256 delta);

    error NotRegistered(uint256 agentId);
    error NotProvenanceRegistry(address caller);
    error ProvenanceAlreadyWired();
    error EmptyMetadataURI();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice 登记（预注册）一个 AI agent。任何工具方都可以自助注册。
    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        agentId = nextAgentId++;
        _agents[agentId] =
            Agent({metadataURI: metadataURI, reputation: 0, registeredAt: uint64(block.timestamp), registered: true});
        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    /// @notice 声誉累加：仅 ProvenanceRegistry 可调用（每次确权 +1）。
    function addReputation(uint256 agentId) external {
        if (msg.sender != provenanceRegistry) revert NotProvenanceRegistry(msg.sender);
        if (!_agents[agentId].registered) revert NotRegistered(agentId);
        _agents[agentId].reputation += 1;
        emit ReputationAdded(agentId, _agents[agentId].reputation, 1);
    }

    /// @notice 部署后由 owner 接线一次，之后不可更换。
    function setProvenanceRegistry(address provenance) external onlyOwner {
        if (provenanceRegistry != address(0)) revert ProvenanceAlreadyWired();
        provenanceRegistry = provenance;
    }

    function isRegistered(uint256 agentId) external view returns (bool) {
        return _agents[agentId].registered;
    }

    function agentOf(uint256 agentId) external view returns (Agent memory) {
        if (!_agents[agentId].registered) revert NotRegistered(agentId);
        return _agents[agentId];
    }

    function reputationOf(uint256 agentId) external view returns (uint256) {
        if (!_agents[agentId].registered) revert NotRegistered(agentId);
        return _agents[agentId].reputation;
    }
}
