import { Link } from "react-router-dom";

import { useAllPools } from "../hooks/useAllPools";
import type { PoolInfo } from "../hooks/useAllPools";

function tokenIconClass(symbol: string): string {
  const s = symbol.toLowerCase();
  if (s === "usdc") return "usdc";
  if (s === "usdt" || s === "tusdt") return "usdt";
  if (s === "mon") return "mon";
  if (s === "wmon") return "wmon";
  return "";
}

function abbreviate(n: string): string {
  const num = Number(n);
  if (Number.isNaN(num) || num === 0) return "0";
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(2)}M`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(2)}K`;
  if (num >= 1) return num.toFixed(2);
  return num.toPrecision(4);
}

function PoolRow({ pool }: { pool: PoolInfo }) {
  return (
    <Link to={`/pool/${pool.pairAddress}`} className="pool-row">
      <div className="pool-pair">
        <div className="pool-icons">
          <span className={`token-icon ${tokenIconClass(pool.symbol0)}`}>
            {pool.symbol0.slice(0, 1)}
          </span>
          <span className={`token-icon ${tokenIconClass(pool.symbol1)}`}>
            {pool.symbol1.slice(0, 1)}
          </span>
        </div>
        <div>
          <div className="pool-pair-name">
            {pool.symbol0} / {pool.symbol1}
          </div>
        </div>
      </div>

      <div>
        <div className="pool-stat">{abbreviate(pool.reserve0Formatted)}</div>
        <div className="pool-stat-sub">{pool.symbol0}</div>
      </div>

      <div>
        <div className="pool-stat">{abbreviate(pool.reserve1Formatted)}</div>
        <div className="pool-stat-sub">{pool.symbol1}</div>
      </div>

      <div>
        {pool.lpBalance > 0n ? (
          <>
            <div className="pool-stat">{abbreviate(pool.lpBalanceFormatted)}</div>
            <div className="pool-stat-sub">{pool.sharePercent}% share</div>
          </>
        ) : (
          <div className="pool-stat" style={{ color: "var(--text-muted)" }}>—</div>
        )}
      </div>
    </Link>
  );
}

export function PoolsPage() {
  const poolsQuery = useAllPools();

  return (
    <section className="pools-section">
      <div className="pools-header">
        <div>
          <p className="section-label">~ liquidity ~</p>
          <h1 style={{ fontSize: 32, fontWeight: 800, margin: 0 }}>Active Pools</h1>
          <p style={{ color: "var(--text-muted)", marginTop: 4 }}>
            Small but mighty. These are the puddles powering every swap.
          </p>
        </div>
        <Link to="/pool/new" className="btn-green-outline">
          + Create Pool
        </Link>
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

        {poolsQuery.isError && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            Failed to load pools.
          </div>
        )}

        {poolsQuery.data && poolsQuery.data.length === 0 && (
          <div style={{ padding: "40px 24px", textAlign: "center", color: "var(--text-muted)" }}>
            No pools yet. Be the first to create one!
          </div>
        )}

        {poolsQuery.data?.map((pool) => (
          <PoolRow key={pool.pairAddress} pool={pool} />
        ))}
      </div>
    </section>
  );
}
