import { createElement, type PropsWithChildren } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { Address } from "viem";
import { BaseError, InsufficientFundsError } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockUsePublicClient = vi.fn();

vi.mock("wagmi", () => ({
  usePublicClient: () => mockUsePublicClient(),
}));

import { useNativeSwapGasEstimate } from "../useNativeSwapGasEstimate";

const account = "0x0000000000000000000000000000000000000001" as Address;
const path: Address[] = [
  "0x0000000000000000000000000000000000000001",
  "0x0000000000000000000000000000000000000002",
];
const amountInRaw = 1_000_000_000_000_000_000n; // 1 MON
const minOut = 500_000_000n;

function createPublicClient() {
  return {
    estimateContractGas: vi.fn(),
    estimateFeesPerGas: vi.fn(),
    getGasPrice: vi.fn(),
  };
}

function renderEstimate(enabled: boolean) {
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
    () =>
      useNativeSwapGasEstimate({
        enabled,
        account,
        amountInRaw,
        path,
        minOut,
      }),
    { wrapper },
  );
}

describe("useNativeSwapGasEstimate", () => {
  let client: ReturnType<typeof createPublicClient>;

  beforeEach(() => {
    client = createPublicClient();
    mockUsePublicClient.mockReturnValue(client);
  });

  it("returns estimated gas cost when fee estimation succeeds", async () => {
    client.estimateContractGas.mockResolvedValue(150_000n);
    client.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: 2_000_000_000n,
    });

    const { result } = renderEstimate(true);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      kind: "estimated",
      costWei: 150_000n * 2_000_000_000n,
    });
  });

  it("falls back to getGasPrice when EIP-1559 is not supported", async () => {
    client.estimateContractGas.mockResolvedValue(150_000n);
    client.estimateFeesPerGas.mockRejectedValue(
      new BaseError("EIP-1559 fees not supported"),
    );
    client.getGasPrice.mockResolvedValue(3_000_000_000n);

    const { result } = renderEstimate(true);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({
      kind: "estimated",
      costWei: 150_000n * 3_000_000_000n,
    });
  });

  it("returns insufficient-funds when the node reports balance too low", async () => {
    client.estimateContractGas.mockRejectedValue(
      new InsufficientFundsError(),
    );

    const { result } = renderEstimate(true);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data).toEqual({ kind: "insufficient-funds" });
  });

  it("returns unavailable with decoded message on other errors", async () => {
    client.estimateContractGas.mockRejectedValue(
      new BaseError("execution reverted: transfer amount exceeds balance"),
    );

    const { result } = renderEstimate(true);

    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data?.kind).toBe("unavailable");
    expect(
      (result.current.data as { kind: string; message: string }).message,
    ).toBeTruthy();
  });

  it("returns undefined data when disabled", () => {
    client.estimateContractGas.mockResolvedValue(150_000n);
    client.estimateFeesPerGas.mockResolvedValue({
      maxFeePerGas: 2_000_000_000n,
    });

    const { result } = renderEstimate(false);

    expect(result.current.data).toBeUndefined();
    expect(client.estimateContractGas).not.toHaveBeenCalled();
  });
});
