import { useQuery } from "@tanstack/react-query";
import { createPuddleSwapClient } from "@puddleswap/sdk";
import type { Address, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

export function useCoreTokens() {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["core-tokens"],
    enabled: Boolean(publicClient),
    staleTime: 10_000,
    queryFn: async () => {
      if (!publicClient) {
        return [] as Address[];
      }

      const puddle = createPuddleSwapClient({
        publicClient: publicClient as unknown as PublicClient
      });
      return puddle.listCoreTokens();
    }
  });
}
