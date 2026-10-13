// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {console2} from "forge-std/console2.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";

/// @title RedeployMarket — redeploy only SchemeMarket (reusing the deployed DreamScheme)
/// @notice Purpose: SchemeMarket is non-upgradeable; when new logic such as the "creator payout address (setPayout)" is added,
///         only the market contract is swapped; DreamScheme / AgentRegistry / ProvenanceRegistry / factory stay untouched.
///
/// Usage:
///   forge script script/RedeployMarket.s.sol --rpc-url monad_testnet --broadcast
///
/// Reads the DreamScheme address from deployments/monad-testnet.json; the platform address comes from PLATFORM_ADDRESS.
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
