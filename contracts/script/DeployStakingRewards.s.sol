// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {Script, console2} from "forge-std/Script.sol";

import {StakingRewards} from "../src/StakingRewards.sol";

interface IUniswapV2Factory {
    function getPair(address tokenA, address tokenB) external view returns (address);
}

/// @notice Deploys a StakingRewards farm for the WMON/USDC LP.
/// @dev Required env: FACTORY_ADDRESS, WMON_ADDRESS, USDC_ADDRESS (all in config/addresses/10143.json).
///      Optional env: ADMIN_ADDRESS (default sender), REWARDS_TOKEN (default WMON), REWARDS_DURATION
///      (default 7 days). Copy the logged address into config/addresses/10143.json then `make sync-artifacts`.
contract DeployStakingRewards is Script {
    error PairNotFound(address tokenA, address tokenB);

    function run() external {
        address admin = vm.envOr("ADMIN_ADDRESS", msg.sender);
        address factory = vm.envAddress("FACTORY_ADDRESS");
        address wmon = vm.envAddress("WMON_ADDRESS");
        address usdc = vm.envAddress("USDC_ADDRESS");
        address rewardsToken = vm.envOr("REWARDS_TOKEN", wmon);
        uint256 rewardsDuration = vm.envOr("REWARDS_DURATION", uint256(7 days));

        address pair = IUniswapV2Factory(factory).getPair(wmon, usdc);
        if (pair == address(0)) {
            revert PairNotFound(wmon, usdc);
        }

        vm.startBroadcast();
        StakingRewards staking = new StakingRewards(admin, rewardsToken, pair, rewardsDuration);
        vm.stopBroadcast();

        console2.log("StakingRewards(WMON/USDC):", address(staking));
        console2.log("  stakingToken (LP pair):", pair);
        console2.log("  rewardsToken:", rewardsToken);
        console2.log("  rewardsDuration:", rewardsDuration);
        console2.log("Next: set config/addresses/10143.json .contracts.stakingRewardsWmonUsdc, then make sync-artifacts");
    }
}
