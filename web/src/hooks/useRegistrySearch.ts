import { useQuery } from "@tanstack/react-query";
import { createPuddleSwapClient } from "@puddleswap/sdk";
import type { PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import type { TokenView } from "../types";

export function useRegistrySearch(query: string) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["registry-search", query],
    enabled: Boolean(publicClient),
    staleTime: 8_000,
    queryFn: async () => {
      if (!publicClient) {
        return [] as TokenView[];
      }

      const puddle = createPuddleSwapClient({
        publicClient: publicClient as unknown as PublicClient
      });
      return puddle.searchTokens(query);
    }
  });
}
