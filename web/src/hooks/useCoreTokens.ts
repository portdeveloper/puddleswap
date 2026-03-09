import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { usePublicClient } from "wagmi";

import { contractAbis, contractAddresses } from "../lib/contracts";

export function useCoreTokens() {
  const publicClient = usePublicClient();

  return useQuery({
    queryKey: ["core-tokens"],
    enabled: Boolean(publicClient && contractAddresses.tokenRegistry),
    staleTime: 10_000,
    queryFn: async () => {
      if (!publicClient || !contractAddresses.tokenRegistry) {
        return [] as Address[];
      }

      const result = await publicClient.readContract({
        address: contractAddresses.tokenRegistry,
        abi: contractAbis.registry,
        functionName: "listCoreTokens"
      });

      return result as Address[];
    }
  });
}
