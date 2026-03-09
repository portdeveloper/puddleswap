// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {WMON} from "../src/WMON.sol";

contract DeployUniswapDirect is Script {
    error DeploymentFailed(string name);

    function run() external returns (address wmon, address factory, address router) {
        address feeToSetter = vm.envAddress("FEE_TO_SETTER");
        address existingWmon = vm.envOr("WMON_ADDRESS", address(0));
        address existingFactory = vm.envOr("FACTORY_ADDRESS", address(0));

        vm.startBroadcast();

        if (existingWmon == address(0)) {
            wmon = address(new WMON());
            console2.log("WMON deployed:", wmon);
        } else {
            wmon = existingWmon;
            console2.log("Using existing WMON:", wmon);
        }

        if (existingFactory == address(0)) {
            bytes memory factoryCreationCode = abi.encodePacked(vm.envBytes("FACTORY_BYTECODE"), abi.encode(feeToSetter));
            factory = _deploy(factoryCreationCode, "UniswapV2Factory");
            console2.log("Factory deployed:", factory);
        } else {
            factory = existingFactory;
            console2.log("Using existing factory:", factory);
        }

        bytes memory routerCreationCode = abi.encodePacked(vm.envBytes("ROUTER_BYTECODE"), abi.encode(factory, wmon));
        router = _deploy(routerCreationCode, "UniswapV2Router02");
        console2.log("Router deployed:", router);

        vm.stopBroadcast();
    }

    function _deploy(bytes memory creationCode, string memory name) private returns (address deployed) {
        assembly {
            deployed := create(0, add(creationCode, 0x20), mload(creationCode))
        }

        if (deployed == address(0)) {
            revert DeploymentFailed(name);
        }
    }
}
