import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect, useSwitchChain } from "wagmi";

import { monadTestnet } from "../config/chain";
import { useChainGuard } from "../hooks/useChainGuard";
import { AnimatedBackground } from "./AnimatedBackground";
import { BelowFold } from "./BelowFold";

const links = [
  { to: "/", label: "Swap" },
  { to: "/pools", label: "Pools" },
];

function formatAddress(address?: string) {
  if (!address || address.length <= 10) {
    return address ?? "";
  }
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const { isCorrectChain, expectedChainId } = useChainGuard();

  // Auto-switch to Monad testnet when wallet is on wrong chain
  useEffect(() => {
    if (isConnected && !isCorrectChain) {
      switchChain({ chainId: monadTestnet.id });
    }
  }, [isConnected, isCorrectChain, switchChain]);
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);

  const location = useLocation();
  const isHomePage = location.pathname === "/";

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

  return (
    <div className="app-shell">
      <AnimatedBackground />

      <nav className="topbar">
        <NavLink to="/" className="logo">
          <span translate="no">puddleswap</span>
        </NavLink>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === "/"}
              className={({ isActive }) => isActive ? "active" : ""}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        {!isConnected ? (
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
        ) : (
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
        )}
      </nav>

      {!isCorrectChain && (
        <div className="network-warning" role="alert">
          <div className="network-dot" aria-hidden="true" />
          Switch wallet to Monad testnet ({expectedChainId})
        </div>
      )}

      <main>{children}</main>
      {isHomePage && <BelowFold />}
    </div>
  );
}
