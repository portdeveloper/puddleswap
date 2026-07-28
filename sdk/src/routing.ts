import type { Address } from "viem";

import type { QuoteCandidate } from "./types";

export function buildCandidateRoutes(tokenIn: Address, tokenOut: Address, cores: Address[]): Address[][] {
  const routes: Address[][] = [[tokenIn, tokenOut]];

  for (const core of cores) {
    if (core !== tokenIn && core !== tokenOut) {
      routes.push([tokenIn, core, tokenOut]);
    }
  }

  for (const coreA of cores) {
    for (const coreB of cores) {
      if (coreA === coreB) {
        continue;
      }
      if (coreA === tokenIn || coreA === tokenOut || coreB === tokenIn || coreB === tokenOut) {
        continue;
      }

      routes.push([tokenIn, coreA, coreB, tokenOut]);
    }
  }

  const deduped: Address[][] = [];
  const seen = new Set<string>();

  for (const route of routes) {
    let hasAdjacentDuplicate = false;
    for (let i = 1; i < route.length; i++) {
      if (route[i] === route[i - 1]) {
        hasAdjacentDuplicate = true;
        break;
      }
    }
    if (hasAdjacentDuplicate) {
      continue;
    }

    const key = route.join("-");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(route);
    }
  }

  return deduped;
}

export function selectBestQuote(quotes: QuoteCandidate[]): QuoteCandidate | undefined {
  let winner: QuoteCandidate | undefined;

  for (const quote of quotes) {
    if (!quote.success) {
      continue;
    }

    if (!winner || quote.amountOut > winner.amountOut) {
      winner = quote;
    }
  }

  return winner;
}

/**
 * Minimum acceptable output for a quote at the given slippage tolerance.
 * Percent is converted to basis points with Math.floor, then deducted with
 * integer bigint math, matching the swap flow in the web app exactly.
 * The caller validates the percent (the app clamps it to 0 < p <= 50).
 */
export function applySlippage(amountOut: bigint, slippagePercent: number): bigint {
  const bps = Math.floor(slippagePercent * 100);
  return amountOut - (amountOut * BigInt(bps)) / 10_000n;
}
