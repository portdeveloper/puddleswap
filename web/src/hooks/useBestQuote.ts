import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { getQuote, type QuoteCandidate } from "@puddleswap/sdk";
import { monadTestnet } from "../config/chain";

import { contractAddresses } from "../lib/contracts";

const MON_TOKEN = "MON";

const EMPTY_RESULT = {
  quotes: [] as QuoteCandidate[],
  best: undefined,
  decimalsIn: 18,
  decimalsOut: 18,
  amountInRaw: 0n
};

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
        return EMPTY_RESULT;
      }

      if (tokenInAddress === tokenOutAddress) {
        return EMPTY_RESULT;
      }

      return getQuote(publicClient, {
        tokenIn: tokenInAddress,
        tokenOut: tokenOutAddress,
        amountIn,
        coreTokens,
        decimalsIn: tokenInIsMon ? 18 : undefined,
        decimalsOut: tokenOutIsMon ? 18 : undefined
      });
    }
  });
}
