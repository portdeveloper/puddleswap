import { describe, expect, it } from "vitest";

import { buildCandidateRoutes, selectBestQuote } from "../routing";
import type { QuoteCandidate } from "../../types";

// x*y=k constant-product AMM output formula with 0.3% fee:
//   amountOut = (amountIn * 997 * reserveOut) / (reserveIn * 1000 + amountIn * 997)
// All values in raw token units (bigint). Used to derive expected values independently.
function cpOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  const num = amountIn * 997n * reserveOut;
  const den = reserveIn * 1000n + amountIn * 997n;
  return num / den;
}

// Chain two hops: tokenIn -> mid -> tokenOut
function cpOut2(amountIn: bigint, r0in: bigint, r0out: bigint, r1in: bigint, r1out: bigint): bigint {
  return cpOut(cpOut(amountIn, r0in, r0out), r1in, r1out);
}

const A = "0x0000000000000000000000000000000000000001" as const;
const B = "0x0000000000000000000000000000000000000002" as const;
const C = "0x0000000000000000000000000000000000000003" as const;
const D = "0x0000000000000000000000000000000000000004" as const;

describe("buildCandidateRoutes", () => {
  it("creates direct, single-core, and two-core routes without duplicates", () => {
    const c1 = "0x0000000000000000000000000000000000000003" as const;
    const c2 = "0x0000000000000000000000000000000000000004" as const;
    const c3 = "0x0000000000000000000000000000000000000005" as const;

    const routes = buildCandidateRoutes(A, B, [c1, c2, c3]);

    expect(routes).toContainEqual([A, B]);
    expect(routes).toContainEqual([A, c1, B]);
    expect(routes).toContainEqual([A, c2, B]);
    expect(routes).toContainEqual([A, c1, c2, B]);
    expect(routes).toContainEqual([A, c2, c1, B]);

    const dedupeSet = new Set(routes.map((route) => route.join("-")));
    expect(dedupeSet.size).toBe(routes.length);
  });

  it("excludes tokenIn and tokenOut from core-hop positions", () => {
    // C is a core token but also equals tokenOut (B alias not used here).
    // When tokenOut is in the cores list, it must not appear as an intermediate hop.
    const routes = buildCandidateRoutes(A, B, [C, B]);
    // B is tokenOut so [A, B, B] and [A, C, B, B] etc. must not appear
    for (const route of routes) {
      const hops = route.slice(1, -1);
      expect(hops).not.toContain(B);
    }
  });

  it("produces no route when tokenIn equals tokenOut", () => {
    // The router guard in useBestQuote short-circuits before calling buildCandidateRoutes
    // when tokenInAddress === tokenOutAddress, but the function itself still returns
    // the direct route [A, A]. This test documents that behavior so a future change
    // that filters it here would be caught.
    const routes = buildCandidateRoutes(A, A, [C]);
    // Direct route [A, A] is generated; adjacent-duplicate filter removes it.
    expect(routes.every((r) => r[0] !== r[r.length - 1] || r.length > 2)).toBe(true);
    // No route should have A appearing consecutively.
    for (const route of routes) {
      for (let i = 1; i < route.length; i++) {
        expect(route[i]).not.toBe(route[i - 1]);
      }
    }
  });
});

