/**
 * Pool analytics, RPC-only (issue #1).
 *
 * The bounds below come from measuring the default public RPC
 * (testnet-rpc.monad.xyz, July 2026), not guesswork:
 *
 * - eth_getLogs rejects any span wider than 101 blocks ("limited to a 100
 *   range"), and each call takes ~500ms even inside a JSON-RPC batch.
 * - Requests are limited to 15/sec across the connection.
 * - Historical eth_call works fine at archive depth (verified past 10M
 *   blocks), so reserves can be sampled at old blocks directly.
 * - Blocks land roughly every 0.3s, so a day is ~288k blocks.
 *
 * That makes log-derived price history expensive (24h of Sync logs would be
 * ~2850 getLogs calls). Instead price history samples getReserves at a few
 * historical blocks (a Sync event only mirrors reserves, so the curve is the
 * same) and only volume, which exists nowhere in state, reads Swap logs over
 * a short recent window.
 */

/** Widest eth_getLogs span the public RPC accepts, inclusive of both ends. */
export const GETLOGS_MAX_SPAN = 101;

/** Swap-log chunks per volume fetch: 30 x 101 blocks ~= 15 minutes of chain time. */
export const VOLUME_CHUNKS = 30;

/** Bars shown in the volume chart; each covers ~91 seconds of the window. */
export const VOLUME_BUCKETS = 10;

/** Reserve samples for the price line. */
export const PRICE_SAMPLES = 25;

/** Price-history window: ~24h at the measured ~0.3s block time. */
export const PRICE_SPAN_BLOCKS = 288_000;

/** Requests allowed per wave; the RPC caps at 15/sec so stay well under it. */
export const MAX_REQUESTS_PER_WAVE = 10;

/** Wave length in ms. 10 requests per 1.1s leaves headroom for the app's other queries. */
export const WAVE_INTERVAL_MS = 1_100;

export interface BlockRange {
  fromBlock: bigint;
  toBlock: bigint;
}

/**
 * Contiguous getLogs chunks covering the volume window, newest first.
 * Every chunk spans exactly GETLOGS_MAX_SPAN blocks inclusive, the widest
 * request the RPC accepts, so the window costs the minimum number of calls.
 */
export function volumeChunkRanges(
  headBlock: bigint,
  chunkCount = VOLUME_CHUNKS,
  chunkSpan = GETLOGS_MAX_SPAN
): BlockRange[] {
  const span = BigInt(chunkSpan);
  const ranges: BlockRange[] = [];

  for (let i = 0; i < chunkCount; i++) {
    const toBlock = headBlock - span * BigInt(i);
    if (toBlock < 0n) break;
    const fromBlock = toBlock - span + 1n;
    ranges.push({ fromBlock: fromBlock < 0n ? 0n : fromBlock, toBlock });
  }

  return ranges;
}

/**
 * Evenly spaced block numbers for reserve sampling, oldest first, always
 * ending exactly at the head block so the last point is the current price.
 */
export function priceSampleBlocks(
  headBlock: bigint,
  sampleCount = PRICE_SAMPLES,
  spanBlocks = PRICE_SPAN_BLOCKS
): bigint[] {
  const span = headBlock < BigInt(spanBlocks) ? headBlock : BigInt(spanBlocks);
  const steps = BigInt(Math.max(sampleCount - 1, 1));
  const blocks = new Set<bigint>();

  for (let i = 0n; i <= steps; i++) {
    blocks.add(headBlock - span + (span * i) / steps);
  }

  return [...blocks];
}

/**
 * Mid price of the base token denominated in the quote token, from raw
 * reserves. Float math is fine here: this feeds a chart, not a trade.
 * Returns null when either side is empty (pool not yet funded at that block).
 */
export function reservesToPrice(
  baseReserve: bigint,
  quoteReserve: bigint,
  baseDecimals: number,
  quoteDecimals: number
): number | null {
  if (baseReserve <= 0n || quoteReserve <= 0n) {
    return null;
  }

  const base = Number(baseReserve) / 10 ** baseDecimals;
  const quote = Number(quoteReserve) / 10 ** quoteDecimals;
  if (!Number.isFinite(base) || !Number.isFinite(quote) || base === 0) {
    return null;
  }

  return quote / base;
}

