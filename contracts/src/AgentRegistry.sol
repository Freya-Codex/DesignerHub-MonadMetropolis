// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/// @title AgentRegistry — AI generator (agent) registration and reputation ledger
/// @notice Designed after ERC-8004 (an AI agent registry): AI tools that generate schemes register here,
///         and the scheme carries an agentId at mint to form "AI attribution"; reputation is accrued
///         automatically by ProvenanceRegistry on every attestation — reputation can only come from
///         real attestations, never be farmed manually.
/// @dev Non-upgradeable; addReputation is callable only by ProvenanceRegistry (wired once after deployment).
contract AgentRegistry is Ownable {
    struct Agent {
        string metadataURI; // agent metadata (name, model, capability claims, etc.), usually ipfs://
        uint256 reputation; // reputation score = cumulative number of attested schemes
        uint64 registeredAt;
        bool registered;
    }

    /// @notice agentId increments from 1; 0 is reserved for "no AI attribution".
    uint256 public nextAgentId = 1;

    mapping(uint256 agentId => Agent) private _agents;

    /// @notice The only protocol contract allowed to accrue reputation.
    address public provenanceRegistry;

    event AgentRegistered(uint256 indexed agentId, address indexed owner, string metadataURI);
    event ReputationAdded(uint256 indexed agentId, uint256 newReputation, uint256 delta);

    error NotRegistered(uint256 agentId);
    error NotProvenanceRegistry(address caller);
    error ProvenanceAlreadyWired();
    error EmptyMetadataURI();

    constructor(address initialOwner) Ownable(initialOwner) {}

    /// @notice Register (pre-register) an AI agent. Any toolkit owner can self-register.
    function registerAgent(string calldata metadataURI) external returns (uint256 agentId) {
        if (bytes(metadataURI).length == 0) revert EmptyMetadataURI();
        agentId = nextAgentId++;
        _agents[agentId] =
            Agent({metadataURI: metadataURI, reputation: 0, registeredAt: uint64(block.timestamp), registered: true});
        emit AgentRegistered(agentId, msg.sender, metadataURI);
    }

    /// @notice Accrue reputation: callable only by ProvenanceRegistry (+1 per attestation).
    function addReputation(uint256 agentId) external {
        if (msg.sender != provenanceRegistry) revert NotProvenanceRegistry(msg.sender);
        if (!_agents[agentId].registered) revert NotRegistered(agentId);
        _agents[agentId].reputation += 1;
        emit ReputationAdded(agentId, _agents[agentId].reputation, 1);
    }

    /// @notice Wired once by the owner after deployment; cannot be changed afterwards.
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
