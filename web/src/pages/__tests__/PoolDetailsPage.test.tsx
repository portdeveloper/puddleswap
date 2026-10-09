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
// The LP total-supply query is what issue #47 is about. `supplyFor` answers per
// pair address, so a pair change can be seen to start from no reading.
interface SupplyState {
  data?: bigint;
  isError?: boolean;
}
let supplyState: SupplyState = { data: 10_000n };
let supplyFor: ((pair?: string) => SupplyState) | null = null;
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
      case "lp-total-supply": {
        const state = supplyFor ? supplyFor(queryKey[1] as string | undefined) : supplyState;
        return { ...state, refetch };
      }
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

// A spy rather than a stub: the display tests check which units the page hands
// the analytics scan, because a scan normalised with invented 18s is the bug.
const { mockUsePoolAnalytics } = vi.hoisted(() => ({
  mockUsePoolAnalytics: vi.fn<(pair?: string, decimals0?: number, decimals1?: number) => { data: undefined; isLoading: boolean }>(
    () => ({ data: undefined, isLoading: false })
  ),
}));
vi.mock("../../hooks/usePoolAnalytics", () => ({
  usePoolAnalytics: mockUsePoolAnalytics,
}));

vi.mock("../../hooks/useChainGuard", () => ({
  useChainGuard: () => chainState,
}));

import { PoolDetailsPage } from "../PoolDetailsPage";

function reset() {
  vi.clearAllMocks();
  decimalsState = { data: { token0Decimals: 18, token1Decimals: 18 } };
  decimalsFor = null;
  supplyState = { data: 10_000n };
  supplyFor = null;
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

describe("PoolDetailsPage displayed values (issue #45)", () => {
  beforeEach(reset);

  // The page renders each value as "<span>label</span><strong>value</strong>".
  const valueOf = (label: string) => screen.getAllByText(label).at(-1)!.nextElementSibling!.textContent;
  const lastAnalyticsUnits = () => mockUsePoolAnalytics.mock.calls.at(-1)!.slice(1);

  // The reproduction from the issue: 10 of a 6-decimal token against 10 of an
  // 18-decimal one. With an 18/18 guess Reserve0 read 0.00000000001 and the price
  // 1000000000000.
  const RESERVES_6_18: [bigint, bigint] = [10_000_000n, 10_000_000_000_000_000_000n];

  it("shows reserves and price as unknown, with the reason, while decimals are pending", () => {
    decimalsState = {};
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("reading token decimals…");
    expect(valueOf("Reserve1")).toBe("reading token decimals…");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("reading token decimals…");
    expect(lastAnalyticsUnits()).toEqual([undefined, undefined]);
  });

  it("says the units are unavailable when the decimals read failed", () => {
    decimalsState = { isError: true };
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("token decimals unavailable");
    expect(valueOf("Reserve1")).toBe("token decimals unavailable");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("token decimals unavailable");
    expect(lastAnalyticsUnits()).toEqual([undefined, undefined]);
  });

  it("formats each reserve in its own token's units once both are known (6/18)", () => {
    decimalsState = { data: { token0Decimals: 6, token1Decimals: 18 } };
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("10");
    expect(valueOf("Reserve1")).toBe("10");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("1.000000");
    expect(lastAnalyticsUnits()).toEqual([6, 18]);
  });

  it("treats real zero decimals as known units", () => {
    decimalsState = { data: { token0Decimals: 0, token1Decimals: 18 } };
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: [5n, 5_000_000_000_000_000_000n], totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("5");
    expect(valueOf("Reserve1")).toBe("5");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("1.000000");
    expect(lastAnalyticsUnits()).toEqual([0, 18]);
  });

  it("keeps the last verified units when a background refresh fails", () => {
    decimalsState = { data: { token0Decimals: 6, token1Decimals: 18 }, isError: true };
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("10");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("1.000000");
    expect(lastAnalyticsUnits()).toEqual([6, 18]);
  });

  it("does not carry the previous pair's units to a new pair", () => {
    decimalsFor = (t0) => (t0 === TOKEN0 ? { data: { token0Decimals: 6, token1Decimals: 18 } } : {});
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));
    expect(valueOf("Reserve0")).toBe("10");

    const OTHER0 = "0x00000000000000000000000000000000000000c1" as Address;
    const OTHER1 = "0x00000000000000000000000000000000000000c2" as Address;
    params = { pairAddress: "0x00000000000000000000000000000000000000a2" };
    pairMeta = { token0: OTHER0, token1: OTHER1, reserves: RESERVES_6_18, totalSupply: 10_000n };
    render(React.createElement(PoolDetailsPage));

    expect(valueOf("Reserve0")).toBe("reading token decimals…");
    expect(valueOf("Current Price (Token1 per Token0)")).toBe("reading token decimals…");
    expect(lastAnalyticsUnits()).toEqual([undefined, undefined]);
  });

  it("keeps LP balance at the pair token's fixed 18 decimals with the units unread", () => {
    decimalsState = {};
    render(React.createElement(PoolDetailsPage));
    // lp-balance is mocked as 1_000n wei of an 18-decimal LP token.
    expect(valueOf("Your LP")).toBe("0.000000000000001");
  });
});

