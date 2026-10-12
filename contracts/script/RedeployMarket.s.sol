// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";

/// @title RedeployMarket — 只重部署 SchemeMarket（复用已部署的 DreamScheme）
/// @notice 用途：SchemeMarket 不可升级；当加入了「创作者收款地址(setPayout)」这类新逻辑时，
///         只需换掉市场合约，DreamScheme / AgentRegistry / ProvenanceRegistry / 工厂都不动。
///
/// 用法：
///   forge script script/RedeployMarket.s.sol --rpc-url monad_testnet --broadcast
///
/// 读取 deployments/monad-testnet.json 里的 DreamScheme 地址；平台地址取 PLATFORM_ADDRESS。
contract RedeployMarket is Script {
    function run() public {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);
        address platform = vm.envOr("PLATFORM_ADDRESS", deployer);

        string memory json = vm.readFile("deployments/monad-testnet.json");
        address schemeAddr = vm.parseJsonAddress(json, ".DreamScheme");
        require(schemeAddr != address(0), "DreamScheme address missing in deployments json");

        console2.log("Reusing DreamScheme: ", schemeAddr);
        console2.log("Platform:            ", platform);

        vm.startBroadcast(deployerKey);
        SchemeMarket market = new SchemeMarket(DreamScheme(schemeAddr), payable(platform));
        vm.stopBroadcast();

        console2.log("New SchemeMarket:    ", address(market));
    }
}
