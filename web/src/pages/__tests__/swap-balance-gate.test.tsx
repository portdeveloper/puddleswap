import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

import { monadTestnet } from "../../config/chain";
import type { NativeGasEstimate } from "../../lib/swapBalance";

// --- Mutable query/hook state controlled per test ---
const queryState = {
  monBalance: undefined as bigint | undefined,
  erc20Balance: undefined as bigint | undefined,
  allowance: 0n as bigint,
};
const quoteState = {
  data: undefined as
    | {
        best: { amountOut: bigint; path: string[]; priceImpactBps?: number };
        amountInRaw: bigint;
        decimalsIn: number;
        decimalsOut: number;
        quotes: unknown[];
      }
    | undefined,
};
const gasState = {
  data: undefined as NativeGasEstimate | undefined,
};
const sendTransactionAsync = vi.fn();

const wagmiState = {
  address: "0x1234567890abcdef1234567890abcdef12345678" as const,
  isConnected: true,
  chain: { id: monadTestnet.id } as { id: number } | undefined,
  connectors: [{ id: "injected", name: "MetaMask" }],
};

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: wagmiState.address,
    isConnected: wagmiState.isConnected,
    chain: wagmiState.chain,
  }),
  useConnect: () => ({
    connect: vi.fn(),
    connectors: wagmiState.connectors,
  }),
  useDisconnect: () => ({ disconnect: vi.fn() }),
  usePublicClient: () => null,
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
  useChainId: () => wagmiState.chain?.id ?? monadTestnet.id,
}));

// Distinguish balance/allowance/other queries by queryKey.
vi.mock("@tanstack/react-query", () => ({
  useQuery: (options: { queryKey: readonly unknown[] }) => {
    const key = options.queryKey[0];
    if (key === "balance") {
      const second = options.queryKey[1];
      if (second === "native-mon") {
        return { data: queryState.monBalance, refetch: vi.fn() };
      }
      return { data: queryState.erc20Balance, refetch: vi.fn() };
    }
    if (key === "allowance") {
      return { data: queryState.allowance, refetch: vi.fn() };
    }
    return { data: undefined, refetch: vi.fn() };
  },
  useQueryClient: () => ({}),
}));

vi.mock("../../hooks/useCoreTokens", () => ({
  useCoreTokens: () => ({ data: [] }),
}));
vi.mock("../../hooks/useBestQuote", () => ({
  useBestQuote: () => ({ data: quoteState.data, refetch: vi.fn() }),
}));
vi.mock("../../hooks/useTokenMeta", () => ({
  useTokenMeta: () => ({ data: undefined }),
}));
vi.mock("../../hooks/useNativeSwapGasEstimate", () => ({
  useNativeSwapGasEstimate: () => ({
    data: gasState.data,
    isLoading: false,
  }),
}));

const routerState = { searchParams: new URLSearchParams() };
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
  useParams: () => ({ pairAddress: "0x0000000000000000000000000000000000000001" }),
  useSearchParams: () =>
    [routerState.searchParams, vi.fn()] as const,
}));

vi.mock("../../components/TokenPicker", () => ({
  TokenPicker: () => null,
}));

import { SwapPage } from "../SwapPage";

function quoteFixture(): NonNullable<typeof quoteState.data> {
  return {
    best: {
      amountOut: 1_000_000n,
      path: [
        "0x0000000000000000000000000000000000000001",
        "0x0000000000000000000000000000000000000002",
      ],
      priceImpactBps: 10,
    },
    amountInRaw: 1_000_000_000_000_000_000n, // 1 MON
    decimalsIn: 18,
    decimalsOut: 6,
    quotes: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  wagmiState.isConnected = true;
  wagmiState.chain = { id: monadTestnet.id };
  queryState.monBalance = undefined;
  queryState.erc20Balance = undefined;
  queryState.allowance = 0n;
  quoteState.data = quoteFixture();
  gasState.data = undefined;
  routerState.searchParams = new URLSearchParams();
});

describe("SwapPage balance/gas submission gate", () => {
  it("blocks native swap while balance read is unavailable", async () => {
    // monBalance undefined + quote present + gas estimate present → balance-unavailable
    gasState.data = { kind: "estimated", costWei: 20_000_000_000_000_000n };

    const { container } = render(React.createElement(SwapPage));
    const btn = container.querySelector("button.btn-main") as HTMLButtonElement;

    expect(btn).toHaveTextContent("Balance unavailable");
    expect(btn).toBeDisabled();

    await userEvent.click(btn);
    expect(sendTransactionAsync).not.toHaveBeenCalled();
  });

  it("blocks native swap while gas estimate is still loading", () => {
    queryState.monBalance = 5_000_000_000_000_000_000n;
    gasState.data = undefined;

    const { container } = render(React.createElement(SwapPage));
    const btn = container.querySelector("button.btn-main") as HTMLButtonElement;

    expect(btn).toHaveTextContent("Estimating gas…");
    expect(btn).toBeDisabled();
  });

  it("blocks native swap when gas estimate is unavailable", () => {
    queryState.monBalance = 5_000_000_000_000_000_000n;
    gasState.data = { kind: "unavailable", message: "RPC error" };

    const { container } = render(React.createElement(SwapPage));
    const btn = container.querySelector("button.btn-main") as HTMLButtonElement;

    expect(btn).toHaveTextContent("Gas estimate unavailable");
    expect(btn).toBeDisabled();
  });

  it("enables native swap when balance and estimate are both ready", () => {
    queryState.monBalance = 5_000_000_000_000_000_000n;
    gasState.data = { kind: "estimated", costWei: 20_000_000_000_000_000n };

    const { container } = render(React.createElement(SwapPage));
    const btn = container.querySelector("button.btn-main") as HTMLButtonElement;

    expect(btn).toHaveTextContent("Swap");
    expect(btn).not.toBeDisabled();
  });

  it("ERC-20: does not show Balance unavailable when balance is still loading", () => {
    // tokenIn defaults after URL resolve; force USDC as input
    routerState.searchParams = new URLSearchParams({
      in: "0x0000000000000000000000000000000000000001",
      out: "MON",
    });
    queryState.erc20Balance = undefined;
    queryState.allowance = 1_000_000_000_000_000_000n; // enough allowance → not needsApproval

    const { container } = render(React.createElement(SwapPage));
    const btn = container.querySelector("button.btn-main") as HTMLButtonElement;

    // ERC-20 loading balance is "ok" → not blocked by balance-unavailable.
    // Without an allowance shortfall and with a quote, the button should not
    // show the native Balance unavailable label.
    expect(btn).not.toHaveTextContent("Balance unavailable");
  });
});
