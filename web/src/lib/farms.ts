import type { Address } from "viem";

import { contractAddresses } from "./contracts";

export interface FarmConfig {
  /** StakingRewards contract address (one instance per farmed pool). */
  stakingRewards: Address;
  /** Human label for the farmed pool, e.g. "WMON / USDC". */
  label: string;
}

/**
 * Farms surfaced on /farm. One entry per deployed StakingRewards contract.
 * Adding a second pool (e.g. WMON/USDT) is just another address in
 * config/addresses/10143.json + another entry here.
 */
export const FARMS: FarmConfig[] = [
  ...(contractAddresses.stakingRewardsWmonUsdc
    ? [{ stakingRewards: contractAddresses.stakingRewardsWmonUsdc, label: "WMON / USDC" }]
    : [])
];

const SECONDS_PER_YEAR = 365 * 24 * 60 * 60;

export interface AprInputs {
  /** Reward tokens emitted over one full rewardsDuration (getRewardForDuration), base units. */
  rewardForDuration: bigint;
  /** Reward period length in seconds. */
  rewardsDuration: bigint;
  /** periodFinish, unix seconds. */
  periodFinish: bigint;
  /** Current time, unix seconds. */
  now: bigint;
  /** LP staked in the farm (farm totalSupply), base units. */
  totalStaked: bigint;
  /** Total LP supply of the underlying pair, base units. */
  pairTotalSupply: bigint;
  /** Reserve of the reward token (e.g. WMON) held in the pair, base units. */
  rewardTokenReserve: bigint;
}

/**
 * Best-effort APR estimate for a farm whose reward token is one side of the staked LP pair.
 *
 * Values both rewards and staked LP in reward-token units: a Uniswap V2 pool is worth ~2x its
 * reward-token reserve, scaled by the staked fraction of total LP supply. Since the annualized
 * reward and the staked value are both denominated in the reward token, decimals cancel.
 *
 * Returns null when rewards have ended/not started or there is nothing to value. Float math is
 * used only at the final ratio, so this is an estimate for display — not an on-chain guarantee.
 */
export function computeFarmApr(inputs: AprInputs): number | null {
  const {
    rewardForDuration,
    rewardsDuration,
    periodFinish,
    now,
    totalStaked,
    pairTotalSupply,
    rewardTokenReserve
  } = inputs;

  if (periodFinish <= now) return null;
  if (
    rewardsDuration === 0n ||
    totalStaked === 0n ||
    pairTotalSupply === 0n ||
    rewardTokenReserve === 0n
  ) {
    return null;
  }

  const annualRewards = Number(rewardForDuration) * (SECONDS_PER_YEAR / Number(rewardsDuration));
  const poolValueInReward = 2 * Number(rewardTokenReserve);
  const stakedValueInReward = poolValueInReward * (Number(totalStaked) / Number(pairTotalSupply));
  if (stakedValueInReward === 0) return null;

  return (annualRewards / stakedValueInReward) * 100;
}
