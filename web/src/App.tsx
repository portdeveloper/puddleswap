import { Navigate, Route, Routes } from "react-router-dom";

import { AppLayout } from "./components/AppLayout";
import { CreatePoolPage } from "./pages/CreatePoolPage";
import { PoolDetailsPage } from "./pages/PoolDetailsPage";
import { SwapPage } from "./pages/SwapPage";

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<SwapPage />} />
        <Route path="/pool/new" element={<CreatePoolPage />} />
        <Route path="/pool/:pairAddress" element={<PoolDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppLayout>
  );
}
