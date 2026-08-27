import { formatUnits } from "viem";

// Public RPC caps eth_getLogs at a 100-block range per call. Two event types
// (Sync + Swap) are scanned per pool view, so the window is derived from the
// approved total-request bound rather than picked independently — the two
// numbers can't drift out of sync with each other.
export const LOG_CHUNK_SIZE = 100n;
export const LOG_EVENT_TYPE_COUNT = 2; // Sync + Swap
export const MAX_TOTAL_LOG_REQUESTS = 15;
const PER_EVENT_CHUNK_BUDGET = Math.floor(MAX_TOTAL_LOG_REQUESTS / LOG_EVENT_TYPE_COUNT);

// Inclusive block range, so the window spans PER_EVENT_CHUNK_BUDGET full
// chunks: fromBlock..toBlock covers exactly PER_EVENT_CHUNK_BUDGET * LOG_CHUNK_SIZE blocks.
export const ANALYTICS_WINDOW_BLOCKS = BigInt(PER_EVENT_CHUNK_BUDGET) * LOG_CHUNK_SIZE - 1n;

// Real concurrent in-flight eth_getLogs calls, independent of the total
// count above — caps how many requests hit the RPC at once, not just how
// many get made overall.
export const LOG_REQUEST_CONCURRENCY = 3;

export const VOLUME_BUCKET_COUNT = 10;

export type SyncLogLike = {
  blockNumber: bigint;
  args: { reserve0: bigint; reserve1: bigint };
};

export type SwapLogLike = {
  blockNumber: bigint;
  args: {
    amount0In: bigint;
    amount1In: bigint;
    amount0Out: bigint;
    amount1Out: bigint;
  };
};

export type PricePoint = { blockNumber: bigint; price: number };
export type VolumeBucket = { fromBlock: bigint; toBlock: bigint; volume: number };

// Runs `tasks` with at most `concurrency` in flight at once, in original
// order, never throwing — each task's outcome is captured individually so
// one failure doesn't cancel the rest (same contract as Promise.allSettled,
// just throttled).
export async function runWithConcurrencyLimit<T>(
  tasks: Array<() => Promise<T>>,
  concurrency: number,
): Promise<PromiseSettledResult<T>[]> {
  const results: PromiseSettledResult<T>[] = new Array(tasks.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < tasks.length) {
      const i = nextIndex++;
      try {
        const value = await tasks[i]();
        results[i] = { status: "fulfilled", value };
      } catch (reason) {
        results[i] = { status: "rejected", reason };
      }
    }
  }

  const workerCount = Math.max(1, Math.min(concurrency, tasks.length));
  await Promise.all(Array.from({ length: workerCount }, () => worker()));

  return results;
}

export function chunkBlockRange(
  fromBlock: bigint,
  toBlock: bigint,
  chunkSize: bigint,
): Array<[bigint, bigint]> {
  const chunks: Array<[bigint, bigint]> = [];

  if (chunkSize <= 0n || fromBlock > toBlock) {
    return chunks;
  }

  let start = fromBlock;
  while (start <= toBlock) {
    const end = start + chunkSize - 1n > toBlock ? toBlock : start + chunkSize - 1n;
    chunks.push([start, end]);
    start = end + 1n;
  }

  return chunks;
}

export function computeCurrentPrice(
  reserve0: bigint,
  reserve1: bigint,
  decimals0: number,
  decimals1: number,
): number | undefined {
  if (reserve0 === 0n) {
    return undefined;
  }

  const r0 = Number(formatUnits(reserve0, decimals0));
  const r1 = Number(formatUnits(reserve1, decimals1));

  return r0 === 0 ? undefined : r1 / r0;
}

// One point per Sync event (price of token0, denominated in token1).
export function derivePriceSeries(
  syncLogs: SyncLogLike[],
  decimals0: number,
  decimals1: number,
): PricePoint[] {
  return syncLogs
    .filter((log) => log.args.reserve0 > 0n)
    .map((log) => ({
      blockNumber: log.blockNumber,
      price:
        Number(formatUnits(log.args.reserve1, decimals1)) /
        Number(formatUnits(log.args.reserve0, decimals0)),
    }))
    .sort((a, b) => (a.blockNumber < b.blockNumber ? -1 : a.blockNumber > b.blockNumber ? 1 : 0));
}

// Fixed bucket count over [fromBlock, toBlock] so the chart width stays
// stable regardless of how much (or how little) activity there was.
export function deriveVolumeBuckets(
  swapLogs: SwapLogLike[],
  fromBlock: bigint,
  toBlock: bigint,
  decimals0: number,
  bucketCount = VOLUME_BUCKET_COUNT,
): VolumeBucket[] {
  const totalBlocks = toBlock - fromBlock + 1n;

  if (totalBlocks <= 0n || bucketCount <= 0) {
    return [];
  }

  const bucketSize =
    totalBlocks / BigInt(bucketCount) + (totalBlocks % BigInt(bucketCount) > 0n ? 1n : 0n);

  const buckets: VolumeBucket[] = [];
  for (let i = 0; i < bucketCount; i++) {
    const bucketFrom = fromBlock + bucketSize * BigInt(i);
    if (bucketFrom > toBlock) break;

    const bucketTo = bucketFrom + bucketSize - 1n > toBlock ? toBlock : bucketFrom + bucketSize - 1n;
    buckets.push({ fromBlock: bucketFrom, toBlock: bucketTo, volume: 0 });
  }

  for (const log of swapLogs) {
    const bucket = buckets.find(
      (b) => log.blockNumber >= b.fromBlock && log.blockNumber <= b.toBlock,
    );
    if (!bucket) continue;

    // Each Swap moves token0 in exactly one direction; the other side is 0.
    const token0Moved = log.args.amount0In > 0n ? log.args.amount0In : log.args.amount0Out;
    bucket.volume += Number(formatUnits(token0Moved, decimals0));
  }

  return buckets;
}
