import { useQuery } from "@tanstack/react-query";
import { isAddress, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { contractAbis } from "../lib/contracts";

export function useTokenMeta(tokenAddress: string | undefined) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["token-meta", tokenAddress],
    enabled: Boolean(publicClient && tokenAddress && isAddress(tokenAddress)),
    staleTime: 30_000,
    queryFn: async () => {
      if (!publicClient || !tokenAddress || !isAddress(tokenAddress)) {
        return undefined;
      }

      const address = tokenAddress as Address;

      const [symbol, decimals] = await Promise.all([
        publicClient.readContract({
          address,
          abi: contractAbis.erc20,
          functionName: "symbol"
        }),
        publicClient.readContract({
          address,
          abi: contractAbis.erc20,
          functionName: "decimals"
        })
      ]);

      return {
        address,
        symbol: symbol as string,
        decimals: Number(decimals)
      };
    }
  });
}
