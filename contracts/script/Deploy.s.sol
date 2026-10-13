// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";
import {PasskeyAccountFactory} from "../src/P256PasskeyAccount.sol";

/// @title Deploy — full-suite deployment script for the Designer Hub protocol
/// @notice Deployment order (determined by wiring):
///         AgentRegistry -> ProvenanceRegistry -> wire -> DreamScheme -> SchemeMarket
///         -> PasskeyAccountFactory -> pre-register all AI agents in order.
contract Deploy is Script {
    /// @notice AI generator metadata URIs, registered **in array order** -> agentId 1..N.
    ///         The order must match AGENTS in web/lib/agents.ts
    ///         (Kimi=1, Qwen=2, DeepSeek=3 ...), otherwise on-chain attribution and the front-end display mismatch.
    function agentUris() internal pure returns (string[12] memory uris) {
        uris = [
            "https://designerhub.xyz/agents/kimi.json",
            "https://designerhub.xyz/agents/qwen.json",
            "https://designerhub.xyz/agents/deepseek.json",
            "https://designerhub.xyz/agents/zhipu.json",
            "https://designerhub.xyz/agents/siliconflow.json",
            "https://designerhub.xyz/agents/ark.json",
            "https://designerhub.xyz/agents/openrouter.json",
            "https://designerhub.xyz/agents/openai.json",
            "https://designerhub.xyz/agents/anthropic.json",
            "https://designerhub.xyz/agents/gemini.json",
            "https://designerhub.xyz/agents/agnes.json",
            "https://designerhub.xyz/agents/custom.json"
        ];
    }

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address platform = vm.envOr("PLATFORM_ADDRESS", deployer);
        vm.startBroadcast(deployerKey);

        AgentRegistry agents = new AgentRegistry(deployer);
        ProvenanceRegistry provenance = new ProvenanceRegistry(agents);
        agents.setProvenanceRegistry(address(provenance));
        DreamScheme scheme = new DreamScheme(agents);
        SchemeMarket market = new SchemeMarket(scheme, payable(platform));
        PasskeyAccountFactory factory = new PasskeyAccountFactory();

        // Pre-register all AI agents in order (agentId = 1..12)
        string[12] memory uris = agentUris();
        uint256[] memory agentIds = new uint256[](uris.length);
        for (uint256 i = 0; i < uris.length; i++) {
            agentIds[i] = agents.registerAgent(uris[i]);
        }

        vm.stopBroadcast();

        string memory chainAlias = vm.toString(block.chainid);
        string memory json = "deployment";
        vm.serializeString(json, "network", "monad-testnet");
        vm.serializeString(json, "chainAlias", chainAlias);
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "deployer", deployer);
        vm.serializeAddress(json, "platformAddress", platform);
        vm.serializeUint(json, "kimiAgentId", agentIds[0]);
        string memory agentsJson = "agents";
        vm.serializeUint(agentsJson, "kimi", agentIds[0]);
        vm.serializeUint(agentsJson, "qwen", agentIds[1]);
        vm.serializeUint(agentsJson, "deepseek", agentIds[2]);
        vm.serializeUint(agentsJson, "zhipu", agentIds[3]);
        vm.serializeUint(agentsJson, "siliconflow", agentIds[4]);
        vm.serializeUint(agentsJson, "ark", agentIds[5]);
        vm.serializeUint(agentsJson, "openrouter", agentIds[6]);
        vm.serializeUint(agentsJson, "openai", agentIds[7]);
        vm.serializeUint(agentsJson, "anthropic", agentIds[8]);
        vm.serializeUint(agentsJson, "gemini", agentIds[9]);
        vm.serializeUint(agentsJson, "agnes", agentIds[10]);
        string memory agentsSerialized = vm.serializeUint(agentsJson, "custom", agentIds[11]);
        vm.serializeString(json, "agents", agentsSerialized);
        vm.serializeAddress(json, "AgentRegistry", address(agents));
        vm.serializeAddress(json, "ProvenanceRegistry", address(provenance));
        vm.serializeAddress(json, "DreamScheme", address(scheme));
        vm.serializeAddress(json, "SchemeMarket", address(market));
        string memory finalJson = vm.serializeAddress(json, "PasskeyAccountFactory", address(factory));

        vm.writeJson(finalJson, "deployments/monad-testnet.json");

        console2.log("AgentRegistry:          ", address(agents));
        console2.log("ProvenanceRegistry:     ", address(provenance));
        console2.log("DreamScheme:            ", address(scheme));
        console2.log("SchemeMarket:           ", address(market));
        console2.log("PasskeyAccountFactory:  ", address(factory));
        console2.log("Registered agents:      ", uris.length);
        console2.log("Kimi agentId:           ", agentIds[0]);
    }
}
