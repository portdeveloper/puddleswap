import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import {
  ContractFunctionExecutionError,
  ContractFunctionRevertedError,
  HttpRequestError,
  type Address,
} from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => mockUsePublicClient(),
  useAccount: () => ({ address: undefined }),
}));

import { contractAddresses } from "../../lib/contracts";
import { useAllPools } from "../useAllPools";

const USDC = "0x00000000000000000000000000000000000000a1" as Address;
const WMON = "0x00000000000000000000000000000000000000a2" as Address;
const BUILDER = "0x00000000000000000000000000000000000000b1" as Address;
const BUILDER_TWO = "0x00000000000000000000000000000000000000b2" as Address;
const RETIRED = "0x00000000000000000000000000000000000000c1" as Address;
const STRANGER = "0x00000000000000000000000000000000000000d1" as Address;

// `readFails` models the RPC request itself failing, as opposed to the registry
// reverting for a token it does not know.
type RegistryEntry = { active: boolean; isCore: boolean; readFails?: boolean } | "unregistered";

interface Pair {
  address: Address;
  token0: Address;
  token1: Address;
}

let pairCounter = 0;
function pair(token0: Address, token1: Address): Pair {
  pairCounter += 1;
  const address = `0x${pairCounter.toString(16).padStart(40, "0")}` as Address;
  return { address, token0, token1 };
}

const symbols: Record<string, string> = {
  [USDC]: "USDC",
  [WMON]: "WMON",
  [BUILDER]: "BLD",
  [BUILDER_TWO]: "BLD2",
  [RETIRED]: "OLD",
  [STRANGER]: "ANON",
};

function createPublicClient(pairs: Pair[], registry: Record<string, RegistryEntry>, options?: { pairFails?: (index: number) => boolean }) {
  const readContract = vi.fn(async ({ functionName }: { functionName: string }) => {
    if (functionName === "allPairsLength") return BigInt(pairs.length);
    throw new Error(`unexpected readContract ${functionName}`);
  });

  const multicall = vi.fn(
    async ({ contracts }: { contracts: Array<{ address: Address; functionName: string; args?: readonly unknown[] }> }) =>
      contracts.map(({ address, functionName, args }) => {
        const byAddress = pairs.find((p) => p.address === address);
        switch (functionName) {
          case "allPairs": {
            const index = Number(args![0]);
            if (options?.pairFails?.(index)) {
              return { status: "failure", error: new HttpRequestError({ url: "http://rpc.test" }) };
            }
            return { status: "success", result: pairs[index].address };
          }
          case "token0":
            return { status: "success", result: byAddress!.token0 };
          case "token1":
            return { status: "success", result: byAddress!.token1 };
          case "getReserves":
            return { status: "success", result: [1_000n, 2_000n, 0] };
          case "totalSupply":
            return { status: "success", result: 1_000n };
          case "symbol":
            return { status: "success", result: symbols[address] };
          case "decimals":
            return { status: "success", result: 18 };
          case "getToken": {
            const token = args![0] as Address;
            const entry = registry[token] ?? "unregistered";
            if (entry === "unregistered") {
              // How viem reports a call that reverted inside the multicall.
              const revert = new ContractFunctionRevertedError({ abi: [], functionName: "getToken" });
              const error = new ContractFunctionExecutionError(revert, { abi: [], functionName: "getToken", args: [token] });
              return { status: "failure", error };
            }
            if (entry.readFails) {
              return { status: "failure", error: new HttpRequestError({ url: "http://rpc.test" }) };
            }
            return { status: "success", result: { token, isCore: entry.isCore, active: entry.active } };
          }
          default:
            throw new Error(`unexpected multicall ${functionName}`);
        }
      }),
  );

  return { readContract, multicall };
}

function renderPools() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  function wrapper({ children }: PropsWithChildren) {
    return createElement(QueryClientProvider, { client: queryClient }, children);
  }
  return renderHook(() => useAllPools(), { wrapper });
}

async function loadPools(pairs: Pair[], registry: Record<string, RegistryEntry>, options?: { pairFails?: (index: number) => boolean }) {
  const client = createPublicClient(pairs, registry, options);
  mockUsePublicClient.mockReturnValue(client);
  const { result } = renderPools();
  await waitFor(() => expect(result.current.isPending).toBe(false));
  return { client, result };
}

async function listedPairs(pairs: Pair[], registry: Record<string, RegistryEntry>) {
  const { client, result } = await loadPools(pairs, registry);
  expect(result.current.isSuccess).toBe(true);
  return {
    client,
    names: (result.current.data ?? []).map((p) => `${p.symbol0}/${p.symbol1}`),
  };
}

