import { decodeFunctionData } from "viem";
import { describe, expect, it } from "vitest";

import { addresses, buildSwapTx, routerAbi } from "../index.js";

const recipient = "0x0000000000000000000000000000000000000001";
const deadline = 2_000_000_000n;

describe("buildSwapTx", () => {
  it("builds a native MON input transaction with value", () => {
    const tx = buildSwapTx({
      tokenIn: "MON",
      tokenOut: addresses.usdc,
      amountIn: 1_000n,
      amountOutMin: 900n,
      path: [addresses.wmon, addresses.usdc],
      recipient,
      deadline
    });
    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.data });

    expect(tx.to).toBe(addresses.router);
    expect(tx.value).toBe(1_000n);
    expect(decoded.functionName).toBe("swapExactETHForTokens");
  });

  it("builds an ERC-20 to native MON transaction without wallet coupling", () => {
    const tx = buildSwapTx({
      tokenIn: addresses.usdc,
      tokenOut: "MON",
      amountIn: 1_000n,
      amountOutMin: 900n,
      path: [addresses.usdc, addresses.wmon],
      recipient,
      deadline
    });
    const decoded = decodeFunctionData({ abi: routerAbi, data: tx.data });

    expect(tx.value).toBeUndefined();
    expect(decoded.functionName).toBe("swapExactTokensForETH");
  });

  it("rejects a route whose endpoints do not match the requested tokens", () => {
    expect(() => buildSwapTx({
      tokenIn: addresses.usdc,
      tokenOut: addresses.wmon,
      amountIn: 1_000n,
      amountOutMin: 900n,
      path: [addresses.testUSDT, addresses.wmon],
      recipient,
      deadline
    })).toThrow("Swap path endpoints");
  });

  it("rejects an empty input amount", () => {
    expect(() => buildSwapTx({
      tokenIn: addresses.usdc,
      tokenOut: addresses.wmon,
      amountIn: 0n,
      amountOutMin: 0n,
      path: [addresses.usdc, addresses.wmon],
      recipient,
      deadline
    })).toThrow("greater than zero");
  });
});
