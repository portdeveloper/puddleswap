import type { Address } from "viem";

import type { QuoteCandidate } from "./types.js";

export function buildCandidateRoutes(
  tokenIn: Address,
  tokenOut: Address,
  cores: readonly Address[]
): Address[][] {
  const routes: Address[][] = [[tokenIn, tokenOut]];
  const inputKey = tokenIn.toLowerCase();
  const outputKey = tokenOut.toLowerCase();

  for (const core of cores) {
    const coreKey = core.toLowerCase();
    if (coreKey !== inputKey && coreKey !== outputKey) {
      routes.push([tokenIn, core, tokenOut]);
    }
  }

  for (const coreA of cores) {
    for (const coreB of cores) {
      const coreAKey = coreA.toLowerCase();
      const coreBKey = coreB.toLowerCase();
      if (
        coreAKey === coreBKey ||
        coreAKey === inputKey ||
        coreAKey === outputKey ||
        coreBKey === inputKey ||
        coreBKey === outputKey
      ) {
        continue;
      }

      routes.push([tokenIn, coreA, coreB, tokenOut]);
    }
  }

  const deduped: Address[][] = [];
  const seen = new Set<string>();

  for (const route of routes) {
    const key = route.map((address) => address.toLowerCase()).join("-");
    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(route);
    }
  }

  return deduped;
}

export function selectBestQuote(
  quotes: readonly QuoteCandidate[]
): QuoteCandidate | undefined {
  let winner: QuoteCandidate | undefined;

  for (const quote of quotes) {
    if (quote.success && (!winner || quote.amountOut > winner.amountOut)) {
      winner = quote;
    }
  }

  return winner;
}

export function applySlippage(
  amountOut: bigint,
  slippagePercent: number
): bigint {
  const bps = Math.floor(slippagePercent * 100);
  return amountOut - (amountOut * BigInt(bps)) / 10_000n;
}
