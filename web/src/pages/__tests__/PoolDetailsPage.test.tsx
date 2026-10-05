import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { maxUint256, type Address } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

const PAIR = "0x00000000000000000000000000000000000000p1".replace("p", "a") as Address;
const TOKEN0 = "0x00000000000000000000000000000000000000b1" as Address;
const TOKEN1 = "0x00000000000000000000000000000000000000b2" as Address;

const mockWriteContractAsync = vi.fn();

// The decimals query's state is what this issue is about, so tests drive it.
// `decimalsFor` answers per token pair so a pair change can be observed to start
// from no reading rather than inheriting the previous pair's units.
interface DecimalsState {
  data?: { token0Decimals: number; token1Decimals: number };
  isError?: boolean;
}
let decimalsState: DecimalsState = { data: { token0Decimals: 18, token1Decimals: 18 } };
let decimalsFor: ((t0?: string, t1?: string) => DecimalsState) | null = null;
let pairMeta: { token0: Address; token1: Address; reserves: [bigint, bigint]; totalSupply: bigint } | undefined;
let chainState = { isCorrectChain: true };
let params: { pairAddress?: string } = { pairAddress: PAIR };

vi.mock("wagmi", () => ({
  useAccount: () => ({ address: "0x1234567890abcdef1234567890abcdef12345678" }),
  usePublicClient: () => ({}),
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    const refetch = vi.fn();
    switch (queryKey[0]) {
      case "pair-meta":
        return { data: pairMeta, refetch };
      case "pair-token-decimals": {
        const state = decimalsFor
          ? decimalsFor(queryKey[1] as string | undefined, queryKey[2] as string | undefined)
          : decimalsState;
        return { ...state, refetch };
      }
      case "lp-balance":
        return { data: 1_000n, refetch };
      case "lp-total-supply":
        return { data: 10_000n, refetch };
      case "lp-allowance":
        return { data: maxUint256, refetch };
      default:
        return { data: undefined, refetch };
    }
  },
}));

vi.mock("react-router-dom", () => ({
  useParams: () => params,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
}));

vi.mock("react-helmet-async", () => ({
  Helmet: ({ children }: { children?: React.ReactNode }) => React.createElement("div", null, children),
}));

vi.mock("../../components/PoolAnalyticsChart", () => ({
  PoolAnalyticsChart: () => React.createElement("div", { "data-testid": "chart" }),
}));

vi.mock("../../hooks/usePoolAnalytics", () => ({
  usePoolAnalytics: () => ({ data: undefined, isLoading: false }),
}));

vi.mock("../../hooks/useChainGuard", () => ({
  useChainGuard: () => chainState,
}));

import { PoolDetailsPage } from "../PoolDetailsPage";

function reset() {
  vi.clearAllMocks();
  decimalsState = { data: { token0Decimals: 18, token1Decimals: 18 } };
  decimalsFor = null;
  pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: [1_000n, 2_000n], totalSupply: 10_000n };
  chainState = { isCorrectChain: true };
  params = { pairAddress: PAIR };
}

