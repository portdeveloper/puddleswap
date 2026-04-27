import type { ReactNode } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";

import { AnimatedBackground } from "./AnimatedBackground";
import { BelowFold } from "./BelowFold";

const links = [
  { to: "/", label: "Swap", end: true },
  { to: "/learn", label: "Learn" },
  { to: "/tokens", label: "Tokens" },
  { to: "/pools", label: "Pools" },
] satisfies Array<{ to: string; label: string; end?: boolean }>;

function StaticOpenSwapButton() {
  return (
    <Link to="/" className="btn-connect">
      Open Swap
    </Link>
  );
}

export function AppLayout({
  children,
  walletButton,
  walletWarning,
}: {
  children: ReactNode;
  walletButton?: ReactNode;
  walletWarning?: ReactNode;
}) {
  const location = useLocation();
  const isHomePage = location.pathname === "/";

  return (
    <div className="app-shell">
      <AnimatedBackground />

      <nav className="topbar" aria-label="Primary">
        <a href="https://puddleswap.org/" className="logo">
          <svg
            className="logo-mark"
            width="22"
            height="22"
            viewBox="0 0 32 32"
            fill="none"
            aria-hidden="true"
          >
            <ellipse
              cx="16"
              cy="18"
              rx="12"
              ry="9"
              fill="#4E9A55"
              transform="rotate(-3 16 18)"
            />
            <ellipse cx="13" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
            <ellipse cx="19" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
            <path
              d="M13.5 21q2.5 2 5 0"
              stroke="#1E201E"
              strokeWidth="1.2"
              fill="none"
              strokeLinecap="round"
            />
          </svg>
          <span translate="no">puddleswap</span>
        </a>
        <div className="nav-links">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.end}
              className={({ isActive }) => (isActive ? "active" : "")}
            >
              {link.label}
            </NavLink>
          ))}
        </div>
        {walletButton ?? <StaticOpenSwapButton />}
      </nav>

      {walletWarning}

      <main>{children}</main>
      {isHomePage && <BelowFold />}
    </div>
  );
}
