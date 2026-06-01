import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";

const BelowFold = lazy(() =>
  import("../components/BelowFold").then((m) => ({ default: m.BelowFold }))
);

// BelowFold uses wagmi hooks (useAllPools, useCoreTokens, usePublicClient),
// so it must render inside Web3Providers. The visual layout, however, lives
// in AppLayout which is mounted outside the providers (for fast topbar paint).
// We bridge the two by portaling BelowFold into the slot AppLayout renders.
export default function BelowFoldPortal() {
  const [slot, setSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setSlot(document.getElementById("below-fold-slot"));
  }, []);

  if (!slot) return null;

  return createPortal(
    <Suspense fallback={null}>
      <BelowFold />
    </Suspense>,
    slot
  );
}
