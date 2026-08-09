import { useQuery } from "@tanstack/react-query";
import { isAddress, parseUnits, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { contractAbis, contractAddresses, multicall3Address } from "../lib/contracts";
import { buildCandidateRoutes, selectBestQuote } from "../lib/routing";
import type { QuoteCandidate } from "../types";

const MON_TOKEN = "MON";

export function useBestQuote(tokenIn: string, tokenOut: string, amountIn: string, coreTokens: Address[]) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const tokenInIsMon = tokenIn === MON_TOKEN;
  const tokenOutIsMon = tokenOut === MON_TOKEN;
  const tokenInAddress = tokenInIsMon ? contractAddresses.wmon : (tokenIn as Address);
  const tokenOutAddress = tokenOutIsMon ? contractAddresses.wmon : (tokenOut as Address);

  return useQuery({
    queryKey: ["best-quote", tokenIn, tokenOut, amountIn, coreTokens],
    enabled: Boolean(
      publicClient &&
        contractAddresses.uniswapV2Router02 &&
        (tokenInIsMon || isAddress(tokenIn)) &&
        (tokenOutIsMon || isAddress(tokenOut)) &&
        tokenInAddress &&
        tokenOutAddress &&
        tokenIn !== tokenOut &&
        /^\d*\.?\d+$/.test(amountIn) && Number(amountIn) > 0
    ),
    refetchInterval: 6_000,
    queryFn: async () => {
      if (
        !publicClient ||
        !contractAddresses.uniswapV2Router02 ||
        !(tokenInIsMon || isAddress(tokenIn)) ||
        !(tokenOutIsMon || isAddress(tokenOut)) ||
        !tokenInAddress ||
        !tokenOutAddress ||
        tokenIn === tokenOut
      ) {
        return {
          quotes: [] as QuoteCandidate[],
          best: undefined,
          decimalsIn: 18,
          decimalsOut: 18,
          amountInRaw: 0n
        };
      }

      if (tokenInAddress === tokenOutAddress) {
        return {
          quotes: [] as QuoteCandidate[],
          best: undefined,
          decimalsIn: 18,
          decimalsOut: 18,
          amountInRaw: 0n
        };
      }

      const [decimalsInRaw, decimalsOutRaw] = await Promise.all([
        tokenInIsMon
          ? Promise.resolve(18)
          : publicClient.readContract({
              address: tokenInAddress,
              abi: contractAbis.erc20,
              functionName: "decimals"
            }),
        tokenOutIsMon
          ? Promise.resolve(18)
          : publicClient.readContract({
              address: tokenOutAddress,
              abi: contractAbis.erc20,
              functionName: "decimals"
            })
      ]);

      const decimalsIn = Number(decimalsInRaw);
      const decimalsOut = Number(decimalsOutRaw);
      const amountInRaw = parseUnits(amountIn, decimalsIn);

      const routes = buildCandidateRoutes(tokenInAddress, tokenOutAddress, coreTokens);

      const multicallResult = await publicClient.multicall({
        allowFailure: true,
        multicallAddress: multicall3Address,
        contracts: routes.map((route) => ({
          address: contractAddresses.uniswapV2Router02 as Address,
          abi: contractAbis.router,
          functionName: "getAmountsOut",
          args: [amountInRaw, route]
        }))
      });

      const quotes: QuoteCandidate[] = routes.map((route, index) => {
        const result = multicallResult[index];

        if (result.status !== "success") {
          return {
            path: route,
            amountOut: 0n,
            success: false
          };
        }

        const amounts = result.result as bigint[];
        const finalAmount = amounts[amounts.length - 1] ?? 0n;

        return {
          path: route,
          amountOut: finalAmount,
          success: true
        };
      });

      const best = selectBestQuote(quotes);

      // Price impact: compare the trade's execution rate against the pool's
      // marginal (near-zero-size) rate along the same route. A tiny reference
      // trade quotes ~the spot price; impact is how far the real fill falls
      // short of it. Returned in basis points (100 bps = 1%).
      let priceImpactBps: number | undefined;
      if (best && best.amountOut > 0n) {
        const refIn = amountInRaw / 1000n > 0n ? amountInRaw / 1000n : 1n;
        try {
          const refAmounts = (await publicClient.readContract({
            address: contractAddresses.uniswapV2Router02 as Address,
            abi: contractAbis.router,
            functionName: "getAmountsOut",
            args: [refIn, best.path]
          })) as bigint[];
          const refOut = refAmounts[refAmounts.length - 1] ?? 0n;
          if (refOut > 0n) {
            // realRate = amountOut/amountInRaw, refRate = refOut/refIn.
            // impact = 1 - realRate/refRate, in bps, clamped to >= 0.
            const num = best.amountOut * refIn * 10_000n;
            const den = amountInRaw * refOut;
            const ratioBps = den > 0n ? Number(num / den) : 10_000;
            priceImpactBps = Math.max(0, 10_000 - ratioBps);
          }
        } catch {
          priceImpactBps = undefined;
        }
      }

      return {
        quotes,
        best,
        decimalsIn,
        decimalsOut,
        amountInRaw,
        priceImpactBps
      };
    }
  });
}
