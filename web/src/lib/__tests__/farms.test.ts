import { describe, expect, it } from "vitest";

import { computeFarmApr, type AprInputs } from "../farms";

const DURATION = 7n * 24n * 60n * 60n; // 7 days in seconds
const E18 = 10n ** 18n;

// All LP staked, reward token = WMON side of the pair.
// Annualized rewards: 7000 WMON / 7 days = 1000/day = 365,000/yr.
// Staked value: ~2 x rewardTokenReserve = 2 x 1,825,000 = 3,650,000 WMON.
// APR = 365,000 / 3,650,000 = 10%.
const base: AprInputs = {
  rewardForDuration: 7_000n * E18,
  rewardsDuration: DURATION,
  periodFinish: 1_000n + DURATION,
  now: 1_000n,
  totalStaked: 1_000n * E18,
  pairTotalSupply: 1_000n * E18,
  rewardTokenReserve: 1_825_000n * E18
};

describe("computeFarmApr", () => {
  it("computes APR when the reward token is one side of the staked LP", () => {
    const apr = computeFarmApr(base);
    expect(apr).not.toBeNull();
    expect(apr as number).toBeCloseTo(10, 4);
  });

  it("doubles APR when only half the LP is staked (same rewards, less value)", () => {
    const apr = computeFarmApr({ ...base, totalStaked: 500n * E18 });
    expect(apr as number).toBeCloseTo(20, 4);
  });

  it("returns null once the reward period has ended", () => {
    expect(computeFarmApr({ ...base, periodFinish: 1_000n, now: 2_000n })).toBeNull();
  });

  it("returns null when nothing is staked", () => {
    expect(computeFarmApr({ ...base, totalStaked: 0n })).toBeNull();
  });

  it("returns null when the reward token is not in the pair (zero reserve)", () => {
    expect(computeFarmApr({ ...base, rewardTokenReserve: 0n })).toBeNull();
  });
});
