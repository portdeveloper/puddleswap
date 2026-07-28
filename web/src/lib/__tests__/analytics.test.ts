import { describe, expect, it } from "vitest";

import {
  bucketSwapVolume,
  interpolateBlockTimestamp,
  pickQuoteToken,
  priceSampleBlocks,
  reservesToPrice,
  swapQuoteVolume,
  volumeChunkRanges,
  GETLOGS_MAX_SPAN,
  PRICE_SAMPLES,
  VOLUME_BUCKETS,
  VOLUME_CHUNKS
} from "../analytics";

describe("volumeChunkRanges", () => {
  it("returns the requested number of chunks", () => {
    const ranges = volumeChunkRanges(1000n, 10);
    expect(ranges).toHaveLength(10);
  });

  it("each chunk spans exactly GETLOGS_MAX_SPAN blocks", () => {
    const ranges = volumeChunkRanges(5000n, 5);
    for (const r of ranges) {
      expect(Number(r.toBlock - r.fromBlock + 1n)).toBe(GETLOGS_MAX_SPAN);
    }
  });

  it("chunks are contiguous and non-overlapping, newest first", () => {
    const ranges = volumeChunkRanges(1000n, 5);
    for (let i = 0; i < ranges.length - 1; i++) {
      expect(ranges[i].fromBlock - 1n).toBe(ranges[i + 1].toBlock);
    }
  });

  it("first chunk ends at headBlock", () => {
    const head = 9999n;
    const ranges = volumeChunkRanges(head, 3);
    expect(ranges[0].toBlock).toBe(head);
  });

  it("clamps fromBlock to 0 when head is small", () => {
    const ranges = volumeChunkRanges(50n, 5, GETLOGS_MAX_SPAN);
    for (const r of ranges) {
      expect(r.fromBlock >= 0n).toBe(true);
    }
  });
});

describe("priceSampleBlocks", () => {
  it("returns PRICE_SAMPLES blocks", () => {
    const blocks = priceSampleBlocks(1_000_000n);
    expect(blocks.length).toBe(PRICE_SAMPLES);
  });

  it("last block equals headBlock", () => {
    const head = 500_000n;
    const blocks = priceSampleBlocks(head);
    expect(blocks[blocks.length - 1]).toBe(head);
  });

  it("blocks are strictly increasing", () => {
    const blocks = priceSampleBlocks(1_000_000n);
    for (let i = 1; i < blocks.length; i++) {
      expect(blocks[i] > blocks[i - 1]).toBe(true);
    }
  });

  it("spans the full requested window when head is large enough", () => {
    const head = 1_000_000n;
    const span = 288_000n;
    const blocks = priceSampleBlocks(head);
    expect(blocks[0]).toBe(head - span);
  });

  it("clamps span to headBlock when head is smaller than span", () => {
    const head = 100n;
    const blocks = priceSampleBlocks(head);
    expect(blocks[0] >= 0n).toBe(true);
  });
});

describe("reservesToPrice", () => {
  it("returns quote/base ratio adjusted for decimals", () => {
    // 1 USDC (6 dec) per 1 WMON (18 dec): reserve0=1e6, reserve1=1e18
    const price = reservesToPrice(10n ** 18n, 10n ** 6n, 18, 6);
    expect(price).toBeCloseTo(1, 5);
  });

  it("returns null when base reserve is zero", () => {
    expect(reservesToPrice(0n, 1000n, 18, 6)).toBeNull();
  });

  it("returns null when quote reserve is zero", () => {
    expect(reservesToPrice(1000n, 0n, 18, 6)).toBeNull();
  });

  it("handles asymmetric decimals correctly", () => {
    // 2000 USDC per WMON: 2000e6 USDC, 1e18 WMON
    const price = reservesToPrice(10n ** 18n, 2000n * 10n ** 6n, 18, 6);
    expect(price).toBeCloseTo(2000, 2);
  });
});

describe("swapQuoteVolume", () => {
  it("sums quote-side amounts when quote is token0", () => {
    const vol = swapQuoteVolume(
      { amount0In: 100n, amount1In: 0n, amount0Out: 0n, amount1Out: 50n },
      true
    );
    expect(vol).toBe(100n);
  });

  it("sums quote-side amounts when quote is token1", () => {
    const vol = swapQuoteVolume(
      { amount0In: 0n, amount1In: 200n, amount0Out: 100n, amount1Out: 0n },
      false
    );
    expect(vol).toBe(200n);
  });

  it("returns zero for a zero swap", () => {
    expect(swapQuoteVolume({ amount0In: 0n, amount1In: 0n, amount0Out: 0n, amount1Out: 0n }, true)).toBe(0n);
  });
});

