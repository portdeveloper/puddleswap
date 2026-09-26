import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { HttpRequestError, type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => mockUsePublicClient(),
  useAccount: () => ({ address: undefined }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({
    children,
    to,
    className,
  }: {
    children: React.ReactNode;
    to: string;
    className?: string;
  }) => createElement("a", { href: to, className }, children),
}));

import { PoolsPage } from "../PoolsPage";

const USDC = "0x00000000000000000000000000000000000000a1" as Address;
const WMON = "0x00000000000000000000000000000000000000a2" as Address;

interface Pair {
  address: Address;
  token0: Address;
  token1: Address;
}

const symbols: Record<string, string> = {
  [USDC]: "USDC",
  [WMON]: "WMON",
};

function createPublicClient(
  pairs: Pair[],
  options?: { pairFails?: (index: number) => boolean },
) {
  const readContract = vi.fn(
    async ({ functionName }: { functionName: string }) => {
      if (functionName === "allPairsLength") return BigInt(pairs.length);
      throw new Error(`unexpected readContract ${functionName}`);
    },
  );

  const multicall = vi.fn(
    async ({
      contracts,
    }: {
      contracts: Array<{
        address: Address;
        functionName: string;
        args?: readonly unknown[];
      }>;
    }) =>
      contracts.map(({ address, functionName, args }) => {
        const byAddress = pairs.find((p) => p.address === address);
        switch (functionName) {
          case "allPairs": {
            const index = Number(args![0]);
            if (options?.pairFails?.(index)) {
              return {
                status: "failure",
                error: new HttpRequestError({ url: "http://rpc.test" }),
              };
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
            return { status: "success", result: symbols[address] ?? "TEST" };
          case "decimals":
            return { status: "success", result: 18 };
          case "getToken": {
            const token = args![0] as Address;
            return {
              status: "success",
              result: { token, isCore: true, active: true },
            };
          }
          default:
            throw new Error(`unexpected multicall ${functionName}`);
        }
      }),
  );

  return { readContract, multicall };
}

function renderPoolsPage(queryClient: QueryClient) {
  function wrapper({ children }: PropsWithChildren) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }
  return render(createElement(PoolsPage), { wrapper });
}

describe("PoolsPage pair enumeration error handling", () => {
  beforeEach(() => {
    mockUsePublicClient.mockReset();
  });

  it("shows the Pools page error rather than 'No pools yet' on initial enumeration failure", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const pairs: Pair[] = [
      {
        address: "0x0000000000000000000000000000000000000001" as Address,
        token0: WMON,
        token1: USDC,
      },
    ];

    const client = createPublicClient(pairs, { pairFails: () => true });
    mockUsePublicClient.mockReturnValue(client);

    renderPoolsPage(queryClient);

    // Error alert must appear
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load pools.",
      );
    });

    // "No pools yet" must NOT appear
    expect(
      screen.queryByText("No pools yet. Be the first to create one!"),
    ).not.toBeInTheDocument();
  });

  it("shows 'No pools yet' when factory genuinely has zero pools", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const client = createPublicClient([]);
    mockUsePublicClient.mockReturnValue(client);

    renderPoolsPage(queryClient);

    await waitFor(() => {
      expect(
        screen.getByText("No pools yet. Be the first to create one!"),
      ).toBeInTheDocument();
    });

    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("preserves the last successful pool list during a failed background refresh while showing the error alert", async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const pairs: Pair[] = [
      {
        address: "0x0000000000000000000000000000000000000001" as Address,
        token0: WMON,
        token1: USDC,
      },
    ];

    let failRefresh = false;
    const client = createPublicClient(pairs, { pairFails: () => failRefresh });
    mockUsePublicClient.mockReturnValue(client);

    renderPoolsPage(queryClient);

    // Initial load succeeds and displays pool row
    await waitFor(() => {
      expect(screen.getByText("WMON / USDC")).toBeInTheDocument();
    });
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(
      screen.queryByText("No pools yet. Be the first to create one!"),
    ).not.toBeInTheDocument();

    // Background refresh fails
    failRefresh = true;
    await queryClient.refetchQueries({ queryKey: ["all-pools", undefined] });

    // Error alert is visible
    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Failed to load pools.",
      );
    });

    // The preserved pool list is still visible
    expect(screen.getByText("WMON / USDC")).toBeInTheDocument();

    // "No pools yet" must still NOT appear
    expect(
      screen.queryByText("No pools yet. Be the first to create one!"),
    ).not.toBeInTheDocument();
  });
});
