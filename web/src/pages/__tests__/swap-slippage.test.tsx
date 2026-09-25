import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { decodeFunctionData } from "viem";

import { monadTestnet } from "../../config/chain";
import { contractAbis, contractAddresses } from "../../lib/contracts";
import type { NativeGasEstimate } from "../../lib/swapBalance";

// --- Mutable query/hook state controlled per test ---
const queryState = {
  monBalance: 5_000_000_000_000_000_000n as bigint | undefined,
  erc20Balance: 5_000_000_000_000_000_000n as bigint | undefined,
  allowance: 10_000_000_000_000_000_000n as bigint,
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
  data: {
    kind: "estimated",
    costWei: 20_000_000_000_000_000n,
  } as NativeGasEstimate | undefined,
};

const sendTransactionAsync = vi.fn();
const nativeGasEstimateSpy = vi.fn();

const mockPublicClient = {
  estimateContractGas: vi.fn().mockResolvedValue(150_000n),
  estimateFeesPerGas: vi.fn().mockResolvedValue({
    maxFeePerGas: 2_000_000_000n,
  }),
  getGasPrice: vi.fn().mockResolvedValue(2_000_000_000n),
  waitForTransactionReceipt: vi.fn().mockResolvedValue({ status: "success" }),
};

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
  usePublicClient: () => mockPublicClient,
  useWriteContract: () => ({ writeContractAsync: vi.fn() }),
  useSendTransaction: () => ({ sendTransactionAsync }),
  useSwitchChain: () => ({ switchChain: vi.fn() }),
  useChainId: () => wagmiState.chain?.id ?? monadTestnet.id,
}));

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
  useNativeSwapGasEstimate: (args: unknown) => {
    nativeGasEstimateSpy(args);
    return {
      data: gasState.data,
      isLoading: false,
    };
  },
}));

const routerState = { searchParams: new URLSearchParams() };
vi.mock("react-router-dom", () => ({
  Link: ({ children, to }: { children: React.ReactNode; to: string }) =>
    React.createElement("a", { href: to }, children),
  useParams: () => ({
    pairAddress: "0x0000000000000000000000000000000000000001",
  }),
  useSearchParams: () => [routerState.searchParams, vi.fn()] as const,
}));

vi.mock("../../components/TokenPicker", () => ({
  TokenPicker: () => null,
}));

import { parseSlippagePercent, SwapPage } from "../SwapPage";

const QUOTED_AMOUNT_OUT = 1_000_000n;