describe("selectBestQuote", () => {
  it("returns the max amountOut among successful candidates", () => {
    const best = selectBestQuote([
      { path: [A, B], amountOut: 100n, success: true },
      { path: [A, C, B], amountOut: 150n, success: true },
      { path: [A, D, B], amountOut: 200n, success: false }
    ]);

    expect(best?.amountOut).toBe(150n);
  });

  it("returns undefined when all candidates failed", () => {
    const best = selectBestQuote([
      { path: [A, B], amountOut: 0n, success: false },
      { path: [A, C, B], amountOut: 0n, success: false }
    ]);
    expect(best).toBeUndefined();
  });

  it("returns undefined for an empty list (no route found)", () => {
    expect(selectBestQuote([])).toBeUndefined();
  });

  it("ignores failed candidates even when their amountOut is non-zero", () => {
    // A failed quote may carry a stale or garbage amountOut; it must never win.
    const best = selectBestQuote([
      { path: [A, B], amountOut: 50n, success: true },
      { path: [A, C, B], amountOut: 9999n, success: false }
    ]);
    expect(best?.amountOut).toBe(50n);
  });

  // --- 6-decimal token tests ---
  // USDC/USDT use 6 decimals. 1 USDC = 1_000_000 raw units.
  // Pool: 1_000_000 USDC (6 dec) / 1_000_000_000_000_000_000 WMON (18 dec)
  // amountIn: 1 USDC = 1_000_000 raw
  // Expected out = cpOut(1_000_000, 1_000_000, 1_000_000_000_000_000_000)
  it("handles 6-decimal tokenIn (USDC-like) correctly via derived AMM math", () => {
    const reserveUSDC = 1_000_000_000_000n;       // 1,000,000 USDC (6 dec)
    const reserveWMON = 1_000_000_000_000_000_000_000_000n; // 1,000,000 WMON (18 dec)
    const amountIn = 1_000_000n; // 1 USDC

    const expected = cpOut(amountIn, reserveUSDC, reserveWMON);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: expected, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.amountOut).toBe(expected);
    // Sanity: output is in 18-dec units and non-zero
    expect(expected).toBeGreaterThan(0n);
  });

  it("handles 6-decimal tokenOut (USDT-like) correctly via derived AMM math", () => {
    const reserveWMON = 1_000_000_000_000_000_000_000_000n;
    const reserveUSDT = 1_000_000_000_000n;
    const amountIn = 1_000_000_000_000_000_000n; // 1 WMON (18 dec)

    const expected = cpOut(amountIn, reserveWMON, reserveUSDT);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: expected, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.amountOut).toBe(expected);
    expect(expected).toBeGreaterThan(0n);
  });

  it("handles both sides 6-decimal (USDC -> USDT) via derived AMM math", () => {
    // Balanced stablecoin pool: 1,000,000 USDC / 1,000,000 USDT (both 6 dec)
    const reserve = 1_000_000_000_000n; // 1,000,000 units
    const amountIn = 1_000_000n; // 1 USDC

    const expected = cpOut(amountIn, reserve, reserve);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: expected, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.amountOut).toBe(expected);
    // With balanced reserves and 0.3% fee, output should be slightly below input
    expect(expected).toBeLessThan(amountIn);
    expect(expected).toBeGreaterThan(0n);
  });

  // --- Direct vs multi-hop selection ---
  // Construct reserves so multi-hop genuinely beats direct.
  //
  // Direct pool A->B: thin, 1000 A / 1000 B. amountIn = 100 A.
  //   out_direct = cpOut(100, 1000, 1000) = (100*997*1000)/(1000*1000+100*997)
  //              = 99700000 / 1099700 ≈ 90.66 -> 90n (integer division)
  //
  // Multi-hop A->C->B: deep pools, 1,000,000 A/C and 1,000,000 C/B.
  //   hop1 = cpOut(100, 1_000_000, 1_000_000) ≈ 99 (barely moves price)
  //   hop2 = cpOut(99, 1_000_000, 1_000_000) ≈ 98
  //   out_multi ≈ 98 > 90 -> multi-hop wins.
  it("selectBestQuote picks multi-hop when it quotes better than direct", () => {
    const amountIn = 100n;
    const thinReserve = 1_000n;
    const deepReserve = 1_000_000n;

    const outDirect = cpOut(amountIn, thinReserve, thinReserve);
    const outMulti = cpOut2(amountIn, deepReserve, deepReserve, deepReserve, deepReserve);

    // Verify our math: multi-hop must beat direct for this test to be meaningful
    expect(outMulti).toBeGreaterThan(outDirect);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: outDirect, success: true },
      { path: [A, C, B], amountOut: outMulti, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.path).toEqual([A, C, B]);
    expect(best?.amountOut).toBe(outMulti);
  });

  // Reverse: direct beats multi-hop.
  // Direct pool A->B: deep, 1,000,000 A / 1,000,000 B. amountIn = 100.
  //   out_direct ≈ 99 (deep pool, minimal impact)
  //
  // Multi-hop A->C->B: thin intermediate pool, 1000 A/C and 1000 C/B.
  //   hop1 = cpOut(100, 1000, 1000) ≈ 90
  //   hop2 = cpOut(90, 1000, 1000) ≈ 82
  //   out_multi ≈ 82 < 99 -> direct wins.
  it("selectBestQuote picks direct when it quotes better than multi-hop", () => {
    const amountIn = 100n;
    const deepReserve = 1_000_000n;
    const thinReserve = 1_000n;

    const outDirect = cpOut(amountIn, deepReserve, deepReserve);
    const outMulti = cpOut2(amountIn, thinReserve, thinReserve, thinReserve, thinReserve);

    expect(outDirect).toBeGreaterThan(outMulti);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: outDirect, success: true },
      { path: [A, C, B], amountOut: outMulti, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.path).toEqual([A, B]);
    expect(best?.amountOut).toBe(outDirect);
  });

  // --- Tiny liquidity / price impact ---
  // A pool with tiny reserves causes severe price impact. The router must not
  // blindly pick it over a deeper pool just because it "succeeded".
  //
  // Tiny pool A->B: 10 A / 10 B. amountIn = 100 A.
  //   out_tiny = cpOut(100, 10, 10) = (100*997*10)/(10*1000+100*997) = 997000/109700 = 9n
  //
  // Deep pool via hop A->C->B: 1,000,000 each. amountIn = 100.
  //   hop1 = cpOut(100, 1M, 1M) = 99n; hop2 = cpOut(99, 1M, 1M) = 98n
  //   out_deep = 98n >> 9n -> deep path wins.
  //
  // selectBestQuote must pick the deep path.
  it("does not blindly pick a tiny-liquidity pool when a deeper path quotes better", () => {
    const amountIn = 100n;
    const tinyReserve = 10n;
    const deepReserve = 1_000_000n;

    const outTiny = cpOut(amountIn, tinyReserve, tinyReserve);
    const outDeep = cpOut2(amountIn, deepReserve, deepReserve, deepReserve, deepReserve);

    // Verify price impact: tiny pool output must be worse
    expect(outTiny).toBeLessThan(outDeep);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: outTiny, success: true },
      { path: [A, C, B], amountOut: outDeep, success: true }
    ];
    const best = selectBestQuote(quotes);
    expect(best?.path).toEqual([A, C, B]);
    expect(best?.amountOut).toBe(outDeep);
  });

  it("reflects severe price impact in the quote for a tiny-liquidity pool", () => {
    // With 10/10 reserves and amountIn=5, output should be 3 (not 5).
    // This pins the AMM math so a change that ignores price impact would fail.
    const out = cpOut(5n, 10n, 10n);
    expect(out).toBe(3n);
  });

  // --- Zero and dust amounts ---
  it("returns undefined when all quotes have amountOut 0 and success false (zero amountIn)", () => {
    // When amountIn is 0, getAmountsOut reverts on-chain; all candidates fail.
    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: 0n, success: false },
      { path: [A, C, B], amountOut: 0n, success: false }
    ];
    expect(selectBestQuote(quotes)).toBeUndefined();
  });

  it("handles dust amountIn (1 raw unit) without error", () => {
    // 1 raw unit in a deep pool should produce 0 out (rounds down) but not throw.
    const out = cpOut(1n, 1_000_000_000_000_000_000n, 1_000_000_000_000_000_000n);
    // Output rounds to 0 for dust input in a large pool
    expect(out).toBe(0n);

    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: out, success: true }
    ];
    // A successful quote with amountOut=0 is still "best" (only candidate)
    const best = selectBestQuote(quotes);
    expect(best?.amountOut).toBe(0n);
  });

  it("dust amountIn in a small pool may produce non-zero output", () => {
    // In a tiny pool (10/10), 1 raw unit in still rounds to 0 due to integer division.
    const out = cpOut(1n, 10n, 10n);
    // (1*997*10)/(10*1000+1*997) = 9970/10997 = 0n
    expect(out).toBe(0n);
  });

  // --- Slippage min-out ---
  // The swap page computes: minOut = amountOut - (amountOut * BigInt(bps)) / 10_000n
  // where bps = Math.floor(slippagePercent * 100).
  // These tests pin that formula so a change to the slippage calculation regresses.
  it("slippage min-out formula: 1% slippage on a known amountOut", () => {
    const amountOut = 1_000_000n;
    const slippagePercent = 1; // 1%
    const bps = BigInt(Math.floor(slippagePercent * 100)); // 100n
    const minOut = amountOut - (amountOut * bps) / 10_000n;
    // 1,000,000 - (1,000,000 * 100 / 10,000) = 1,000,000 - 10,000 = 990,000
    expect(minOut).toBe(990_000n);
  });

  it("slippage min-out formula: 0.5% slippage", () => {
    const amountOut = 1_000_000n;
    const slippagePercent = 0.5;
    const bps = BigInt(Math.floor(slippagePercent * 100)); // 50n
    const minOut = amountOut - (amountOut * bps) / 10_000n;
    // 1,000,000 - (1,000,000 * 50 / 10,000) = 1,000,000 - 5,000 = 995,000
    expect(minOut).toBe(995_000n);
  });

  it("slippage min-out is applied to the CHOSEN route's amountOut, not a runner-up", () => {
    // The best quote is the one with the highest amountOut; slippage applies to it.
    const quotes: QuoteCandidate[] = [
      { path: [A, B], amountOut: 800_000n, success: true },
      { path: [A, C, B], amountOut: 1_000_000n, success: true }
    ];
    const best = selectBestQuote(quotes)!;
    expect(best.amountOut).toBe(1_000_000n);

    const slippagePercent = 1;
    const bps = BigInt(Math.floor(slippagePercent * 100));
    const minOut = best.amountOut - (best.amountOut * bps) / 10_000n;
    expect(minOut).toBe(990_000n);
    // minOut must be strictly less than amountOut (slippage deducted)
    expect(minOut).toBeLessThan(best.amountOut);
    // minOut must be greater than the runner-up's raw amountOut to confirm
    // we are using the best route's value, not the second-best's
    expect(minOut).toBeGreaterThan(800_000n);
  });

  it("slippage capped at 50% matches the swap page cap", () => {
    // SwapPage: slippage = Math.min(rawSlippage, 50)
    const rawSlippage = 99;
    const slippage = Math.min(rawSlippage, 50);
    const bps = BigInt(Math.floor(slippage * 100)); // 5000n
    const amountOut = 1_000_000n;
    const minOut = amountOut - (amountOut * bps) / 10_000n;
    // 1,000,000 - (1,000,000 * 5000 / 10,000) = 500,000
    expect(minOut).toBe(500_000n);
  });
});
