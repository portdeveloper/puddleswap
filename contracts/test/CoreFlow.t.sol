// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {OpenRegistrationGate} from "../src/OpenRegistrationGate.sol";
import {StableFaucet} from "../src/StableFaucet.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";
import {TokenRegistry} from "../src/TokenRegistry.sol";

contract CoreFlowTest is Test {
    TestUSDC internal usdc;
    TestUSDT internal usdt;
    StableFaucet internal faucet;
    OpenRegistrationGate internal gate;
    TokenRegistry internal registry;

    address internal admin = address(this);
    address internal verifier = address(0xB0B);
    address internal builder = address(0xCAFE);

    function setUp() external {
        usdc = new TestUSDC(admin);
        usdt = new TestUSDT(admin);
        faucet = new StableFaucet(admin, address(usdc), address(usdt), 1_000 * 1e6, 1_000 * 1e6, 1 days);

        gate = new OpenRegistrationGate(admin, 7 days, 1);
        registry = new TokenRegistry(admin, verifier, address(gate));

        gate.grantRole(gate.REGISTRY_ROLE(), address(registry));
        usdc.grantRole(usdc.MINTER_ROLE(), address(faucet));
        usdt.grantRole(usdt.MINTER_ROLE(), address(faucet));
    }

    function test_BuilderOnboardingFlow() external {
        vm.prank(builder);
        faucet.claim();

        assertEq(usdc.balanceOf(builder), 1_000 * 1e6);
        assertEq(usdt.balanceOf(builder), 1_000 * 1e6);

        vm.prank(verifier);
        registry.registerVerified(
            address(usdc),
            "USDC",
            "USD Coin (Testnet)",
            6,
            TokenRegistry.TokenLevel.TOP_VERIFIED,
            true,
            "ipfs://usdc"
        );

        vm.prank(builder);
        registry.registerBasic(address(0xAAA1), "abc", "Builder Coin", 18);

        TokenRegistry.TokenView[] memory results = registry.search("A");
        assertEq(results.length, 1);
        assertEq(results[0].symbol, "abc");
        assertEq(results[0].imageURI, "");
    }
}
