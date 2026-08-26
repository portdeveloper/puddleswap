import { describe, expect, it } from "vitest";

import {
  chunkBlockRange,
  computeCurrentPrice,
  deriveVolumeBuckets,
  derivePriceSeries,
} from "../poolAnalytics";

describe("chunkBlockRange", () => {
  it("splits an exact multiple of the chunk size into even chunks", () => {
    const chunks = chunkBlockRange(0n, 299n, 100n);

    expect(chunks).toEqual([
      [0n, 99n],
      [100n, 199n],
      [200n, 299n],
    ]);
  });

  it("caps the final chunk at toBlock when the range isn't an exact multiple", () => {
    const chunks = chunkBlockRange(0n, 250n, 100n);

    expect(chunks).toEqual([
      [0n, 99n],
      [100n, 199n],
      [200n, 250n],
    ]);
  });

  it("returns a single chunk when the range is smaller than the chunk size", () => {
    expect(chunkBlockRange(10n, 20n, 100n)).toEqual([[10n, 20n]]);
  });

  it("returns no chunks when fromBlock is after toBlock", () => {
    expect(chunkBlockRange(100n, 50n, 100n)).toEqual([]);
  });
});

describe("computeCurrentPrice", () => {
  it("prices token0 in terms of token1, decimal-adjusted", () => {
    // 100 token0 (18dp) against 200 token1 (18dp) -> 2 token1 per token0.
    const price = computeCurrentPrice(
      100_000_000_000_000_000_000n,
      200_000_000_000_000_000_000n,
      18,
      18,
    );

    expect(price).toBe(2);
  });

  it("accounts for differing decimals between token0 and token1", () => {
    // 1 token0 (6dp, e.g. USDC) against 0.5 token1 (18dp, e.g. WMON).
    const price = computeCurrentPrice(1_000_000n, 500_000_000_000_000_000n, 6, 18);

    expect(price).toBe(0.5);
  });

  it("returns undefined for an empty pool", () => {
    expect(computeCurrentPrice(0n, 0n, 18, 18)).toBeUndefined();
  });
});

describe("derivePriceSeries", () => {
  it("maps each Sync event to a price point, sorted ascending by block", () => {
    const series = derivePriceSeries(
      [
        { blockNumber: 200n, args: { reserve0: 100n, reserve1: 300n } },
        { blockNumber: 100n, args: { reserve0: 100n, reserve1: 200n } },
      ],
      0,
      0,
    );

    expect(series).toEqual([
      { blockNumber: 100n, price: 2 },
      { blockNumber: 200n, price: 3 },
    ]);
  });

  it("drops points from a drained pool (reserve0 = 0) rather than dividing by zero", () => {
    const series = derivePriceSeries(
      [{ blockNumber: 1n, args: { reserve0: 0n, reserve1: 0n } }],
      18,
      18,
    );

    expect(series).toEqual([]);
  });

  it("returns an empty series for no logs", () => {
    expect(derivePriceSeries([], 18, 18)).toEqual([]);
  });
});

describe("deriveVolumeBuckets", () => {
  it("splits the range into the requested number of buckets and sums matching swaps into them", () => {
    const buckets = deriveVolumeBuckets(
      [
        // amount0In > 0: token0 flowed into the pool.
        { blockNumber: 5n, args: { amount0In: 1_000_000n, amount1In: 0n, amount0Out: 0n, amount1Out: 2_000n } },
        // amount0Out > 0: token0 flowed out of the pool.
        { blockNumber: 15n, args: { amount0In: 0n, amount1In: 2_000n, amount0Out: 500_000n, amount1Out: 0n } },
      ],
      0n,
      19n,
      6,
      2,
    );

    expect(buckets).toEqual([
      { fromBlock: 0n, toBlock: 9n, volume: 1 },
      { fromBlock: 10n, toBlock: 19n, volume: 0.5 },
    ]);
  });

  it("returns empty-volume buckets (not an empty array) when there are no swaps", () => {
    const buckets = deriveVolumeBuckets([], 0n, 9n, 18, 2);

    expect(buckets).toEqual([
      { fromBlock: 0n, toBlock: 4n, volume: 0 },
      { fromBlock: 5n, toBlock: 9n, volume: 0 },
    ]);
  });

  it("returns no buckets for an inverted or empty range", () => {
    expect(deriveVolumeBuckets([], 10n, 5n, 18, 2)).toEqual([]);
  });

  it("ignores swaps that fall outside every bucket boundary", () => {
    const buckets = deriveVolumeBuckets(
      [{ blockNumber: 999n, args: { amount0In: 1_000_000n, amount1In: 0n, amount0Out: 0n, amount1Out: 0n } }],
      0n,
      9n,
      18,
      2,
    );

    expect(buckets.reduce((sum, b) => sum + b.volume, 0)).toBe(0);
  });
});
