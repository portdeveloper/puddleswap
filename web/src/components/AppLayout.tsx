import { NavLink } from "react-router-dom";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { useChainGuard } from "../hooks/useChainGuard";
import { AnimatedBackground } from "./AnimatedBackground";

const links = [
  { to: "/swap", label: "Swap" },
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

  return (
    <div className="app-shell">
      <AnimatedBackground />

      <nav className="topbar">
        <NavLink to="/swap" className="logo">
          <div className="logo-mark" />
          Puddle
        </NavLink>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
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
            className="btn-connect connected"
            onClick={() => disconnect()}
            title="Click to disconnect"
          >
            {formatAddress(address)}
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
    </div>
  );
}
