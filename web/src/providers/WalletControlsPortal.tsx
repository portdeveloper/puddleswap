import { useEffect, useState } from "react";
import { createPortal } from "react-dom";

import { NetworkWarning, WalletConnectButton } from "../components/WalletControls";

export default function WalletControlsPortal() {
  const [buttonSlot, setButtonSlot] = useState<HTMLElement | null>(null);
  const [warningSlot, setWarningSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setButtonSlot(document.getElementById("topbar-wallet-slot"));
    setWarningSlot(document.getElementById("wallet-warning-slot"));
  }, []);

  return (
    <>
      {buttonSlot && createPortal(<WalletConnectButton />, buttonSlot)}
      {warningSlot && createPortal(<NetworkWarning />, warningSlot)}
    </>
  );
}