export interface SwapAmounts {
  amount0In: bigint;
  amount1In: bigint;
  amount0Out: bigint;
  amount1Out: bigint;
}

/**
 * Quote-token turnover of one Swap. A simple swap has the quote token on
 * exactly one side (in or out), so summing both counts each swap once.
 */
export function swapQuoteVolume(swap: SwapAmounts, quoteIsToken0: boolean): bigint {
  return quoteIsToken0 ? swap.amount0In + swap.amount0Out : swap.amount1In + swap.amount1Out;
}

/**
 * Sums swap volume into bucketCount equal block-range buckets across
 * [fromBlock, toBlock] inclusive. Swaps outside the window are ignored.
 */
export function bucketSwapVolume(
  swaps: Array<{ blockNumber: bigint; quoteAmount: bigint }>,
  fromBlock: bigint,
  toBlock: bigint,
  bucketCount = VOLUME_BUCKETS
): bigint[] {
  const totals: bigint[] = Array.from({ length: bucketCount }, () => 0n);
  const spanBlocks = toBlock - fromBlock + 1n;
  if (spanBlocks <= 0n) {
    return totals;
  }

  for (const swap of swaps) {
    if (swap.blockNumber < fromBlock || swap.blockNumber > toBlock) {
      continue;
    }
    let index = Number(((swap.blockNumber - fromBlock) * BigInt(bucketCount)) / spanBlocks);
    if (index >= bucketCount) {
      index = bucketCount - 1;
    }
    totals[index] += swap.quoteAmount;
  }

  return totals;
}

export interface BlockAnchor {
  blockNumber: bigint;
  timestamp: number;
}

/**
 * Linear timestamp estimate between two real block anchors. Two
 * eth_getBlockByNumber calls at the window edges pin every point in between,
 * instead of one call per sample.
 */
export function interpolateBlockTimestamp(blockNumber: bigint, a: BlockAnchor, b: BlockAnchor): number {
  if (a.blockNumber === b.blockNumber) {
    return a.timestamp;
  }

  const [lo, hi] = a.blockNumber < b.blockNumber ? [a, b] : [b, a];
  const ratio = Number(blockNumber - lo.blockNumber) / Number(hi.blockNumber - lo.blockNumber);
  return Math.round(lo.timestamp + ratio * (hi.timestamp - lo.timestamp));
}

const QUOTE_PRIORITY = ["USDC", "USDT", "WMON"];

/**
 * Which side of the pair to quote prices in: a stable if present, then WMON,
 * else token1. For the core USDC/WMON pool this yields "WMON price in USDC".
 */
export function pickQuoteToken(symbol0: string, symbol1: string): 0 | 1 {
  const s0 = symbol0.toUpperCase();
  const s1 = symbol1.toUpperCase();

  for (const preferred of QUOTE_PRIORITY) {
    if (s0 === preferred) return 0;
    if (s1 === preferred) return 1;
  }

  return 1;
}

/**
 * Shared throttle for analytics traffic. Callers await the returned function
 * before each RPC request; admissions are serialized and at most maxPerWave
 * pass per waveMs window, so concurrent queries cannot pile past the RPC's
 * measured 15 req/s limit.
 */
export function createRequestGate(
  maxPerWave = MAX_REQUESTS_PER_WAVE,
  waveMs = WAVE_INTERVAL_MS
): () => Promise<void> {
  let windowStart = 0;
  let used = 0;
  let tail: Promise<void> = Promise.resolve();

  async function admit(): Promise<void> {
    const now = Date.now();
    if (now - windowStart >= waveMs) {
      windowStart = now;
      used = 0;
    }
    if (used < maxPerWave) {
      used += 1;
      return;
    }

    const waitMs = windowStart + waveMs - now;
    await new Promise((resolve) => setTimeout(resolve, waitMs));
    windowStart = Date.now();
    used = 1;
  }

  return function acquire(): Promise<void> {
    const admitted = tail.then(admit);
    tail = admitted.catch(() => {});
    return admitted;
  };
}
