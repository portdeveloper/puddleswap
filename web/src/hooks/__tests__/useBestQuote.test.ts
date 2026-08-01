import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

import { useBestQuote } from "../useBestQuote";

const tokenIn = "0x0000000000000000000000000000000000000001" as Address;
const tokenOut = "0x0000000000000000000000000000000000000002" as Address;
const core = "0x0000000000000000000000000000000000000003" as Address;

function createPublicClient() {
  return {
    readContract: vi.fn(),
    multicall: vi.fn(),
  };
}

function renderQuote(
  tokenInValue: string,
  tokenOutValue: string,
  amountIn: string,
  cores: Address[],
) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  function wrapper({ children }: PropsWithChildren) {
    return createElement(
      QueryClientProvider,
      { client: queryClient },
      children,
    );
  }

  return renderHook(
    () => useBestQuote(tokenInValue, tokenOutValue, amountIn, cores),
    { wrapper },
  );
}

describe("useBestQuote", () => {
  let publicClient: ReturnType<typeof createPublicClient>;

  beforeEach(() => {
    publicClient = createPublicClient();
    mockUsePublicClient.mockReturnValue(publicClient);
  });

  it("parses six-decimal input and selects a better multi-hop quote over a price-impacted direct pool", async () => {
    publicClient.readContract
      .mockResolvedValueOnce(6)
      .mockResolvedValueOnce(18);
    publicClient.multicall.mockResolvedValue([
      { status: "success", result: [1_250_000n, 800_000_000_000_000_000n] },
      { status: "success", result: [1_250_000n, 950_000_000_000_000_000n] },
    ]);

    const { result } = renderQuote(tokenIn, tokenOut, "1.25", [core]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(publicClient.multicall).toHaveBeenCalledWith(
      expect.objectContaining({
        contracts: expect.arrayContaining([
          expect.objectContaining({ args: [1_250_000n, [tokenIn, tokenOut]] }),
          expect.objectContaining({
            args: [1_250_000n, [tokenIn, core, tokenOut]],
          }),
        ]),
      }),
    );
    expect(result.current.data).toMatchObject({
      decimalsIn: 6,
      decimalsOut: 18,
      amountInRaw: 1_250_000n,
    });
    expect(result.current.data?.best?.path).toEqual([tokenIn, core, tokenOut]);
    expect(result.current.data?.best?.amountOut).toBe(950_000_000_000_000_000n);
  });

  it("quotes the smallest representable six-decimal amount", async () => {
    publicClient.readContract.mockResolvedValueOnce(6).mockResolvedValueOnce(6);
    publicClient.multicall.mockResolvedValue([
      { status: "success", result: [1n, 1n] },
      { status: "failure" },
    ]);

    const { result } = renderQuote(tokenIn, tokenOut, "0.000001", [core]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.amountInRaw).toBe(1n);
    expect(result.current.data?.best?.amountOut).toBe(1n);
  });

  it("returns no best quote when every route fails", async () => {
    publicClient.readContract
      .mockResolvedValueOnce(18)
      .mockResolvedValueOnce(18);
    publicClient.multicall.mockResolvedValue([
      { status: "failure" },
      { status: "failure" },
    ]);

    const { result } = renderQuote(tokenIn, tokenOut, "1", [core]);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data?.quotes).toHaveLength(2);
    expect(result.current.data?.best).toBeUndefined();
  });

  it("does not request a quote for zero input or the same token", () => {
    renderQuote(tokenIn, tokenOut, "0", [core]);
    renderQuote(tokenIn, tokenIn, "1", [core]);

    expect(publicClient.readContract).not.toHaveBeenCalled();
    expect(publicClient.multicall).not.toHaveBeenCalled();
  });
});
