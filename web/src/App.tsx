import { lazy, Suspense } from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { SwapPage } from "./pages/SwapPage";

const PoolsPage = lazy(() =>
  import("./pages/PoolsPage").then((m) => ({ default: m.PoolsPage }))
);
const CreatePoolPage = lazy(() =>
  import("./pages/CreatePoolPage").then((m) => ({ default: m.CreatePoolPage }))
);
const PoolDetailsPage = lazy(() =>
  import("./pages/PoolDetailsPage").then((m) => ({ default: m.PoolDetailsPage }))
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
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </AppLayout>
  );
}
