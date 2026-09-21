// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {DreamScheme} from "../src/DreamScheme.sol";
import {SchemeMarket} from "../src/SchemeMarket.sol";

/// @title DeployScript
/// @notice 在 Monad 测试网（Chain ID 10143）部署 DreamScheme + SchemeMarket，
///         并在终端输出合约地址，同时把地址写入 contracts/deployments/*.json。
///
/// 用法：
///   cd contracts
///   cp .env.example .env   # 填入 DEPLOYER_PRIVATE_KEY
///   forge script script/Deploy.s.sol --rpc-url monad_testnet --broadcast -vv
///
/// 可选环境变量：
///   ROYALTY_RECEIVER  版税接收地址（缺省为部署者）
///   PLATFORM_ADDRESS  平台分账地址（缺省为部署者）
///   APPLY_PRICE_WEI   「应用到我家」价格（缺省 0.01 MON = 10000000000000000）
contract DeployScript is Script {
    uint256 internal constant MONAD_TESTNET_CHAIN_ID = 10143;

    function run() external {
        uint256 deployerKey = vm.envUint("DEPLOYER_PRIVATE_KEY");
        address deployer = vm.addr(deployerKey);

        address royaltyReceiver = vm.envOr("ROYALTY_RECEIVER", deployer);
        address platformAddress = vm.envOr("PLATFORM_ADDRESS", deployer);
        uint256 applyPriceWei = vm.envOr("APPLY_PRICE_WEI", uint256(0));

        vm.startBroadcast(deployerKey);
        DreamScheme dreamScheme = new DreamScheme(deployer, royaltyReceiver);
        SchemeMarket schemeMarket = new SchemeMarket(dreamScheme, deployer, platformAddress);
        if (applyPriceWei != 0) {
            schemeMarket.setApplyPrice(applyPriceWei);
        }
        vm.stopBroadcast();

        console2.log("=== DreamScheme / SchemeMarket deployed ===");
        console2.log("chainId          :", block.chainid);
        console2.log("deployer         :", deployer);
        console2.log("DreamScheme      :", address(dreamScheme));
        console2.log("SchemeMarket     :", address(schemeMarket));
        console2.log("royaltyReceiver  :", royaltyReceiver);
        console2.log("platformAddress  :", platformAddress);
        console2.log("applyPrice (wei) :", schemeMarket.applyPrice());

        _saveDeployment(address(dreamScheme), address(schemeMarket), deployer, platformAddress);
    }

    function _saveDeployment(address schemeAddr, address marketAddr, address deployer, address platformAddress)
        internal
    {
        string memory dir = string.concat(vm.projectRoot(), "/deployments");
        vm.createDir(dir, true);

        string memory json = string.concat(
            "{\n",
            '  "network": "monad-testnet",\n',
            '  "chainId": ',
            vm.toString(block.chainid),
            ",\n",
            '  "deployer": "',
            vm.toString(deployer),
            '",\n',
            '  "platformAddress": "',
            vm.toString(platformAddress),
            '",\n',
            '  "DreamScheme": "',
            vm.toString(schemeAddr),
            '",\n',
            '  "SchemeMarket": "',
            vm.toString(marketAddr),
            '"\n',
            "}\n"
        );

        string memory fileName = block.chainid == MONAD_TESTNET_CHAIN_ID
            ? "monad-testnet.json"
            : string.concat("chain-", vm.toString(block.chainid), ".json");

        string memory path = string.concat(dir, "/", fileName);
        vm.writeFile(path, json);
        console2.log("deployment file  :", path);
    }
}