describe("PoolDetailsPage remove-liquidity readiness (issue #47)", () => {
  beforeEach(reset);

  // Asymmetric reserves, so a token0/token1 mix-up changes the numbers: 1 LP of
  // 4 is a quarter of each reserve, 250_000 and 750_000, and 98% of those.
  const RESERVES: [bigint, bigint] = [1_000_000n, 3_000_000n];
  const SUPPLY = 4_000_000_000_000_000_000n;

  async function typeLp(value: string) {
    const user = userEvent.setup();
    const lp = screen.getAllByRole("textbox").at(-1)!;
    await user.clear(lp);
    await user.type(lp, value);
    return user;
  }

  async function expectNoRemoval(statusText: RegExp) {
    const user = await typeLp("1");
    expect(screen.getByRole("status")).toHaveTextContent(statusText);
    const btn = screen.getByRole("button", { name: "Remove Liquidity" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  }

  it("sends nothing while the LP total supply is still being read", async () => {
    supplyState = {};
    render(React.createElement(PoolDetailsPage));
    await expectNoRemoval(/reading lp total supply/i);
  });

  it("sends nothing, and says why, when the LP total supply read failed", async () => {
    supplyState = { isError: true };
    render(React.createElement(PoolDetailsPage));
    await expectNoRemoval(/could not read lp total supply/i);
  });

  it("sends nothing when the LP total supply reads as zero", async () => {
    // The old handler took a zero as "skip the share" and sent 1n minimums.
    supplyState = { data: 0n };
    render(React.createElement(PoolDetailsPage));
    await expectNoRemoval(/no lp supply/i);
  });

  it("sends nothing while the pair data itself is unread", async () => {
    pairMeta = undefined;
    render(React.createElement(PoolDetailsPage));
    const user = await typeLp("1");
    const btn = screen.getByRole("button", { name: "Remove Liquidity" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("submits minimums of 98% of this LP amount's share of each reserve", async () => {
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES, totalSupply: SUPPLY };
    supplyState = { data: SUPPLY };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));
    const user = await typeLp("1");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.functionName).toBe("removeLiquidity");
    expect(call.args.slice(2, 5)).toEqual([1_000_000_000_000_000_000n, 245_000n, 735_000n]);
  });

  it("keeps removing on a failed REFETCH, from this pair's earlier reading", async () => {
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES, totalSupply: SUPPLY };
    supplyState = { data: SUPPLY, isError: true };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(PoolDetailsPage));
    const user = await typeLp("1");

    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Remove Liquidity" }));

    expect(mockWriteContractAsync.mock.calls[0][0].args.slice(3, 5)).toEqual([245_000n, 735_000n]);
  });

  it("does not reuse the previous pair's supply when the pair changes", async () => {
    supplyFor = (pair) => (pair === PAIR ? { data: SUPPLY } : {});
    pairMeta = { token0: TOKEN0, token1: TOKEN1, reserves: RESERVES, totalSupply: SUPPLY };
    render(React.createElement(PoolDetailsPage));
    await typeLp("1");
    expect(screen.getByRole("button", { name: "Remove Liquidity" })).toBeEnabled();

    params = { pairAddress: "0x00000000000000000000000000000000000000a2" };
    render(React.createElement(PoolDetailsPage));
    await typeLp("1");

    const buttons = screen.getAllByRole("button", { name: "Remove Liquidity" });
    expect(buttons.at(-1)).toBeDisabled();
    expect(screen.getAllByRole("status").at(-1)).toHaveTextContent(/reading lp total supply/i);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("still gates removal on the chain once the supply IS known", async () => {
    // chain-enforcement.test.tsx mocks every query as `data: undefined`, so the
    // supply clause now disables Remove Liquidity there on its own. Keep the chain
    // clause tested here, where only the wrong chain can disable it.
    chainState = { isCorrectChain: false };
    render(React.createElement(PoolDetailsPage));
    const user = await typeLp("1");

    const btn = screen.getByRole("button", { name: "Remove Liquidity" });
    expect(btn).toBeDisabled();
    await user.click(btn);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });
});
