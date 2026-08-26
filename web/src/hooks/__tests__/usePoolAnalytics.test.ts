import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { ANALYTICS_WINDOW_BLOCKS, LOG_CHUNK_SIZE, chunkBlockRange } from "../../lib/poolAnalytics";

const mockUsePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

import { usePoolAnalytics } from "../usePoolAnalytics";

const pairAddress = "0x0000000000000000000000000000000000000009" as Address;

function createPublicClient() {
  return {
    getBlockNumber: vi.fn(),
    getLogs: vi.fn(),
  };
}

function renderAnalytics(address: Address | undefined, decimals0 = 18, decimals1 = 18) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }

  return renderHook(() => usePoolAnalytics(address, decimals0, decimals1), { wrapper });
}

describe("usePoolAnalytics", () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  beforeEach(() => {
    publicClient = createPublicClient();
    mockUsePublicClient.mockReturnValue(publicClient);
  });

  it("chunks the fixed window into 100-block eth_getLogs calls and merges results across chunks", async () => {
    const toBlock = 50_000n;
    const fromBlock = toBlock - ANALYTICS_WINDOW_BLOCKS;
    const chunks = chunkBlockRange(fromBlock, toBlock, LOG_CHUNK_SIZE);
    const lastChunk = chunks[chunks.length - 1];

    publicClient.getBlockNumber.mockResolvedValue(toBlock);
    publicClient.getLogs.mockImplementation(
      async ({ event, fromBlock: chunkFrom }: { event: { name: string }; fromBlock: bigint }) => {
        if (event.name === "Sync" && chunkFrom === fromBlock) {
          return [{ blockNumber: fromBlock, args: { reserve0: 100n, reserve1: 200n } }];
        }
        if (event.name === "Swap" && chunkFrom === lastChunk[0]) {
          return [
            {
              blockNumber: lastChunk[1],
              args: {
                amount0In: 1_000_000_000_000_000_000n,
                amount1In: 0n,
                amount0Out: 0n,
                amount1Out: 1n,
              },
            },
          ];
        }
        return [];
      },
    );

    const { result } = renderAnalytics(pairAddress);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(publicClient.getLogs).toHaveBeenCalledTimes(chunks.length * 2);
    expect(result.current.data?.priceSeries).toEqual([{ blockNumber: fromBlock, price: 2 }]);
    expect(
      result.current.data?.volumeBuckets.reduce((sum, bucket) => sum + bucket.volume, 0),
    ).toBe(1);
    expect(result.current.data?.fromBlock).toBe(fromBlock);
    expect(result.current.data?.toBlock).toBe(toBlock);
  });

  it("clamps fromBlock to 0 when the chain is younger than the window", async () => {
    const toBlock = 50n;
    publicClient.getBlockNumber.mockResolvedValue(toBlock);
    publicClient.getLogs.mockResolvedValue([]);

    const { result } = renderAnalytics(pairAddress);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.fromBlock).toBe(0n);
  });

  it("keeps data from chunks that succeed when other chunks fail", async () => {
    const toBlock = 100n;
    publicClient.getBlockNumber.mockResolvedValue(toBlock);
    publicClient.getLogs.mockImplementation(
      async ({ event, fromBlock: chunkFrom }: { event: { name: string }; fromBlock: bigint }) => {
        if (chunkFrom === 0n) {
          throw new Error("rate limited");
        }
        if (event.name === "Sync") {
          return [{ blockNumber: 100n, args: { reserve0: 10n, reserve1: 10n } }];
        }
        return [];
      },
    );

    const { result } = renderAnalytics(pairAddress);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.priceSeries).toEqual([{ blockNumber: 100n, price: 1 }]);
  });

  it("resolves to the empty shape instead of an error state when every log query fails", async () => {
    publicClient.getBlockNumber.mockResolvedValue(500n);
    publicClient.getLogs.mockRejectedValue(new Error("RPC down"));

    const { result } = renderAnalytics(pairAddress);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isError).toBe(false);
    expect(result.current.data?.priceSeries).toEqual([]);
    // Volume buckets are still shelled out from the block range even with no
    // swap data, so the chart renders empty bars rather than nothing.
    expect(
      result.current.data?.volumeBuckets.every((bucket) => bucket.volume === 0),
    ).toBe(true);
    expect(result.current.data?.volumeBuckets.length).toBeGreaterThan(0);
  });

  it("resolves to the empty shape instead of an error state when getBlockNumber itself fails", async () => {
    publicClient.getBlockNumber.mockRejectedValue(new Error("RPC down"));

    const { result } = renderAnalytics(pairAddress);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.isError).toBe(false);
    expect(result.current.data).toEqual({
      priceSeries: [],
      volumeBuckets: [],
      fromBlock: 0n,
      toBlock: 0n,
    });
  });

  it("does not query when there is no pair address", () => {
    renderAnalytics(undefined);

    expect(publicClient.getBlockNumber).not.toHaveBeenCalled();
    expect(publicClient.getLogs).not.toHaveBeenCalled();
  });
});
