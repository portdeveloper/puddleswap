import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";

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

export default function App() {
  return (
    <AppLayout>
      <Suspense fallback={routeFallback}>
        <Routes>
          <Route path="/" element={<SwapPage />} />
          <Route path="/pools" element={<PoolsPage />} />
          <Route path="/pool/new" element={<CreatePoolPage />} />
          <Route path="/pool/:pairAddress" element={<PoolDetailsPage />} />
          <Route path="/learn" element={<LearnHub />} />
          <Route path="/learn/:slug" element={<LearnPage />} />
          <Route path="/tokens" element={<TokenHub />} />
          <Route path="/tokens/:slug" element={<TokenPage />} />
          <Route path="/about" element={<AboutPage />} />
          <Route path="/swap/:slug" element={<SwapGuidePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
