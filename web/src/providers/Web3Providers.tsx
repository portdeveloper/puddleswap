import type { ReactNode } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";

import { queryClient, wagmiConfig } from "../config/wagmi";

export default function Web3Providers({ children }: { children: ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </WagmiProvider>
  );
}
