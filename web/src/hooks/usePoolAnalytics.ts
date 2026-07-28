import { useQuery } from "@tanstack/react-query";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";

import { monadTestnet } from "../config/chain";
import { pairSwapEvent } from "../abi/minimal";
import { contractAbis } from "../lib/contracts";
import {
  bucketSwapVolume,
  createRequestGate,
  interpolateBlockTimestamp,
  pickQuoteToken,
  priceSampleBlocks,
  reservesToPrice,
  swapQuoteVolume,
  volumeChunkRanges,
  VOLUME_BUCKETS,
  type BlockAnchor
} from "../lib/analytics";

export interface PricePoint {
  blockNumber: bigint;
  timestamp: number;
  price: number;
}

export interface VolumeBucket {
  startTimestamp: number;
  endTimestamp: number;
  quoteAmount: bigint;
}

export interface PoolAnalytics {
  /** Index of the quote token in the pair (prices and volume are in this token). */
  quoteIndex: 0 | 1;
  quoteSymbol: string;
  baseSymbol: string;
  quoteDecimals: number;
  /** Price of the base token in quote tokens, oldest first. Empty when the pool had no liquidity. */
  priceSeries: PricePoint[];
  /** Swap volume buckets over the recent log window, oldest first. */
  volumeBuckets: VolumeBucket[];
  /** Total quote-token volume across the window. */
  totalVolume: bigint;
  swapCount: number;
  /** Log-window bounds, for display. */
  volumeFromTimestamp: number;
  volumeToTimestamp: number;
}

export interface PairMetaForAnalytics {
  token0: Address;
  token1: Address;
  symbol0: string;
  symbol1: string;
  decimals0: number;
  decimals1: number;
}

/**
 * One throttle shared by every pool's analytics fetch, so opening several
 * pools quickly still cannot exceed the RPC's measured 15 req/s limit.
 */
const gate = createRequestGate();

async function throttled<T>(fn: () => Promise<T>): Promise<T> {
  await gate();
  return fn();
}

async function fetchPriceSeries(
  client: PublicClient,
  pair: Address,
  headBlock: bigint,
  anchors: [BlockAnchor, BlockAnchor],
  quoteIndex: 0 | 1,
  meta: PairMetaForAnalytics
): Promise<PricePoint[]> {
  const blocks = priceSampleBlocks(headBlock);

  const results = await Promise.all(
    blocks.map((blockNumber) =>
      throttled(() =>
        client.readContract({
          address: pair,
          abi: contractAbis.pair,
          functionName: "getReserves",
          blockNumber
        })
      ).then(
        (reserves) => ({ blockNumber, reserves: reserves as readonly [bigint, bigint, number] }),
        // A failed sample (pruned state, transient error) drops out; the line
        // just has one fewer point.
        () => null
      )
    )
  );

  const points: PricePoint[] = [];
  for (const entry of results) {
    if (!entry) continue;

    const [reserve0, reserve1] = entry.reserves;
    const price =
      quoteIndex === 1
        ? reservesToPrice(reserve0, reserve1, meta.decimals0, meta.decimals1)
        : reservesToPrice(reserve1, reserve0, meta.decimals1, meta.decimals0);
    if (price === null) continue;

    points.push({
      blockNumber: entry.blockNumber,
      timestamp: interpolateBlockTimestamp(entry.blockNumber, anchors[0], anchors[1]),
      price
    });
  }

  return points;
}

