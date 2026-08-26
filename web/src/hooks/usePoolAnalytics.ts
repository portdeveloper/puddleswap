import { useQuery } from "@tanstack/react-query";
import { parseAbiItem, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import {
  ANALYTICS_WINDOW_BLOCKS,
  LOG_CHUNK_SIZE,
  chunkBlockRange,
  deriveVolumeBuckets,
  derivePriceSeries,
  type PricePoint,
  type VolumeBucket,
} from "../lib/poolAnalytics";

// Mirrors the Sync/Swap entries in pairAbi (web/src/abi/minimal.ts);
// parseAbiItem gives getLogs a precise literal event type to decode against,
// which getAbiItem from a mixed function+event ABI array doesn't.
const syncEvent = parseAbiItem("event Sync(uint112 reserve0, uint112 reserve1)");
const swapEvent = parseAbiItem(
  "event Swap(address indexed sender, uint256 amount0In, uint256 amount1In, uint256 amount0Out, uint256 amount1Out, address indexed to)",
);

const EMPTY_ANALYTICS: PoolAnalytics = {
  priceSeries: [],
  volumeBuckets: [],
  fromBlock: 0n,
  toBlock: 0n,
};

export type PoolAnalytics = {
  priceSeries: PricePoint[];
  volumeBuckets: VolumeBucket[];
  fromBlock: bigint;
  toBlock: bigint;
};

function isFulfilled<T>(result: PromiseSettledResult<T>): result is PromiseFulfilledResult<T> {
  return result.status === "fulfilled";
}

export function usePoolAnalytics(
  pairAddress: Address | undefined,
  decimals0: number,
  decimals1: number,
) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["pool-analytics", pairAddress, decimals0, decimals1],
    enabled: Boolean(publicClient && pairAddress),
    staleTime: 30_000,
    queryFn: async (): Promise<PoolAnalytics> => {
      if (!publicClient || !pairAddress) {
        return EMPTY_ANALYTICS;
      }

      // Log queries are display-only and must never block the rest of the
      // page (reserves, LP balance, add/remove liquidity) — any failure here,
      // including a dead RPC, degrades to the empty state instead of throwing.
      try {
        const toBlock = await publicClient.getBlockNumber();
        const fromBlock = toBlock > ANALYTICS_WINDOW_BLOCKS ? toBlock - ANALYTICS_WINDOW_BLOCKS : 0n;
        const chunks = chunkBlockRange(fromBlock, toBlock, LOG_CHUNK_SIZE);

        const [syncResults, swapResults] = await Promise.all([
          Promise.allSettled(
            chunks.map(([chunkFrom, chunkTo]) =>
              publicClient.getLogs({
                address: pairAddress,
                event: syncEvent,
                fromBlock: chunkFrom,
                toBlock: chunkTo,
                strict: true,
              }),
            ),
          ),
          Promise.allSettled(
            chunks.map(([chunkFrom, chunkTo]) =>
              publicClient.getLogs({
                address: pairAddress,
                event: swapEvent,
                fromBlock: chunkFrom,
                toBlock: chunkTo,
                strict: true,
              }),
            ),
          ),
        ]);

        const syncLogs = syncResults.filter(isFulfilled).flatMap((result) => result.value);
        const swapLogs = swapResults.filter(isFulfilled).flatMap((result) => result.value);

        return {
          priceSeries: derivePriceSeries(syncLogs, decimals0, decimals1),
          volumeBuckets: deriveVolumeBuckets(swapLogs, fromBlock, toBlock, decimals0),
          fromBlock,
          toBlock,
        };
      } catch (error) {
        console.error("Pool analytics fetch failed", error);
        return EMPTY_ANALYTICS;
      }
    },
  });
}