describe("bucketSwapVolume", () => {
  it("returns VOLUME_BUCKETS zeros when there are no swaps", () => {
    const result = bucketSwapVolume([], 0n, 1000n);
    expect(result).toHaveLength(VOLUME_BUCKETS);
    expect(result.every((v) => v === 0n)).toBe(true);
  });

  it("places a swap in the correct bucket", () => {
    // 10 buckets over blocks 0..999; block 500 should land in bucket 5
    const swaps = [{ blockNumber: 500n, quoteAmount: 100n }];
    const result = bucketSwapVolume(swaps, 0n, 999n, 10);
    expect(result[5]).toBe(100n);
  });

  it("places a swap at the last block in the last bucket", () => {
    const swaps = [{ blockNumber: 999n, quoteAmount: 77n }];
    const result = bucketSwapVolume(swaps, 0n, 999n, 10);
    expect(result[9]).toBe(77n);
  });

  it("ignores swaps outside the window", () => {
    const swaps = [
      { blockNumber: 1500n, quoteAmount: 999n },
      { blockNumber: 0n, quoteAmount: 999n }
    ];
    const result = bucketSwapVolume(swaps, 100n, 1000n, 10);
    expect(result.every((v) => v === 0n)).toBe(true);
  });

  it("sums multiple swaps in the same bucket", () => {
    const swaps = [
      { blockNumber: 100n, quoteAmount: 40n },
      { blockNumber: 150n, quoteAmount: 60n }
    ];
    const result = bucketSwapVolume(swaps, 0n, 999n, 10);
    expect(result[1]).toBe(100n);
  });
});

describe("interpolateBlockTimestamp", () => {
  const a = { blockNumber: 0n, timestamp: 1000 };
  const b = { blockNumber: 1000n, timestamp: 2000 };

  it("returns anchor timestamp at anchor block", () => {
    expect(interpolateBlockTimestamp(0n, a, b)).toBe(1000);
    expect(interpolateBlockTimestamp(1000n, a, b)).toBe(2000);
  });

  it("interpolates midpoint correctly", () => {
    expect(interpolateBlockTimestamp(500n, a, b)).toBe(1500);
  });

  it("handles reversed anchor order", () => {
    expect(interpolateBlockTimestamp(500n, b, a)).toBe(1500);
  });

  it("returns anchor timestamp when both anchors are the same block", () => {
    const same = { blockNumber: 100n, timestamp: 9999 };
    expect(interpolateBlockTimestamp(100n, same, same)).toBe(9999);
  });
});

describe("pickQuoteToken", () => {
  it("picks USDC as quote when present", () => {
    expect(pickQuoteToken("WMON", "USDC")).toBe(1);
    expect(pickQuoteToken("USDC", "WMON")).toBe(0);
  });

  it("picks USDT as quote when USDC absent", () => {
    expect(pickQuoteToken("WMON", "USDT")).toBe(1);
  });

  it("picks WMON as quote when no stable present", () => {
    expect(pickQuoteToken("FOO", "WMON")).toBe(1);
    expect(pickQuoteToken("WMON", "BAR")).toBe(0);
  });

  it("falls back to token1 when neither token is preferred", () => {
    expect(pickQuoteToken("FOO", "BAR")).toBe(1);
  });

  it("is case-insensitive", () => {
    expect(pickQuoteToken("wmon", "usdc")).toBe(1);
  });
});

describe("constants", () => {
  it("GETLOGS_MAX_SPAN matches the measured RPC limit", () => {
    expect(GETLOGS_MAX_SPAN).toBe(101);
  });

  it("VOLUME_CHUNKS and PRICE_SAMPLES are positive integers", () => {
    expect(VOLUME_CHUNKS).toBeGreaterThan(0);
    expect(PRICE_SAMPLES).toBeGreaterThan(0);
  });

  it("VOLUME_BUCKETS is positive", () => {
    expect(VOLUME_BUCKETS).toBeGreaterThan(0);
  });
});
