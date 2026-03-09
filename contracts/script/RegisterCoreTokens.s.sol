// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script} from "forge-std/Script.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";

contract RegisterCoreTokens is Script {
    function run() external {
        TokenRegistry registry = TokenRegistry(vm.envAddress("TOKEN_REGISTRY"));

        address usdc = vm.envAddress("USDC_ADDRESS");
        address usdt = vm.envAddress("USDT_ADDRESS");
        address wmon = vm.envAddress("WMON_ADDRESS");

        vm.startBroadcast();

        registry.registerVerified(
            usdc,
            "USDC",
            "USD Coin (Testnet)",
            6,
            TokenRegistry.TokenLevel.TOP_VERIFIED,
            true,
            vm.envOr("USDC_IMAGE_URI", string(""))
        );

        registry.registerVerified(
            usdt,
            "USDT",
            "Tether USD (Testnet)",
            6,
            TokenRegistry.TokenLevel.TOP_VERIFIED,
            true,
            vm.envOr("USDT_IMAGE_URI", string(""))
        );

        registry.registerVerified(
            wmon,
            "WMON",
            "Wrapped Monad",
            18,
            TokenRegistry.TokenLevel.TOP_VERIFIED,
            true,
            vm.envOr("WMON_IMAGE_URI", string(""))
        );

        vm.stopBroadcast();
    }
}
