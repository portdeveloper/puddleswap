import { defineChain } from "viem";

export const monadTestnet = defineChain({
  id: (() => { const raw = Number(import.meta.env.VITE_CHAIN_ID); return Number.isInteger(raw) && raw > 0 ? raw : 10143; })(),
  name: "Monad Testnet",
  nativeCurrency: {
    decimals: 18,
    name: "Monad",
    symbol: "MON"
  },
  rpcUrls: {
    default: {
      http: [import.meta.env.VITE_RPC_URL ?? "https://testnet-rpc.monad.xyz"]
    }
  },
  blockExplorers: {
    default: {
      name: "MonadScan",
      url: import.meta.env.VITE_EXPLORER_BASE_URL ?? "https://testnet.monadscan.com"
    }
  }
});
