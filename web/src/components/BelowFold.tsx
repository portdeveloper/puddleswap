import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Address } from "viem";
import { Link } from "react-router-dom";
import { usePublicClient } from "wagmi";
import { monadTestnet } from "../config/chain";

import { TokenIcon } from "./TokenIcon";
import { useAllPools } from "../hooks/useAllPools";
import type { PoolInfo } from "../hooks/useAllPools";
import { useCoreTokens } from "../hooks/useCoreTokens";
import { contractAbis, multicall3Address } from "../lib/contracts";

function abbreviate(n: string): string {
  const num = Number(n);
  if (Number.isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  return num.toPrecision(4);
}

function PoolPreviewRow({ pool }: { pool: PoolInfo }) {
  return (
    <Link to={`/pool/${pool.pairAddress}`} className="pool-row">
      <div className="pool-pair">
        <div className="pool-icons">
          <TokenIcon symbol={pool.symbol0} size={32} className="pool-token-icon" />
          <TokenIcon symbol={pool.symbol1} size={32} className="pool-token-icon" />
        </div>
        <div>
          <div className="pool-pair-name">{pool.symbol0} / {pool.symbol1}</div>
        </div>
      </div>
      <div><div className="pool-stat">{abbreviate(pool.reserve0Formatted)}</div><div className="pool-stat-sub">{pool.symbol0}</div></div>
      <div><div className="pool-stat">{abbreviate(pool.reserve1Formatted)}</div><div className="pool-stat-sub">{pool.symbol1}</div></div>
      <div>
        {pool.lpBalance > 0n ? (
          <>
            <div className="pool-stat">{abbreviate(pool.lpBalanceFormatted)}</div>
            <div className="pool-stat-sub">{pool.sharePercent}% share</div>
          </>
        ) : (
          <div className="pool-stat" style={{ color: "var(--text-muted)" }}>&mdash;</div>
        )}
      </div>
    </Link>
  );
}

interface CoreTokenInfo {
  address: Address;
  symbol: string;
  name: string;
}

function useCoreTokenMeta(coreTokens: Address[] | undefined) {
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  return useQuery({
    queryKey: ["core-token-meta", coreTokens],
    enabled: Boolean(publicClient && coreTokens && coreTokens.length > 0),
    staleTime: 30_000,
    queryFn: async (): Promise<CoreTokenInfo[]> => {
      if (!publicClient || !coreTokens || coreTokens.length === 0) return [];

      const calls = coreTokens.flatMap((addr) => [
        { address: addr, abi: contractAbis.erc20, functionName: "symbol" as const },
        { address: addr, abi: contractAbis.erc20, functionName: "name" as const },
      ]);

      const results = await publicClient.multicall({
        contracts: calls,
        multicallAddress: multicall3Address,
      });

      return coreTokens.map((addr, i) => {
        const symbolResult = results[i * 2];
        const nameResult = results[i * 2 + 1];
        return {
          address: addr,
          symbol: symbolResult?.status === "success" ? (symbolResult.result as string) : "???",
          name: nameResult?.status === "success" ? (nameResult.result as string) : "Unknown",
        };
      });
    },
  });
}

export function BelowFold() {
  const poolsQuery = useAllPools();
  const coreTokensQuery = useCoreTokens();
  const coreTokenMetaQuery = useCoreTokenMeta(coreTokensQuery.data);

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add("visible");
          }
        }
      },
      { threshold: 0.12 }
    );
    const els = document.querySelectorAll(".reveal");
    for (const el of els) observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const checkIcon = (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#4E9A55" strokeWidth="3">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );

  return (
    <>
      {/* Scroll hint */}
      <div className="scroll-hint">
        <div className="scroll-mouse"><div className="scroll-mouse-dot" /></div>
        <span className="scroll-hint-label">scroll to explore</span>
      </div>

      <div className="below-fold">
        <div className="divider-wave" />

        {/* Pools section */}
        <div className="pools-section reveal">
          <div className="pools-header">
            <div>
              <span className="section-label">~ liquidity ~</span>
              <div className="section-title">Active Pools</div>
              <p className="section-sub">Small but mighty. These are the puddles powering every swap.</p>
            </div>
            <Link to="/pools" className="btn-green-outline">View All Pools</Link>
          </div>
          <div className="pools-table">
            <div className="pools-table-header">
              <span>Pool</span>
              <span>Reserve 0</span>
              <span>Reserve 1</span>
              <span>Your Liquidity</span>
            </div>

            {poolsQuery.isLoading && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                Loading pools...
              </div>
            )}

            {poolsQuery.data && poolsQuery.data.length === 0 && (
              <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
                No pools yet. Be the first to create one!
              </div>
            )}

            {poolsQuery.data?.map((pool) => (
              <PoolPreviewRow key={pool.pairAddress} pool={pool} />
            ))}
          </div>
        </div>

        <div className="divider-wave" />

        {/* Token Registry */}
        <div className="token-registry reveal reveal-delay-2">
          <div className="registry-header">
            <div>
              <span className="section-label">~ core tokens ~</span>
              <div className="section-title">Token Registry</div>
              <p className="section-sub">Core tokens registered on-chain in the Puddle registry.</p>
            </div>
          </div>
          <div className="registry-grid">
            {coreTokenMetaQuery.data?.map((token) => (
              <div key={token.address} className="token-card">
                <TokenIcon symbol={token.symbol} size={44} className="token-card-icon" />
                <div className="token-card-info">
                  <div className="token-card-symbol">{token.symbol}</div>
                  <div className="token-card-name">{token.name}</div>
                </div>
                <div className="token-verified">{checkIcon}</div>
              </div>
            ))}
            {coreTokenMetaQuery.isLoading && (
              <div style={{ padding: "20px", color: "var(--text-muted)" }}>Loading tokens...</div>
            )}
            {coreTokenMetaQuery.data?.length === 0 && (
              <div style={{ padding: "20px", color: "var(--text-muted)" }}>No core tokens registered yet.</div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="reveal reveal-delay-3" style={{ width: "100%", maxWidth: 900, display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: 32, borderTop: "1px solid var(--border-light)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <svg className="logo-mark" width="20" height="20" viewBox="0 0 32 32" fill="none">
              <ellipse cx="16" cy="18" rx="12" ry="9" fill="#4E9A55" transform="rotate(-3 16 18)" />
              <ellipse cx="13" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
              <ellipse cx="19" cy="16.5" rx="1.2" ry="2.2" fill="#1E201E" />
              <path d="M13.5 21q2.5 2 5 0" stroke="#1E201E" strokeWidth="1.2" fill="none" strokeLinecap="round" />
            </svg>
            <span style={{ fontWeight: 800, fontSize: 18 }}>Puddle</span>
            <span style={{ fontSize: 13, color: "var(--text-muted)", marginLeft: 4 }}>Monad Testnet</span>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Contact dev on <a href="https://x.com/port_dev" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-green)", fontWeight: 600 }}>@port_dev</a>
          </div>
        </div>
      </div>
    </>
  );
}
