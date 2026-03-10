import { useEffect } from "react";

export function BelowFold() {
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
            <a href="/pool/new" className="btn-green-outline">+ Create Pool</a>
          </div>
          <div className="pools-table">
            <div className="pools-table-header">
              <span>Pool</span>
              <span>TVL</span>
              <span>Volume 24h</span>
              <span>Your Liquidity</span>
              <span />
            </div>
            <div className="pool-row">
              <div className="pool-pair">
                <div className="pool-icons">
                  <div className="token-icon mon">M</div>
                  <div className="token-icon usdc">U</div>
                </div>
                <div>
                  <div className="pool-pair-name">MON / USDC</div>
                  <span className="pool-badge">&#10003; Verified</span>
                </div>
              </div>
              <div><div className="pool-stat">$12,480</div><div className="pool-stat-sub">Testnet only</div></div>
              <div><div className="pool-stat">$3,210</div></div>
              <div><div className="pool-stat">$840</div><div className="pool-stat-sub">2.4% share</div></div>
              <div className="pool-actions">
                <button type="button" className="btn-xs add">Add</button>
                <button type="button" className="btn-xs remove">Remove</button>
              </div>
            </div>
            <div className="pool-row">
              <div className="pool-pair">
                <div className="pool-icons">
                  <div className="token-icon mon">M</div>
                  <div className="token-icon usdt">T</div>
                </div>
                <div>
                  <div className="pool-pair-name">MON / USDT</div>
                  <span className="pool-badge">&#10003; Verified</span>
                </div>
              </div>
              <div><div className="pool-stat">$8,920</div><div className="pool-stat-sub">Testnet only</div></div>
              <div><div className="pool-stat">$1,540</div></div>
              <div><div className="pool-stat">&mdash;</div></div>
              <div className="pool-actions">
                <button type="button" className="btn-xs add">Add</button>
                <button type="button" className="btn-xs remove">Remove</button>
              </div>
            </div>
            <div className="pool-row">
              <div className="pool-pair">
                <div className="pool-icons">
                  <div className="token-icon usdc">U</div>
                  <div className="token-icon usdt">T</div>
                </div>
                <div>
                  <div className="pool-pair-name">USDC / USDT</div>
                  <span className="pool-badge">&#10003; Verified</span>
                </div>
              </div>
              <div><div className="pool-stat">$5,340</div><div className="pool-stat-sub">Testnet only</div></div>
              <div><div className="pool-stat">$880</div></div>
              <div><div className="pool-stat">&mdash;</div></div>
              <div className="pool-actions">
                <button type="button" className="btn-xs add">Add</button>
                <button type="button" className="btn-xs remove">Remove</button>
              </div>
            </div>
          </div>
        </div>

        <div className="divider-wave" />

        {/* Token Registry */}
        <div className="token-registry reveal reveal-delay-2">
          <div className="registry-header">
            <div>
              <span className="section-label">~ all tokens ~</span>
              <div className="section-title">Token Registry</div>
              <p className="section-sub">Anyone can register a token. Verified tokens are reviewed by the Puddle team.</p>
            </div>
          </div>
          <div className="registry-grid">
            <div className="token-card">
              <div className="token-card-icon" style={{ background: "#836EF9" }}>M</div>
              <div className="token-card-info"><div className="token-card-symbol">MON</div><div className="token-card-name">Monad Native</div></div>
              <div className="token-verified">{checkIcon}</div>
            </div>
            <div className="token-card">
              <div className="token-card-icon" style={{ background: "#2775CA" }}>U</div>
              <div className="token-card-info"><div className="token-card-symbol">USDC</div><div className="token-card-name">USD Coin (Test)</div></div>
              <div className="token-verified">{checkIcon}</div>
            </div>
            <div className="token-card">
              <div className="token-card-icon" style={{ background: "#26A17B" }}>T</div>
              <div className="token-card-info"><div className="token-card-symbol">USDT</div><div className="token-card-name">Tether USD (Test)</div></div>
              <div className="token-verified">{checkIcon}</div>
            </div>
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
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}><a href="https://x.com/puddleswap" target="_blank" rel="noopener noreferrer" style={{ color: "var(--brand-green)", fontWeight: 600 }}>@puddleswap on X</a></div>
        </div>
      </div>
    </>
  );
}
