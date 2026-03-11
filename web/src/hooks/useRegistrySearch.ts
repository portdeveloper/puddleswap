import { useQuery } from "@tanstack/react-query";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { contractAbis, contractAddresses } from "../lib/contracts";
import type { TokenView } from "../types";

export function useRegistrySearch(query: string) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["registry-search", query],
    enabled: Boolean(publicClient && contractAddresses.tokenRegistry),
    staleTime: 8_000,
    queryFn: async () => {
      if (!publicClient || !contractAddresses.tokenRegistry) {
        return [] as TokenView[];
      }

      const result = await publicClient.readContract({
        address: contractAddresses.tokenRegistry,
        abi: contractAbis.registry,
        functionName: "search",
        args: [query]
      });

      return result as TokenView[];
    }
  });
}
