import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { getAddress, maxUint256 } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contractAddresses } from "../../lib/contracts";

const mockWriteContractAsync = vi.fn();

// The decimals query's state is what this issue is about, so tests drive it.
// Default stays what the existing tests assumed: both already read as 18.
type DecimalsState = {
  data?: { decimalsA: number; decimalsB: number };
  isError?: boolean;
};
let decimalsState: DecimalsState = { data: { decimalsA: 18, decimalsB: 18 } };
let allowanceState: { allowanceA: bigint; allowanceB: bigint } = {
  allowanceA: maxUint256,
  allowanceB: maxUint256,
};
let chainState = { isCorrectChain: true };
// Lets a test answer per token pair, so a token change can be observed to start
// from no reading rather than inheriting the previous pair's units.
let decimalsFor: ((tokenA: string, tokenB: string) => DecimalsState) | null = null;

vi.mock("wagmi", () => ({
  useAccount: () => ({
    address: "0x1234567890abcdef1234567890abcdef12345678",
  }),
  usePublicClient: () => ({}),
  useWriteContract: () => ({ writeContractAsync: mockWriteContractAsync }),
}));

vi.mock("@tanstack/react-query", () => ({
  useQuery: ({ queryKey }: { queryKey: readonly unknown[] }) => {
    if (queryKey[0] === "pool-decimals") {
      const state = decimalsFor
        ? decimalsFor(String(queryKey[1]), String(queryKey[2]))
        : decimalsState;
      return { ...state, refetch: vi.fn() };
    }
    if (queryKey[0] === "pool-allowances") {
      return { data: allowanceState, refetch: vi.fn() };
    }
    return { data: undefined, refetch: vi.fn() };
  },
}));

vi.mock("../../hooks/useChainGuard", () => ({
  useChainGuard: () => chainState,
}));

vi.mock("../../components/TokenPicker", () => ({
  TokenPicker: ({
    label,
    value,
    onChange,
  }: {
    label: string;
    value: string;
    onChange: (value: string) => void;
  }) =>
    React.createElement("input", {
      "aria-label": label,
      value,
      onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
        onChange(event.target.value),
    }),
}));

vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
}));

import { CreatePoolPage } from "../CreatePoolPage";

describe("CreatePoolPage token identity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decimalsState = { data: { decimalsA: 18, decimalsB: 18 } };
    allowanceState = { allowanceA: maxUint256, allowanceB: maxUint256 };
    chainState = { isCorrectChain: true };
    decimalsFor = null;
  });

  it("keeps liquidity submission enabled for different tokens", () => {
    render(React.createElement(CreatePoolPage));

    expect(
      screen.getByRole("button", { name: "Create / Add Liquidity" }),
    ).toBeEnabled();
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("disables liquidity submission when both tokens have the same address", async () => {
    const user = userEvent.setup();
    render(React.createElement(CreatePoolPage));

    const tokenA = screen.getByRole("textbox", { name: "Token A" });
    const tokenB = screen.getByRole("textbox", { name: "Token B" });
    const submit = screen.getByRole("button", {
      name: "Create / Add Liquidity",
    });

    await user.clear(tokenB);
    await user.type(tokenB, (tokenA as HTMLInputElement).value);

    expect(tokenA).toHaveValue(contractAddresses.usdc);
    expect(submit).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Token A and Token B must be different.",
    );
  });

  it("treats checksum and lowercase forms as the same token", async () => {
    const user = userEvent.setup();
    render(React.createElement(CreatePoolPage));

    const lowercaseAddress = "0x52908400098527886e0f7030069857d2e4169ee7";
    const checksumAddress = getAddress(lowercaseAddress);

    const tokenA = screen.getByRole("textbox", { name: "Token A" });
    const tokenB = screen.getByRole("textbox", { name: "Token B" });
    const submit = screen.getByRole("button", {
      name: "Create / Add Liquidity",
    });

    expect(checksumAddress).not.toBe(lowercaseAddress);

    await user.clear(tokenA);
    await user.type(tokenA, lowercaseAddress);
    await user.clear(tokenB);
    await user.type(tokenB, checksumAddress);

    expect(submit).toBeDisabled();
  });
});

