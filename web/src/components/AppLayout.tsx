import { NavLink } from "react-router-dom";
import { useAccount, useConnect, useDisconnect } from "wagmi";

import { useChainGuard } from "../hooks/useChainGuard";

const links = [
  { to: "/swap", label: "Swap" },
  { to: "/pool/new", label: "Create Pool" }
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
  const addressLabel = formatAddress(address);

  return (
    <div className="app-shell">
      <header className="topbar">
        <div>
          <h1>Monad Testnet DEX</h1>
          <p>Static Uniswap v2 terminal for builders</p>
        </div>

        <div className="wallet-controls">
          {!isConnected ? (
            <button
              type="button"
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
            <>
              <span className="address-pill">{addressLabel}</span>
              <button type="button" onClick={() => disconnect()}>
                Disconnect
              </button>
            </>
          )}
        </div>
      </header>

      {!isCorrectChain && (
        <div className="network-warning">Wrong chain selected. Switch wallet to Monad testnet ({expectedChainId}).</div>
      )}

      <nav className="tabs">
        {links.map((link) => (
          <NavLink key={link.to} to={link.to} className={({ isActive }) => (isActive ? "tab active" : "tab")}>
            {link.label}
          </NavLink>
        ))}
      </nav>

      <main>{children}</main>
    </div>
  );
}
