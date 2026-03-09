// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";

import {TestUSDC} from "../src/TestUSDC.sol";
import {TestUSDT} from "../src/TestUSDT.sol";

contract TestStableTokenTest is Test {
    TestUSDC internal usdc;
    TestUSDT internal usdt;

    address internal admin = address(this);
    address internal user = address(0xBEEF);

    function setUp() external {
        usdc = new TestUSDC(admin);
        usdt = new TestUSDT(admin);
    }

    function test_Decimals_AreSix() external view {
        assertEq(usdc.decimals(), 6);
        assertEq(usdt.decimals(), 6);
    }

    function test_AdminCanMint() external {
        usdc.mint(user, 1_250_000);
        assertEq(usdc.balanceOf(user), 1_250_000);
    }

    function test_OnlyMinterCanMint() external {
        vm.expectRevert();
        vm.prank(user);
        usdc.mint(user, 100);
    }
}
