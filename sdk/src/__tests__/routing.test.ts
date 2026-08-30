import { describe, expect, it } from "vitest";

import {
  applySlippage,
  buildCandidateRoutes,
  selectBestQuote
} from "../routing.js";

const tokenIn = "0x0000000000000000000000000000000000000001";
const tokenOut = "0x0000000000000000000000000000000000000002";
const coreA = "0x0000000000000000000000000000000000000003";
const coreB = "0x0000000000000000000000000000000000000004";
const coreC = "0x0000000000000000000000000000000000000005";

describe("buildCandidateRoutes", () => {
  it("creates direct, three-token, and four-token routes without duplicates", () => {
    const routes = buildCandidateRoutes(tokenIn, tokenOut, [coreA, coreB, coreC]);

    expect(routes).toContainEqual([tokenIn, tokenOut]);
    expect(routes).toContainEqual([tokenIn, coreA, tokenOut]);
    expect(routes).toContainEqual([tokenIn, coreA, coreB, tokenOut]);
    expect(routes).toContainEqual([tokenIn, coreB, coreA, tokenOut]);
    expect(new Set(routes.map((route) => route.join("-"))).size).toBe(routes.length);
  });

  it("does not route through the input or output token", () => {
    const routes = buildCandidateRoutes(tokenIn, tokenOut, [tokenIn, coreA, tokenOut]);

    expect(routes).toEqual([
      [tokenIn, tokenOut],
      [tokenIn, coreA, tokenOut]
    ]);
  });
});

describe("selectBestQuote", () => {
  it("returns the largest successful output and ignores failed routes", () => {
    const best = selectBestQuote([
      { path: [tokenIn, tokenOut], amountOut: 100n, success: true },
      { path: [tokenIn, coreA, tokenOut], amountOut: 150n, success: true },
      { path: [tokenIn, coreB, tokenOut], amountOut: 200n, success: false }
    ]);

    expect(best?.amountOut).toBe(150n);
    expect(best?.path).toEqual([tokenIn, coreA, tokenOut]);
  });

  it("returns undefined when every route fails", () => {
    expect(selectBestQuote([
      { path: [tokenIn, tokenOut], amountOut: 0n, success: false }
    ])).toBeUndefined();
  });
});

describe("applySlippage", () => {
  it("applies a percentage bound in basis points", () => {
    expect(applySlippage(1_000_000n, 0.5)).toBe(995_000n);
    expect(applySlippage(1_000_000n, 50)).toBe(500_000n);
  });
});