describe("CreatePoolPage token decimals gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    decimalsState = { data: { decimalsA: 18, decimalsB: 18 } };
    allowanceState = { allowanceA: maxUint256, allowanceB: maxUint256 };
    chainState = { isCorrectChain: true };
    decimalsFor = null;
  });

  async function typeAmounts(value: string) {
    const user = userEvent.setup();
    const a = screen.getByRole("textbox", { name: "Amount A" });
    const b = screen.getByRole("textbox", { name: "Amount B" });
    await user.clear(a);
    await user.type(a, value);
    await user.clear(b);
    await user.type(b, value);
    return user;
  }

  it("sends no wallet transaction while the decimals read is still pending", async () => {
    decimalsState = {};
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    const submit = screen.getByRole("button", { name: "Create / Add Liquidity" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("sends no wallet transaction, and says why, when the decimals read failed", async () => {
    decimalsState = { isError: true };
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    expect(screen.getByRole("status")).toHaveTextContent(/could not read decimals/i);
    const submit = screen.getByRole("button", { name: "Create / Add Liquidity" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("offers no approval while the units are unknown, even with a zero allowance", async () => {
    decimalsState = {};
    allowanceState = { allowanceA: 0n, allowanceB: 0n };
    render(React.createElement(CreatePoolPage));
    await typeAmounts("100");

    expect(screen.getByRole("button", { name: "Approve Token A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve Token B" })).toBeDisabled();
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("submits a 6-decimal amount in the token's own units once the read resolves", async () => {
    decimalsState = { data: { decimalsA: 6, decimalsB: 6 } };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    await user.click(screen.getByRole("button", { name: "Create / Add Liquidity" }));

    expect(mockWriteContractAsync).toHaveBeenCalled();
    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.functionName).toBe("addLiquidity");
    // 100 at 6 decimals is 100000000n, not the 100000000000000000000n an
    // assumed 18 produced.
    expect(call.args[2]).toBe(100000000n);
    expect(call.args[3]).toBe(100000000n);
  });

  it("keeps a zero-decimal reading, which is a reading and not a failure", async () => {
    decimalsState = { data: { decimalsA: 0, decimalsB: 0 } };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    await user.click(screen.getByRole("button", { name: "Create / Add Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.args[2]).toBe(100n);
    expect(call.args[3]).toBe(100n);
  });

  it("still gates on the chain once the units ARE known", async () => {
    // chain-enforcement.test.tsx mocks every query as `data: undefined`, so the
    // `!unitsKnown` clause this change added now disables those buttons on its
    // own and its chain assertions pass for the wrong reason. Keep the chain
    // clause load-bearing somewhere: here the decimals are read and the
    // allowance is zero, so only the wrong chain can disable approval.
    decimalsState = { data: { decimalsA: 6, decimalsB: 6 } };
    allowanceState = { allowanceA: 0n, allowanceB: 0n };
    chainState = { isCorrectChain: false };
    render(React.createElement(CreatePoolPage));
    await typeAmounts("100");

    expect(screen.getByRole("button", { name: "Approve Token A" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Approve Token B" })).toBeDisabled();
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("still gates submission on the chain when nothing else would block it", async () => {
    // Same reasoning for the submit button, which needs a different setup: a
    // zero allowance disables it via needsApproval, so the allowance has to be
    // full for the chain clause to be the only thing left holding it.
    decimalsState = { data: { decimalsA: 6, decimalsB: 6 } };
    allowanceState = { allowanceA: maxUint256, allowanceB: maxUint256 };
    chainState = { isCorrectChain: false };
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    const submit = screen.getByRole("button", { name: "Create / Add Liquidity" });
    expect(submit).toBeDisabled();
    await user.click(submit);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("does not reuse the previous pair's units when a token is changed", async () => {
    // The queryKey carries both tokens, so a change is a fresh cache entry with
    // no data. This pins that: the second pair must start from no reading rather
    // than inheriting 6 decimals from the first. It is also why nothing here
    // uses placeholderData -- that would hand the old units to the new pair.
    const OTHER = "0x00000000000000000000000000000000000000ff" as const;
    let firstB = "";
    decimalsFor = (_a, b) => {
      if (!firstB) firstB = b;
      return b === firstB ? { data: { decimalsA: 6, decimalsB: 6 } } : {};
    };
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    const submit = screen.getByRole("button", { name: "Create / Add Liquidity" });
    expect(submit).toBeEnabled();

    const tokenB = screen.getByRole("textbox", { name: "Token B" });
    await user.clear(tokenB);
    await user.type(tokenB, OTHER);

    expect(screen.getByRole("button", { name: "Create / Add Liquidity" })).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent(/reading decimals/i);
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("will not approve a single token before the other is chosen", async () => {
    // Deliberate, user-visible consequence worth pinning. The decimals query is
    // keyed on BOTH tokens and `enabled` only when both are valid, so with one
    // cleared there is no reading and therefore no unit to approve in. On master
    // this button was ENABLED and would have approved parseUnits(amount, 18) on
    // a token whose decimals nobody had read -- which is the defect, not a
    // feature. Requiring both is what the issue asks for ("both selected
    // tokens"), so this is intended rather than incidental.
    decimalsFor = () => ({});
    allowanceState = { allowanceA: 0n, allowanceB: 0n };
    render(React.createElement(CreatePoolPage));
    const user = userEvent.setup();

    await user.clear(screen.getByRole("textbox", { name: "Token B" }));

    expect(screen.getByRole("button", { name: "Approve Token A" })).toBeDisabled();
    expect(mockWriteContractAsync).not.toHaveBeenCalled();
  });

  it("parses each amount in its OWN token's units, not the other's", async () => {
    // Every other case here uses matching decimals (6/6, 0/0, 18/18), which
    // cannot tell decimalsA from decimalsB: parsing amountB with decimalsA left
    // the whole suite green. Asymmetric values pin the pairing.
    decimalsState = { data: { decimalsA: 6, decimalsB: 18 } };
    allowanceState = { allowanceA: maxUint256, allowanceB: maxUint256 };
    mockWriteContractAsync.mockResolvedValue("0xhash");
    render(React.createElement(CreatePoolPage));
    const user = await typeAmounts("100");

    await user.click(screen.getByRole("button", { name: "Create / Add Liquidity" }));

    const call = mockWriteContractAsync.mock.calls[0][0];
    expect(call.functionName).toBe("addLiquidity");
    expect(call.args[2]).toBe(100000000n);
    expect(call.args[3]).toBe(100000000000000000000n);
    // And the displayed figures must use their own token's decimals too.
    // Exact text, not toHaveTextContent: that matches substrings, and the wrong
    // decimals render "100000000000000", which CONTAINS "100" and passed.
    expect(screen.getByText("Parsed A").nextElementSibling?.textContent).toBe("100");
    expect(screen.getByText("Parsed B").nextElementSibling?.textContent).toBe("100");
  });
});