const coreActive = { active: true, isCore: true };
const basicActive = { active: true, isCore: false };

describe("useAllPools registry eligibility", () => {
  beforeEach(() => {
    mockUsePublicClient.mockReset();
  });

  it("lists a builder's registered token paired with a core token", async () => {
    const { names } = await listedPairs([pair(BUILDER, USDC)], {
      [USDC]: coreActive,
      [BUILDER]: basicActive,
    });
    expect(names).toEqual(["BLD/USDC"]);
  });

  it("keeps core/core pairs", async () => {
    const { names } = await listedPairs([pair(WMON, USDC)], {
      [USDC]: coreActive,
      [WMON]: coreActive,
    });
    expect(names).toEqual(["WMON/USDC"]);
  });

  it("lists two active basic tokens paired together", async () => {
    const { names } = await listedPairs([pair(BUILDER, BUILDER_TWO)], {
      [USDC]: coreActive,
      [BUILDER]: basicActive,
      [BUILDER_TWO]: basicActive,
    });
    expect(names).toEqual(["BLD/BLD2"]);
  });

  it("drops a pair whose token was retired", async () => {
    const { names } = await listedPairs([pair(USDC, RETIRED), pair(WMON, USDC)], {
      [USDC]: coreActive,
      [WMON]: coreActive,
      [RETIRED]: { active: false, isCore: false },
    });
    expect(names).toEqual(["WMON/USDC"]);
  });

  it("drops a pair whose token was never registered", async () => {
    const { names } = await listedPairs([pair(STRANGER, USDC), pair(WMON, USDC)], {
      [USDC]: coreActive,
      [WMON]: coreActive,
    });
    expect(names).toEqual(["WMON/USDC"]);
  });

  it("fails the query when a registry read fails, instead of listing or dropping pools", async () => {
    const { result } = await loadPools([pair(WMON, USDC)], {
      [USDC]: coreActive,
      [WMON]: { ...coreActive, readFails: true },
    });
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("reads each token from the registry once, in a single batch", async () => {
    const { client } = await listedPairs([pair(BUILDER, USDC), pair(WMON, USDC), pair(BUILDER, WMON)], {
      [USDC]: coreActive,
      [WMON]: coreActive,
      [BUILDER]: basicActive,
    });
    const registryBatches = client.multicall.mock.calls.filter(([{ contracts }]) =>
      contracts.some((c) => c.functionName === "getToken"),
    );
    expect(registryBatches).toHaveLength(1);
    const registryCalls = registryBatches[0][0].contracts;
    expect(registryCalls.every((c) => c.address === contractAddresses.tokenRegistry)).toBe(true);
    const readTokens = registryCalls.map((c) => c.args![0]);
    expect(readTokens).toHaveLength(3);
    expect(new Set(readTokens)).toEqual(new Set([BUILDER, USDC, WMON]));
  });
});

describe("useAllPools pair enumeration failure handling", () => {
  beforeEach(() => {
    mockUsePublicClient.mockReset();
  });

  it("fails the query when an entire allPairs batch fails", async () => {
    const { result } = await loadPools(
      [pair(WMON, USDC)],
      { [USDC]: coreActive, [WMON]: coreActive },
      { pairFails: () => true },
    );
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("fails the query when allPairs fails for only some pairs in a batch", async () => {
    const { result } = await loadPools(
      [pair(WMON, USDC), pair(BUILDER, USDC)],
      { [USDC]: coreActive, [WMON]: coreActive, [BUILDER]: basicActive },
      { pairFails: (i) => i === 1 },
    );
    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it("returns an empty list when allPairsLength is genuinely zero", async () => {
    const { result } = await loadPools([], {});
    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toEqual([]);
  });

  it("preserves the last successful pool list during a failed background refresh", async () => {
    let failRefresh = false;
    const { result } = await loadPools(
      [pair(WMON, USDC)],
      { [USDC]: coreActive, [WMON]: coreActive },
      { pairFails: () => failRefresh },
    );

    expect(result.current.isSuccess).toBe(true);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].symbol0).toBe("WMON");

    // Next background fetch fails
    failRefresh = true;
    await result.current.refetch().catch(() => {});

    await waitFor(() => expect(result.current.isError).toBe(true));
    // The previous pool list is preserved rather than dropped to [] or undefined
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].symbol0).toBe("WMON");
  });
});
