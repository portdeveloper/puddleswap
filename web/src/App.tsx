import { lazy, Suspense } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";

const Web3Providers = lazy(() => import("./providers/Web3Providers"));
const WalletControlsPortal = lazy(
  () => import("./providers/WalletControlsPortal")
);
const BelowFoldPortal = lazy(() => import("./providers/BelowFoldPortal"));

const SwapPage = lazy(() =>
  import("./pages/SwapPage").then((m) => ({ default: m.SwapPage }))
);
const PoolsPage = lazy(() =>
  import("./pages/PoolsPage").then((m) => ({ default: m.PoolsPage }))
);
const CreatePoolPage = lazy(() =>
  import("./pages/CreatePoolPage").then((m) => ({ default: m.CreatePoolPage }))
);
const PoolDetailsPage = lazy(() =>
  import("./pages/PoolDetailsPage").then((m) => ({ default: m.PoolDetailsPage }))
);
const FarmPage = lazy(() =>
  import("./pages/FarmPage").then((m) => ({ default: m.FarmPage }))
);
const LearnHub = lazy(() =>
  import("./pages/LearnHub").then((m) => ({ default: m.LearnHub }))
);
const LearnPage = lazy(() =>
  import("./pages/LearnPage").then((m) => ({ default: m.LearnPage }))
);
const TokenHub = lazy(() =>
  import("./pages/TokenHub").then((m) => ({ default: m.TokenHub }))
);
const TokenPage = lazy(() =>
  import("./pages/TokenPage").then((m) => ({ default: m.TokenPage }))
);
const AboutPage = lazy(() =>
  import("./pages/AboutPage").then((m) => ({ default: m.AboutPage }))
);
const SwapGuidePage = lazy(() =>
  import("./pages/SwapGuidePage").then((m) => ({ default: m.SwapGuidePage }))
);

const routeFallback = (
  <div
    role="status"
    style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}
  >
    Loading…
  </div>
);

function isWalletRoute(pathname: string): boolean {
  if (pathname === "/") return true;
  if (pathname === "/pools") return true;
  if (pathname.startsWith("/pool/")) return true;
  if (pathname === "/farm") return true;
  if (pathname.startsWith("/tokens/")) return true;
  return false;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<SwapPage />} />
      <Route path="/pools" element={<PoolsPage />} />
      <Route path="/pool/new" element={<CreatePoolPage />} />
      <Route path="/pool/:pairAddress" element={<PoolDetailsPage />} />
      <Route path="/farm" element={<FarmPage />} />
      <Route path="/learn" element={<LearnHub />} />
      <Route path="/learn/:slug" element={<LearnPage />} />
      <Route path="/tokens" element={<TokenHub />} />
      <Route path="/tokens/:slug" element={<TokenPage />} />
      <Route path="/about" element={<AboutPage />} />
      <Route path="/swap/:slug" element={<SwapGuidePage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const location = useLocation();
  const needsWallet = isWalletRoute(location.pathname);
  const isHomePage = location.pathname === "/";

  if (needsWallet) {
    return (
      <AppLayout walletButton={null}>
        <Suspense fallback={routeFallback}>
          <Web3Providers>
            <WalletControlsPortal />
            {isHomePage && <BelowFoldPortal />}
            <AppRoutes />
          </Web3Providers>
        </Suspense>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <Suspense fallback={routeFallback}>
        <AppRoutes />
      </Suspense>
    </AppLayout>
  );
}
