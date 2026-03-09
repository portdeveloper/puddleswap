// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {StableFaucet} from "../src/StableFaucet.sol";
import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";

contract StableFaucetTest is Test {
    TestUSDC internal usdc;
    TestUSDT internal usdt;
    StableFaucet internal faucet;

    address internal admin = address(this);
    address internal user = address(0xA11CE);

    function setUp() external {
        usdc = new TestUSDC(admin);
        usdt = new TestUSDT(admin);
        faucet = new StableFaucet(admin, address(usdc), address(usdt), 1_000 * 1e6, 1_000 * 1e6, 1 days);

        usdc.grantRole(usdc.MINTER_ROLE(), address(faucet));
        usdt.grantRole(usdt.MINTER_ROLE(), address(faucet));
    }

    function test_Claim_MintsBothTokensAndUpdatesCooldown() external {
        vm.prank(user);
        faucet.claim();

        assertEq(usdc.balanceOf(user), 1_000 * 1e6);
        assertEq(usdt.balanceOf(user), 1_000 * 1e6);
        assertEq(faucet.nextClaimAt(user), block.timestamp + 1 days);
    }

    function test_Claim_RevertsWhenCooldownActive() external {
        vm.prank(user);
        faucet.claim();

        vm.expectRevert();
        vm.prank(user);
        faucet.claim();
    }

    function test_AdminCanTuneParams() external {
        faucet.setClaimAmounts(500 * 1e6, 700 * 1e6);
        faucet.setCooldown(12 hours);

        assertEq(faucet.claimAmountUSDC(), 500 * 1e6);
        assertEq(faucet.claimAmountUSDT(), 700 * 1e6);
        assertEq(faucet.cooldown(), 12 hours);
    }

    function test_AdminMint_OnlySupportsStableTokens() external {
        faucet.adminMint(address(usdc), user, 100 * 1e6);
        assertEq(usdc.balanceOf(user), 100 * 1e6);

        vm.expectRevert();
        faucet.adminMint(address(0x1234), user, 1);
    }
}