describe("PoolDetailsPage deposit decimals gate", () => {
  beforeEach(reset);

  async function typeDeposits(value: string) {
    const user = userEvent.setup();
    const [a, b] = screen.getAllByRole("textbox");
    await user.clear(a);
    await user.type(a, value);
    await user.clear(b);
    await user.type(b, value);
    return user;
  }

  it("sends no wallet transaction while the token decimals read is pending", async () => {
    decimalsState = {};
    render(React.createElement(PoolDetailsPage));
    const btn = screen.getByRole("button", { name: "Add Liquidity" });
    expect(btn).toBeDisabled();
    await userEvent.setup().click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("sends no wallet transaction, and says why, when the decimals read failed", async () => {
    decimalsState = { isError: true };
    render(React.createElement(PoolDetailsPage));
    expect(screen.getByRole("status")).toHaveTextContent(/could not read token decimals/i);
    const btn = screen.getByRole("button", { name: "Add Liquidity" });
    expect(btn).toBeDisabled();
    await userEvent.setup().click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("does not reuse the previous pair's decimals when the pair changes", async () => {
    // The decimals key is derived from pairMetaQuery.data, so it is a two-step
    // dependency: pair-meta is keyed on pairAddress, and only once it resolves
    // does the decimals key name the new tokens. Answering only for the first
    // pair proves the second starts from no reading rather than inheriting.
    decimalsFor = (t0) =>
      t0 === TOKEN0 ? { data: { token0Decimals: 6, token1Decimals: 6 } } : {};
    render(React.createElement(PoolDetailsPage));
    expect(screen.getByRole("button", { name: "Add Liquidity" })).toBeEnabled();

    const OTHER0 = "0x00000000000000000000000000000000000000c1" as Address;
    const OTHER1 = "0x00000000000000000000000000000000000000c2" as Address;
    params = { pairAddress: "0x00000000000000000000000000000000000000a2" };
    pairMeta = { token0: OTHER0, token1: OTHER1, reserves: [1_000n, 2_000n], totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    const buttons = screen.getAllByRole("button", { name: "Add Liquidity" });
    expect(buttons[buttons.length - 1]).toBeDisabled();
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("submits each deposit in its OWN token's units, not the other's", async () => {
    // Matching decimals cannot tell token0Decimals from token1Decimals, so a
    // swap between them would pass unnoticed. 6 and 18 pins the pairing.
    decimalsState = { data: { token0Decimals: 6, token1Decimals: 18 } };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));
    const user = await typeDeposits("10");

    await user.click(screen.getByRole("button", { name: "Add Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.functionName).toBe("addLiquidity");
    expect(call.args[2]).toBe(10000000n);
    expect(call.args[3]).toBe(10000000000000000000n);
  });

  it("keeps a zero-decimal reading, which is a reading and not a failure", async () => {
    decimalsState = { data: { token0Decimals: 0, token1Decimals: 18 } };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));
    const user = await typeDeposits("10");

    await user.click(screen.getByRole("button", { name: "Add Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.args[2]).toBe(10n);
    expect(call.args[3]).toBe(10000000000000000000n);
  });

  it("leaves remove-liquidity alone: the LP amount still parses at 18", async () => {
    // The issue keeps LP parsing at 18 and the remove flow untouched, so this
    // must work even with the deposit decimals unread.
    decimalsState = {};
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));
    const user = userEvent.setup();

    const lp = screen.getAllByRole("textbox").at(-1)!;
    await user.clear(lp);
    await user.type(lp, "1");

    const remove = screen.getByRole("button", { name: "Remove Liquidity" });
    expect(remove).toBeEnabled();
    await user.click(remove);

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.functionName).toBe("removeLiquidity");
    expect(call.args[2]).toBe(1000000000000000000n);
  });

  it("still gates deposits on the chain once the units ARE known", async () => {
    // chain-enforcement.test.tsx mocks every query as `data: undefined`, so the
    // `!deposits` clause added here disables this button on its own and its
    // chain assertions stop being load-bearing. Keep the chain clause tested:
    // here the decimals are read, so only the wrong chain can disable it.
    decimalsState = { data: { token0Decimals: 6, token1Decimals: 18 } };
    chainState = { isCorrectChain: false };
    render(React.createElement(PoolDetailsPage));
    const user = await typeDeposits("10");

    const btn = screen.getByRole("button", { name: "Add Liquidity" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("explains the disabled deposit even before the pair metadata loads", async () => {
    // The row used to require pairMetaQuery.data, so while the pair itself was
    // loading the button was disabled with nothing saying why. The units are
    // unknown in that state too, which is what the issue asks to surface.
    pairMeta = undefined;
    decimalsState = {};
    render(React.createElement(PoolDetailsPage));

    expect(screen.getByRole("status")).toHaveTextContent(/reading token decimals/i);
    expect(screen.getByRole("button", { name: "Add Liquidity" })).toBeDisabled();
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("keeps depositing on a failed REFETCH, because the cached units are real readings", async () => {
    // `isError` with data present means the refresh failed but this pair's own
    // decimals were read earlier -- the key carries both token addresses, so the
    // cache cannot belong to another pair. Blocking there, or showing the error
    // copy, would refuse a deposit whose units are measured.
    decimalsState = { data: { token0Decimals: 6, token1Decimals: 18 }, isError: true };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    const user = userEvent.setup();
    const [a, b] = screen.getAllByRole("textbox");
    await user.clear(a); await user.type(a, "10");
    await user.clear(b); await user.type(b, "10");
    await user.click(screen.getByRole("button", { name: "Add Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.args[2]).toBe(10000000n);
    expect(call.args[3]).toBe(10000000000000000000n);
  });
});
