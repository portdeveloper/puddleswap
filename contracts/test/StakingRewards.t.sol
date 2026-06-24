// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Test} from "forge-std/Test.sol";
import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

import {StakingRewards} from "../src/StakingRewards.sol";

contract MockERC20 is ERC20 {
    constructor(string memory name_, string memory symbol_) ERC20(name_, symbol_) {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract StakingRewardsTest is Test {
    MockERC20 internal reward;
    MockERC20 internal lp;
    StakingRewards internal staking;

    address internal admin = address(this);
    address internal alice = address(0xA11CE);
    address internal bob = address(0xB0B);

    uint256 internal constant DURATION = 7 days;
    uint256 internal constant REWARD = 7_000 ether; // ~1000/day

    function setUp() external {
        reward = new MockERC20("Reward", "RWD");
        lp = new MockERC20("LP", "LP");
        staking = new StakingRewards(admin, address(reward), address(lp), DURATION);

        reward.mint(address(staking), REWARD);
        staking.notifyRewardAmount(REWARD);

        lp.mint(alice, 100 ether);
        lp.mint(bob, 100 ether);
    }

    function _stake(address who, uint256 amount) internal {
        vm.startPrank(who);
        lp.approve(address(staking), amount);
        staking.stake(amount);
        vm.stopPrank();
    }

    function test_Stake_UpdatesBalancesAndPullsTokens() external {
        _stake(alice, 50 ether);

        assertEq(staking.balanceOf(alice), 50 ether);
        assertEq(staking.totalSupply(), 50 ether);
        assertEq(lp.balanceOf(address(staking)), 50 ether);
        assertEq(lp.balanceOf(alice), 50 ether);
    }

    function test_SingleStaker_EarnsFullRewardOverPeriod() external {
        _stake(alice, 50 ether);
        vm.warp(block.timestamp + DURATION);

        // Within integer-division dust of the full reward budget.
        assertApproxEqRel(staking.earned(alice), REWARD, 1e14); // 0.01%
    }

    function test_TwoStakers_SplitProRata() external {
        _stake(alice, 50 ether); // alice staked for the whole period
        vm.warp(block.timestamp + DURATION / 2);
        _stake(bob, 50 ether); // bob joins at the halfway point
        vm.warp(block.timestamp + DURATION / 2);

        // First half: alice alone -> REWARD/2. Second half: split evenly -> REWARD/4 each.
        assertApproxEqRel(staking.earned(alice), (REWARD * 3) / 4, 1e15); // 0.1%
        assertApproxEqRel(staking.earned(bob), REWARD / 4, 1e15);
    }

    function test_GetReward_TransfersAndZeroesAccrual() external {
        _stake(alice, 50 ether);
        vm.warp(block.timestamp + DURATION);

        uint256 owed = staking.earned(alice);
        vm.prank(alice);
        staking.getReward();

        assertEq(reward.balanceOf(alice), owed);
        assertEq(staking.rewards(alice), 0);
    }

    function test_Withdraw_ReturnsStakingToken() external {
        _stake(alice, 50 ether);

        vm.prank(alice);
        staking.withdraw(20 ether);

        assertEq(staking.balanceOf(alice), 30 ether);
        assertEq(lp.balanceOf(alice), 70 ether); // 100 - 50 staked + 20 withdrawn
    }

    function test_Exit_WithdrawsAllAndClaims() external {
        _stake(alice, 50 ether);
        vm.warp(block.timestamp + DURATION);

        vm.prank(alice);
        staking.exit();

        assertEq(staking.balanceOf(alice), 0);
        assertEq(lp.balanceOf(alice), 100 ether);
        assertGt(reward.balanceOf(alice), 0);
    }

    function test_NotifyRewardAmount_RevertsForNonOperator() external {
        vm.expectRevert();
        vm.prank(alice);
        staking.notifyRewardAmount(REWARD);
    }

    function test_NotifyRewardAmount_RevertsWhenUnderfunded() external {
        StakingRewards fresh = new StakingRewards(admin, address(reward), address(lp), DURATION);
        // No reward tokens transferred in -> rate would exceed balance.
        vm.expectRevert(StakingRewards.RewardTooHigh.selector);
        fresh.notifyRewardAmount(REWARD);
    }

    function test_RecoverERC20_CannotTakeStakingToken() external {
        vm.expectRevert(StakingRewards.CannotRecoverStakingToken.selector);
        staking.recoverERC20(address(lp), admin, 1);
    }

    function test_RecoverERC20_RecoversStrayToken() external {
        MockERC20 stray = new MockERC20("Stray", "STR");
        stray.mint(address(staking), 5 ether);

        staking.recoverERC20(address(stray), admin, 5 ether);

        assertEq(stray.balanceOf(admin), 5 ether);
    }

    function test_SetRewardsDuration_RevertsDuringActivePeriod() external {
        vm.expectRevert(StakingRewards.RewardPeriodActive.selector);
        staking.setRewardsDuration(14 days);
    }

    function test_SetRewardsDuration_AllowedAfterPeriod() external {
        vm.warp(block.timestamp + DURATION + 1);
        staking.setRewardsDuration(14 days);
        assertEq(staking.rewardsDuration(), 14 days);
    }
}