async function fetchVolume(
  client: PublicClient,
  pair: Address,
  headBlock: bigint,
  anchors: [BlockAnchor, BlockAnchor],
  quoteIndex: 0 | 1
): Promise<{
  buckets: VolumeBucket[];
  totalVolume: bigint;
  swapCount: number;
  fromBlock: bigint;
  toBlock: bigint;
}> {
  const ranges = volumeChunkRanges(headBlock);
  const fromBlock = ranges[ranges.length - 1].fromBlock;
  const toBlock = ranges[0].toBlock;

  const chunkResults = await Promise.all(
    ranges.map((range) =>
      throttled(() =>
        client.getLogs({
          address: pair,
          event: pairSwapEvent,
          fromBlock: range.fromBlock,
          toBlock: range.toBlock
        })
      ).then(
        (logs) => logs,
        // A failed chunk undercounts that slice of the window instead of
        // failing the whole fetch.
        () => []
      )
    )
  );

  const swaps: Array<{ blockNumber: bigint; quoteAmount: bigint }> = [];
  for (const logs of chunkResults) {
    for (const log of logs) {
      const { amount0In, amount1In, amount0Out, amount1Out } = log.args;
      if (
        log.blockNumber === null ||
        amount0In === undefined ||
        amount1In === undefined ||
        amount0Out === undefined ||
        amount1Out === undefined
      ) {
        continue;
      }

      swaps.push({
        blockNumber: log.blockNumber,
        quoteAmount: swapQuoteVolume(
          { amount0In, amount1In, amount0Out, amount1Out },
          quoteIndex === 0
        )
      });
    }
  }

  const totals = bucketSwapVolume(swaps, fromBlock, toBlock);
  const spanBlocks = toBlock - fromBlock + 1n;

  const buckets: VolumeBucket[] = totals.map((quoteAmount, i) => {
    const bucketFrom = fromBlock + (spanBlocks * BigInt(i)) / BigInt(VOLUME_BUCKETS);
    const bucketTo = fromBlock + (spanBlocks * BigInt(i + 1)) / BigInt(VOLUME_BUCKETS);
    return {
      startTimestamp: interpolateBlockTimestamp(bucketFrom, anchors[0], anchors[1]),
      endTimestamp: interpolateBlockTimestamp(bucketTo, anchors[0], anchors[1]),
      quoteAmount
    };
  });

  return {
    buckets,
    totalVolume: swaps.reduce((sum, swap) => sum + swap.quoteAmount, 0n),
    swapCount: swaps.length,
    fromBlock,
    toBlock
  };
}

/**
 * Lazily loads analytics for one pool. Nothing is fetched until `enabled` is
 * true (the user opened the Analytics section), and results are cached in
 * memory by react-query for the session, so reopening costs zero requests.
 */
export function usePoolAnalytics(
  pairAddress: Address | undefined,
  meta: PairMetaForAnalytics | undefined,
  enabled: boolean
) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["pool-analytics", pairAddress],
    enabled: Boolean(enabled && publicClient && pairAddress && meta),
    staleTime: Infinity,
    gcTime: 30 * 60_000,
    retry: false,
    queryFn: async (): Promise<PoolAnalytics> => {
      if (!publicClient || !pairAddress || !meta) {
        throw new Error("analytics prerequisites missing");
      }

      const headBlock = await throttled(() => publicClient.getBlockNumber());

      // Two real timestamps at the price-window edges anchor every other
      // point by interpolation, instead of one getBlock per sample.
      const sampleBlocks = priceSampleBlocks(headBlock);
      const oldestBlock = sampleBlocks[0];
      const [oldest, newest] = await Promise.all([
        throttled(() => publicClient.getBlock({ blockNumber: oldestBlock })),
        throttled(() => publicClient.getBlock({ blockNumber: headBlock }))
      ]);
      const anchors: [BlockAnchor, BlockAnchor] = [
        { blockNumber: oldestBlock, timestamp: Number(oldest.timestamp) },
        { blockNumber: headBlock, timestamp: Number(newest.timestamp) }
      ];

      const quoteIndex = pickQuoteToken(meta.symbol0, meta.symbol1);

      const [priceSeries, volume] = await Promise.all([
        fetchPriceSeries(publicClient, pairAddress, headBlock, anchors, quoteIndex, meta),
        fetchVolume(publicClient, pairAddress, headBlock, anchors, quoteIndex)
      ]);

      return {
        quoteIndex,
        quoteSymbol: quoteIndex === 0 ? meta.symbol0 : meta.symbol1,
        baseSymbol: quoteIndex === 0 ? meta.symbol1 : meta.symbol0,
        quoteDecimals: quoteIndex === 0 ? meta.decimals0 : meta.decimals1,
        priceSeries,
        volumeBuckets: volume.buckets,
        totalVolume: volume.totalVolume,
        swapCount: volume.swapCount,
        volumeFromTimestamp: interpolateBlockTimestamp(volume.fromBlock, anchors[0], anchors[1]),
        volumeToTimestamp: interpolateBlockTimestamp(volume.toBlock, anchors[0], anchors[1])
      };
    }
  });
}
