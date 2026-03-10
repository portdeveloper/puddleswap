// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {OpenRegistrationGate} from "../src/OpenRegistrationGate.sol";
import {StableFaucet} from "../src/StableFaucet.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";
import {WMON} from "../src/WMON.sol";

contract DeployDexCore is Script {
    function run() external {
        address admin = vm.envOr("ADMIN_ADDRESS", msg.sender);
        address verifier = vm.envOr("VERIFIER_ADDRESS", admin);
        address wmon = vm.envOr("WMON_ADDRESS", address(0));

        uint256 claimAmountUSDC = vm.envOr("USDC_CLAIM_AMOUNT", uint256(1_000 * 1e6));
        uint256 claimAmountUSDT = vm.envOr("USDT_CLAIM_AMOUNT", uint256(1_000 * 1e6));
        uint256 faucetCooldown = vm.envOr("FAUCET_COOLDOWN", uint256(24 hours));

        vm.startBroadcast();

        if (wmon == address(0)) {
            wmon = address(new WMON());
            console2.log("Deployed WMON:", wmon);
        }

        TestUSDC usdc = new TestUSDC(admin);
        TestUSDT usdt = new TestUSDT(admin);
        StableFaucet faucet =
            new StableFaucet(admin, address(usdc), address(usdt), claimAmountUSDC, claimAmountUSDT, faucetCooldown);

        OpenRegistrationGate openGate = new OpenRegistrationGate(admin, 7 days, 1);
        TokenRegistry registry = new TokenRegistry(admin, verifier, address(openGate));

        usdc.grantRole(usdc.MINTER_ROLE(), address(faucet));
        usdt.grantRole(usdt.MINTER_ROLE(), address(faucet));

        openGate.grantRole(openGate.REGISTRY_ROLE(), address(registry));

        console2.log("TestUSDC:", address(usdc));
        console2.log("TestUSDT:", address(usdt));
        console2.log("StableFaucet:", address(faucet));
        console2.log("OpenRegistrationGate:", address(openGate));
        console2.log("TokenRegistry:", address(registry));

        vm.stopBroadcast();
    }
}
