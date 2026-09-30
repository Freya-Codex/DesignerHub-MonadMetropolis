// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {AgentRegistry} from "../src/AgentRegistry.sol";
import {ProvenanceRegistry} from "../src/ProvenanceRegistry.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";
import {PasskeyAccountFactory} from "../src/P256PasskeyAccount.sol";

/// @title Deploy — Designer Hub 协议全家桶部署脚本
/// @notice 部署顺序（接线关系决定）：
///         AgentRegistry → ProvenanceRegistry → 接线 → DreamScheme → SchemeMarket
///         → PasskeyAccountFactory → 预注册 Kimi agent。
contract Deploy is Script {
    /// @notice Kimi（AI 生成器）的元数据 URI，Phase 2 换成固定到 IPFS 的正式元数据。
    string public constant KIMI_METADATA_URI = "https://designerhub.xyz/agents/kimi.json";

    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address platform = vm.envOr("PLATFORM_ADDRESS", vm.addr(deployerKey));
        vm.startBroadcast(deployerKey);

        AgentRegistry agents = new AgentRegistry(msg.sender);
        ProvenanceRegistry provenance = new ProvenanceRegistry(agents);
        agents.setProvenanceRegistry(address(provenance));
        DreamScheme scheme = new DreamScheme(agents);
        SchemeMarket market = new SchemeMarket(scheme, payable(platform));
        PasskeyAccountFactory factory = new PasskeyAccountFactory();

        // 预注册 Kimi agent（agentId = 1）
        uint256 kimiAgentId = agents.registerAgent(KIMI_METADATA_URI);

        vm.stopBroadcast();

        string memory chainAlias = vm.toString(block.chainid);
        string memory json = "deployment";
        vm.serializeString(json, "network", "monad-testnet");
        vm.serializeString(json, "chainAlias", chainAlias);
        vm.serializeUint(json, "chainId", block.chainid);
        vm.serializeAddress(json, "deployer", msg.sender);
        vm.serializeAddress(json, "platformAddress", platform);
        vm.serializeUint(json, "kimiAgentId", kimiAgentId);
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
        console2.log("Kimi agentId:           ", kimiAgentId);
    }
}
