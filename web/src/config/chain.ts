import { monadTestnet as baseMonadTestnet } from "viem/chains";
import { defineChain } from "viem";

export const monadTestnet = defineChain({
  ...baseMonadTestnet,
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RPC_URL ?? baseMonadTestnet.rpcUrls.default.http[0]]
    }
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: import.meta.env.VITE_EXPLORER_BASE_URL ?? "https://testnet.monadscan.com"
    }
  }
});
