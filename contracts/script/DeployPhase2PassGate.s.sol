// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {PassRegistrationGate} from "../src/PassRegistrationGate.sol";
import {RegistrationPass} from "../src/RegistrationPass.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";

contract DeployPhase2PassGate is Script {
    function run() external {
        address safe = vm.envAddress("SAFE_ADDRESS");
        TokenRegistry registry = TokenRegistry(vm.envAddress("TOKEN_REGISTRY"));

        vm.startBroadcast();

        RegistrationPass registrationPass = new RegistrationPass(safe);
        PassRegistrationGate passGate = new PassRegistrationGate(safe, address(registrationPass));

        registrationPass.grantRole(registrationPass.CONSUMER_ROLE(), address(passGate));
        passGate.grantRole(passGate.REGISTRY_ROLE(), address(registry));
        registry.setRegistrationGate(address(passGate));

        console2.log("RegistrationPass:", address(registrationPass));
        console2.log("PassRegistrationGate:", address(passGate));

        vm.stopBroadcast();
    }
}
