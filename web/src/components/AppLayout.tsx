import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { useChainGuard } from "../hooks/useChainGuard";
import { AnimatedBackground } from "./AnimatedBackground";
import { BelowFold } from "./BelowFold";

const links = [
  { to: "/", label: "Swap" },
  { to: "/pool/new", label: "Pools" },
];

function formatAddress(address?: string) {
  if (!address || address.length <= 10) {
    return address ?? "";
  }
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  const { address, isConnected } = useAccount();
  const { connect, connectors } = useConnect();
  const { disconnect } = useDisconnect();
  const { isCorrectChain, expectedChainId } = useChainGuard();
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
          <svg className="logo-mark" width="20" height="20" viewBox="0 0 32 32" fill="none">
            <ellipse cx="16" cy="18" rx="12" ry="9" fill="#4E9A55" transform="rotate(-3 16 18)" />
            <ellipse cx="13" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
            <ellipse cx="19" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
            <path d="M13.5 21q2.5 2 5 0" stroke="#1E201E" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
          Puddle
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
        <div className="network-warning">
          <div className="network-dot" />
          Switch wallet to Monad testnet ({expectedChainId})
        </div>
      )}

      <main>{children}</main>
      {isHomePage && <BelowFold />}
    </div>
  );
}
