import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      // Only preload chunks that the entry imports synchronously. Lazy chunks
      // (Web3Providers, swap UI, route pages) load on demand, not ahead of time.
      // This keeps content pages from speculatively fetching the wallet bundle.
      resolveDependencies: (_filename, deps) =>
        deps.filter(
          (d) =>
            !d.includes("wallet-vendor") &&
            !d.includes("query-vendor") &&
            !d.includes("Web3Providers") &&
            !d.includes("WalletControls")
        )
    },
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // Vite's __vitePreload helper. Without this rule it gets hoisted into
          // the most-shared chunk (wallet-vendor, since wagmi uses dynamic
          // imports for secp256k1 + ccipRead), which forces every page — even
          // /learn/* and /about — to statically pull the wallet bundle.
          if (id.includes("vite/preload-helper")) return "preload-helper";
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react-router")) return "react-vendor";
          if (id.includes("react-helmet")) return "react-vendor";
          if (id.match(/[\\/]react(-dom)?[\\/]/)) return "react-vendor";
          if (id.includes("@tanstack")) return "query-vendor";
          if (id.includes("wagmi") || id.includes("@wagmi")) return "wallet-vendor";
          if (id.includes("viem") || id.includes("ox") || id.includes("abitype"))
            return "wallet-vendor";
          return undefined;
        }
      }
    }
  },
  test: {
    globals: true,
    environment: "jsdom",
    setupFiles: "./src/test/setup.ts"
  }
});
