// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";
import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";

import {StakingRewards} from "../src/StakingRewards.sol";

/// @notice Funds (or tops up) a StakingRewards farm: transfers reward tokens in and starts/extends
///         the reward period via notifyRewardAmount.
/// @dev Required env: STAKING_REWARDS_ADDRESS, REWARD_AMOUNT (in reward-token base units).
///      The broadcasting account must hold REWARD_AMOUNT of the reward token and have OPERATOR_ROLE.
///      Repeatable for top-ups. Reward token = WMON by default; wrap MON -> WMON first if needed.
contract FundStakingRewards is Script {
    function run() external {
        address stakingAddr = vm.envAddress("STAKING_REWARDS_ADDRESS");
        uint256 amount = vm.envUint("REWARD_AMOUNT");

        StakingRewards staking = StakingRewards(stakingAddr);
        IERC20 rewardsToken = staking.rewardsToken();

        vm.startBroadcast();
        rewardsToken.transfer(stakingAddr, amount);
        staking.notifyRewardAmount(amount);
        vm.stopBroadcast();

        console2.log("Funded StakingRewards:", stakingAddr);
        console2.log("  reward amount:", amount);
        console2.log("  rewardRate (per second):", staking.rewardRate());
        console2.log("  periodFinish:", staking.periodFinish());
    }
}
