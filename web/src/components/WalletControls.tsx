import { useEffect, useRef, useState } from "react";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { monadTestnet } from "../config/chain";
import { useChainGuard } from "../hooks/useChainGuard";

function formatAddress(address?: string) {
  if (!address || address.length <= 10) {
    return address ?? "";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function WalletConnectButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { isCorrectChain } = useChainGuard();

  useEffect(() => {
    if (isConnected && !isCorrectChain) {
      switchChain({ chainId: monadTestnet.id });
    }
  }, [isConnected, isCorrectChain, switchChain]);

  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!confirmDisconnect) return;
    function onClickOutside(e: MouseEvent) {
      if (btnRef.current && !btnRef.current.contains(e.target as Node)) {
        setConfirmDisconnect(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, [confirmDisconnect]);

  if (!isConnected) {
    return (
      <button
        type="button"
        className="btn-connect"
        onClick={() => {
          const injectedConnector = connectors[0];
          if (injectedConnector) {
            connect({ connector: injectedConnector });
          }
        }}
      >
        Connect Wallet
      </button>
    );
  }

  return (
    <button
      type="button"
      ref={btnRef}
      className={`btn-connect connected${confirmDisconnect ? " confirm" : ""}`}
      onClick={() => {
        if (confirmDisconnect) {
          disconnect();
          setConfirmDisconnect(false);
        } else {
          setConfirmDisconnect(true);
        }
      }}
    >
      {confirmDisconnect ? "Disconnect?" : formatAddress(address)}
    </button>
  );
}

export function NetworkWarning() {
  const { isCorrectChain, expectedChainId } = useChainGuard();
  if (isCorrectChain) return null;
  return (
    <div className="network-warning" role="alert">
      <div className="network-dot" aria-hidden="true" />
      Switch wallet to Monad testnet ({expectedChainId})
    </div>
  );
}
