import { formatUnits } from "viem";

// Public RPC caps eth_getLogs at a 100-block range per call; the window is a
// fixed constant (not user-adjustable) so this can't be widened into
// something that hammers the RPC.
export const ANALYTICS_WINDOW_BLOCKS = 3000n;
export const LOG_CHUNK_SIZE = 100n;
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
