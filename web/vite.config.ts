import { defineConfig } from "vitest/config";
import { loadEnv, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// Cloudflare Web Analytics injection.
// Reads VITE_CF_ANALYTICS_TOKEN from env at build time and injects the beacon
// script into index.html (via transformIndexHtml) and dist/landing.html (via
// closeBundle, since landing.html is served from public/ untouched). Skipped
// in dev so we never report local pageviews to CF.
function cloudflareAnalytics(token: string | undefined): Plugin {
  const beacon = (t: string) =>
    `    <script defer src="https://static.cloudflareinsights.com/beacon.min.js" data-cf-beacon='{"token":"${t}"}'></script>\n  </head>`;
  return {
    name: "cf-web-analytics",
    apply: "build",
    transformIndexHtml(html) {
      if (!token) return html;
      return html.replace("</head>", beacon(token));
    },
    closeBundle() {
      if (!token) return;
      const landingPath = resolve(__dirname, "dist/landing.html");
      if (!existsSync(landingPath)) return;
      const html = readFileSync(landingPath, "utf8");
      if (html.includes("static.cloudflareinsights.com")) return;
      writeFileSync(landingPath, html.replace("</head>", beacon(token)));
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const cfToken = env.VITE_CF_ANALYTICS_TOKEN || process.env.VITE_CF_ANALYTICS_TOKEN;
  return {
  plugins: [react(), cloudflareAnalytics(cfToken)],
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
  };
});
