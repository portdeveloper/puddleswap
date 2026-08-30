import { useQuery } from "@tanstack/react-query";
import {
  MON,
  addresses,
  createPuddleSwapClient,
  type Token
} from "@puddleswap/sdk";
import { isAddress, type Address, type PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

export function useBestQuote(
  tokenIn: string,
  tokenOut: string,
  amountIn: string,
  coreTokens: Address[]
) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });
  const tokenInIsMon = tokenIn === MON;
  const tokenOutIsMon = tokenOut === MON;
  const tokenInAddress = tokenInIsMon ? addresses.wmon : tokenIn;
  const tokenOutAddress = tokenOutIsMon ? addresses.wmon : tokenOut;

  return useQuery({
    queryKey: ["best-quote", tokenIn, tokenOut, amountIn, coreTokens],
    enabled: Boolean(
      publicClient &&
        (tokenInIsMon || isAddress(tokenIn)) &&
        (tokenOutIsMon || isAddress(tokenOut)) &&
        tokenInAddress !== tokenOutAddress &&
        /^\d*\.?\d+$/.test(amountIn) &&
        Number(amountIn) > 0
    ),
    refetchInterval: 6_000,
    queryFn: async () => {
      if (!publicClient) {
        throw new Error("Monad public client is unavailable");
      }

      const puddle = createPuddleSwapClient({
        publicClient: publicClient as unknown as PublicClient
      });
      return puddle.getQuote(
        tokenIn as Token,
        tokenOut as Token,
        amountIn,
        { coreTokens }
      );
    }
  });
}
