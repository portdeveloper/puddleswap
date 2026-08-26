import { QueryClient } from "@tanstack/react-query";
import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";

import { monadTestnet } from "./chain";

export const queryClient = new QueryClient();

export const wagmiConfig = createConfig({
  chains: [monadTestnet],
  connectors: [injected()],
  transports: {
    // Batching keeps the chunked eth_getLogs calls used by pool analytics
    // (usePoolAnalytics.ts) to a handful of HTTP round trips instead of one
    // per 100-block window.
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0], { batch: true })
  }
});

/** Re-export so hooks can pass chainId explicitly */
export const CHAIN_ID = monadTestnet.id;