function quoteFixture(path: string[]): NonNullable<typeof quoteState.data> {
  return {
    best: {
      amountOut: QUOTED_AMOUNT_OUT,
      path,
      priceImpactBps: 10,
    },
    amountInRaw: 1_000_000_000_000_000_000n, // 1 token
    decimalsIn: 18,
    decimalsOut: 6,
    quotes: [],
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  wagmiState.isConnected = true;
  wagmiState.chain = { id: monadTestnet.id };
  queryState.monBalance = 5_000_000_000_000_000_000n;
  queryState.erc20Balance = 5_000_000_000_000_000_000n;
  queryState.allowance = 10_000_000_000_000_000_000n;
  gasState.data = {
    kind: "estimated",
    costWei: 20_000_000_000_000_000n,
  };
  sendTransactionAsync.mockResolvedValue(
    "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  );
  routerState.searchParams = new URLSearchParams();
});

describe("parseSlippagePercent", () => {
  it("preserves explicit zero as 0%", () => {
    expect(parseSlippagePercent("0")).toBe(0);
    expect(parseSlippagePercent("0.0")).toBe(0);
    expect(parseSlippagePercent("0.00")).toBe(0);
    expect(parseSlippagePercent(".0")).toBe(0);
    expect(parseSlippagePercent("00")).toBe(0);
    expect(parseSlippagePercent(" 0 ")).toBe(0);
    expect(parseSlippagePercent("-0")).toBe(0);
  });

  it("distinguishes blank input and falls back to 1%", () => {
    expect(parseSlippagePercent("")).toBe(1);
    expect(parseSlippagePercent("   ")).toBe(1);
    expect(parseSlippagePercent("\t\n")).toBe(1);
  });

  it("distinguishes malformed input and falls back to 1%", () => {
    expect(parseSlippagePercent("abc")).toBe(1);
    expect(parseSlippagePercent("NaN")).toBe(1);
    expect(parseSlippagePercent("Infinity")).toBe(1);
    expect(parseSlippagePercent("--")).toBe(1);
    expect(parseSlippagePercent("1..2")).toBe(1);
  });

  it("distinguishes negative input and falls back to 1%", () => {
    expect(parseSlippagePercent("-1")).toBe(1);
    expect(parseSlippagePercent("-0.5")).toBe(1);
    expect(parseSlippagePercent("-0.001")).toBe(1);
  });

  it("preserves ordinary positive values and clamps at 50%", () => {
    expect(parseSlippagePercent("0.5")).toBe(0.5);
    expect(parseSlippagePercent("1")).toBe(1);
    expect(parseSlippagePercent("2.5")).toBe(2.5);
    expect(parseSlippagePercent("50")).toBe(50);
    expect(parseSlippagePercent("50.1")).toBe(50);
    expect(parseSlippagePercent("100")).toBe(50);
  });

  it("handles non-string input safely", () => {
    expect(parseSlippagePercent(undefined as unknown as string)).toBe(1);
    expect(parseSlippagePercent(null as unknown as string)).toBe(1);
  });
});

describe("SwapPage rendered-page slippage regression", () => {
  it("native MON swap: preserves 0% slippage in native gas estimation arguments and submitted transaction", async () => {
    const user = userEvent.setup();
    const wmonAddress = contractAddresses.wmon!;
    const usdtAddress = contractAddresses.testUSDT!;
    quoteState.data = quoteFixture([wmonAddress, usdtAddress]);

    const { container } = render(React.createElement(SwapPage));

    // Initially with default 0.5% slippage, minOut is 995_000n
    expect(nativeGasEstimateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        amountInRaw: quoteState.data.amountInRaw,
        minOut: 995_000n,
      }),
    );

    // Open settings and enter explicit "0"
    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    await user.clear(slippageInput);
    await user.type(slippageInput, "0");

    // Native gas estimation arguments must receive 0% slippage (minOut === quote)
    expect(nativeGasEstimateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({
        enabled: true,
        minOut: QUOTED_AMOUNT_OUT,
      }),
    );

    // Submit the swap
    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;
    expect(swapBtn).toBeEnabled();
    await user.click(swapBtn);

    expect(sendTransactionAsync).toHaveBeenCalledTimes(1);
    const submittedTx = sendTransactionAsync.mock.calls[0][0];

    // Decode submitted transaction calldata
    const decoded = decodeFunctionData({
      abi: contractAbis.router,
      data: submittedTx.data,
    });

    expect(decoded.functionName).toBe("swapExactETHForTokens");
    // swapExactETHForTokens(amountOutMin, path, to, deadline) -> args[0] is amountOutMin
    const amountOutMin = (
      decoded.args as [bigint, string[], string, bigint]
    )[0];
    expect(amountOutMin).toBe(QUOTED_AMOUNT_OUT);
  });

  it("ERC-20 swap path: preserves 0% slippage in submitted transaction", async () => {
    const user = userEvent.setup();
    const usdcAddress = contractAddresses.usdc!;
    const usdtAddress = contractAddresses.testUSDT!;

    routerState.searchParams = new URLSearchParams({
      in: usdcAddress,
      out: usdtAddress,
    });
    quoteState.data = quoteFixture([usdcAddress, usdtAddress]);

    const { container } = render(React.createElement(SwapPage));

    // Open settings and set 0% slippage
    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    await user.clear(slippageInput);
    await user.type(slippageInput, "0");

    // Submit the swap
    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;
    expect(swapBtn).toBeEnabled();
    await user.click(swapBtn);

    expect(sendTransactionAsync).toHaveBeenCalledTimes(1);
    const submittedTx = sendTransactionAsync.mock.calls[0][0];

    const decoded = decodeFunctionData({
      abi: contractAbis.router,
      data: submittedTx.data,
    });

    expect(decoded.functionName).toBe("swapExactTokensForTokens");
    // swapExactTokensForTokens(amountIn, amountOutMin, path, to, deadline) -> args[1] is amountOutMin
    const amountOutMin = (
      decoded.args as [bigint, bigint, string[], string, bigint]
    )[1];
    expect(amountOutMin).toBe(QUOTED_AMOUNT_OUT);
  });

  it("ERC-20 to MON swap path: preserves 0% slippage in submitted transaction", async () => {
    const user = userEvent.setup();
    const usdcAddress = contractAddresses.usdc!;
    const wmonAddress = contractAddresses.wmon!;

    routerState.searchParams = new URLSearchParams({
      in: usdcAddress,
      out: "MON",
    });
    quoteState.data = quoteFixture([usdcAddress, wmonAddress]);

    const { container } = render(React.createElement(SwapPage));

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    await user.clear(slippageInput);
    await user.type(slippageInput, "0");

    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;
    expect(swapBtn).toBeEnabled();
    await user.click(swapBtn);

    expect(sendTransactionAsync).toHaveBeenCalledTimes(1);
    const submittedTx = sendTransactionAsync.mock.calls[0][0];

    const decoded = decodeFunctionData({
      abi: contractAbis.router,
      data: submittedTx.data,
    });

    expect(decoded.functionName).toBe("swapExactTokensForETH");
    // swapExactTokensForETH(amountIn, amountOutMin, path, to, deadline) -> args[1] is amountOutMin
    const amountOutMin = (
      decoded.args as [bigint, bigint, string[], string, bigint]
    )[1];
    expect(amountOutMin).toBe(QUOTED_AMOUNT_OUT);
  });

  it("distinguishes blank, malformed, or negative input without redefining 0%", async () => {
    const user = userEvent.setup();
    const usdcAddress = contractAddresses.usdc!;
    const usdtAddress = contractAddresses.testUSDT!;

    routerState.searchParams = new URLSearchParams({
      in: usdcAddress,
      out: usdtAddress,
    });
    quoteState.data = quoteFixture([usdcAddress, usdtAddress]);

    const { container } = render(React.createElement(SwapPage));

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;

    // Blank input falls back to 1% slippage: 1_000_000n - 1% = 990_000n
    await user.clear(slippageInput);
    await user.click(swapBtn);

    const decodedBlank = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect(
      (decodedBlank.args as [bigint, bigint, string[], string, bigint])[1],
    ).toBe(990_000n);

    // Malformed input ("xyz") falls back to 1% slippage
    sendTransactionAsync.mockClear();
    await user.type(slippageInput, "xyz");
    await user.click(swapBtn);

    const decodedMalformed = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect(
      (decodedMalformed.args as [bigint, bigint, string[], string, bigint])[1],
    ).toBe(990_000n);

    // Negative input ("-5") falls back to 1% slippage
    sendTransactionAsync.mockClear();
    await user.clear(slippageInput);
    await user.type(slippageInput, "-5");
    await user.click(swapBtn);

    const decodedNegative = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect(
      (decodedNegative.args as [bigint, bigint, string[], string, bigint])[1],
    ).toBe(990_000n);
  });

  it("preserves ordinary positive values and respects 50% upper limit clamp", async () => {
    const user = userEvent.setup();
    const usdcAddress = contractAddresses.usdc!;
    const usdtAddress = contractAddresses.testUSDT!;

    routerState.searchParams = new URLSearchParams({
      in: usdcAddress,
      out: usdtAddress,
    });
    quoteState.data = quoteFixture([usdcAddress, usdtAddress]);

    const { container } = render(React.createElement(SwapPage));

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;

    // Ordinary positive value: 2.5% slippage -> 1_000_000n - 2.5% = 975_000n
    await user.clear(slippageInput);
    await user.type(slippageInput, "2.5");
    await user.click(swapBtn);

    const decodedPositive = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect(
      (decodedPositive.args as [bigint, bigint, string[], string, bigint])[1],
    ).toBe(975_000n);

    // Upper limit clamp: 75% clamped to 50% -> 1_000_000n - 50% = 500_000n
    sendTransactionAsync.mockClear();
    await user.clear(slippageInput);
    await user.type(slippageInput, "75");
    await user.click(swapBtn);

    const decodedClamped = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect(
      (decodedClamped.args as [bigint, bigint, string[], string, bigint])[1],
    ).toBe(500_000n);
  });

  it("keeps native gas estimation and submitted transaction on the same parsed setting", async () => {
    const user = userEvent.setup();
    const wmonAddress = contractAddresses.wmon!;
    const usdtAddress = contractAddresses.testUSDT!;
    quoteState.data = quoteFixture([wmonAddress, usdtAddress]);

    const { container } = render(React.createElement(SwapPage));

    const settingsBtn = screen.getByRole("button", { name: "Settings" });
    await user.click(settingsBtn);

    const slippageInput = screen.getByRole("textbox", {
      name: "Slippage tolerance percent",
    });
    const swapBtn = container.querySelector(
      "button.btn-main",
    ) as HTMLButtonElement;

    // Enter 0%: both estimation and submission use 1_000_000n
    await user.clear(slippageInput);
    await user.type(slippageInput, "0");

    expect(nativeGasEstimateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ minOut: 1_000_000n }),
    );

    await user.click(swapBtn);
    const decoded0 = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect((decoded0.args as [bigint, string[], string, bigint])[0]).toBe(
      1_000_000n,
    );

    // Blank: both estimation and submission use 990_000n
    sendTransactionAsync.mockClear();
    await user.clear(slippageInput);

    expect(nativeGasEstimateSpy).toHaveBeenLastCalledWith(
      expect.objectContaining({ minOut: 990_000n }),
    );

    await user.click(swapBtn);
    const decodedBlank = decodeFunctionData({
      abi: contractAbis.router,
      data: sendTransactionAsync.mock.calls[0][0].data,
    });
    expect((decodedBlank.args as [bigint, string[], string, bigint])[0]).toBe(
      990_000n,
    );
  });
});
