import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { getAddress, maxUint256 } from "viem";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { contractAddresses } from "../../lib/contracts";

const mockWriteContractAsync = vi.fn();

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
      return { data: { decimalsA: 18, decimalsB: 18 }, refetch: vi.fn() };
    }
    if (queryKey[0] === "pool-allowances") {
      return {
        data: { allowanceA: maxUint256, allowanceB: maxUint256 },
        refetch: vi.fn(),
      };
    }
    return { data: undefined, refetch: vi.fn() };
  },
}));

vi.mock("../../hooks/useChainGuard", () => ({
  useChainGuard: () => ({ isCorrectChain: true }),
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
