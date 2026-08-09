# Handoff: "Healthy DEX" work — 2026-08-09

Continuation doc for picking this up (e.g. in Codex). Covers what shipped, what's
left, decisions already made, and the exact constraints/gotchas so you don't
re-derive them.

## Context in one paragraph

PuddleSwap is a Uniswap-V2 fork on Monad testnet (chain 10143). A price-pegging
core-pool rebalancer was being farmed by a well-funded bot for testnet MON; the
peg was dropped and the rebalancer **retired** (see
`docs/incidents/2026-08-09-mon-farming-bot.md` — read it first). The follow-on
goal is a healthy, user-facing DEX. Five work items were scoped; 3 are done or
decided, 2 remain.

## Decisions already made (do not relitigate)

- **USDC: leave as-is (option 3).** Do NOT repoint the app to the faucet-mintable
  USDC. The canonical USDC stays `0x534b2f3A21130d7a60830c2Df862319e593943A3`
  (Circle CCTP testnet USDC). This means the faucet/USDC mismatch for new users
  is accepted for now. **Task 2 is cancelled.**
- **Pools float freely.** No peg, no rebalancer. Keep it that way.
- **Monitoring is read-only.** The Railway service now runs a health reporter,
  not a trader.

## Status by task

| # | Task | Status |
|---|------|--------|
| 1 | Recon of USDC blast radius + on-chain roles | ✅ done |
| 2 | Repoint canonical USDC | ❌ cancelled (USDC left as-is) |
| 3 | Seed deep floating liquidity (USDC/WMON, USDT/WMON) | ⏳ TODO |
| 4 | Swap UI guardrails (slippage + price impact) | ✅ done, committed `b609d4c` |
| 5 | Point farm incentives at the canonical pool | ⏳ TODO (see notes) |
| 6 | Read-only pool health reporter | ✅ done, committed `5c714b2`, live on Railway |

## Commits made this session (branch: master, NOT pushed)

- `a2e402b` … `199c6df` — rebalancer skim-and-reseed + ratchet (now retired, historical)
- `b5a87c4` — incident report
- `b609d4c` — swap price-impact guardrails + 0.5% default slippage
- `5c714b2` — read-only health reporter replaces rebalancer

Nothing is pushed to a remote. `docs/announcements/` is untracked (a farm-launch
tweet draft, unrelated).

## URGENT security item

Listing Railway env vars printed secrets in cleartext this session:
- `HEARTBEAT_GIST_TOKEN` = a live GitHub PAT (`ghp_…Px0NV6x`) — **rotate it**
  (revoke on GitHub, reissue, update the Railway var on service `dex-rebalancer`).
- Operator `PRIVATE_KEY` was partially shown; it has been **removed** from the
  (now read-only) Railway service. Consider rotating the operator wallet anyway.

## Key addresses & access

- Operator wallet: `0xe67A8D64C648e7BEBeE61B872E1e6ba9de255bE0`
  - Holds ~**24 MON**, **131,560 USDC**, **1,439,290 USDT**, ~0 WMON.
  - Private key: was in Railway `dex-rebalancer` env (now deleted); a copy was
    staged this session at the scratchpad path `.opkey` (ephemeral — regenerate
    from your own secret store, do not rely on it).
- Deployer keystore `monad-deployer` = `0x3eeCb6532B0C9CE1E5759E1a23300bAABb37aBfE`
  (foundry keystore, password `test`, pw file `~/.monad-keystore-password`),
  holds ~6,699 MON. Admin of the **staking farm** but NOT of the registry/faucet.
- Contracts (`config/addresses/10143.json`): factory `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B`,
  router `0x430c23895c8D44883526e3E0B09327dAD8766660`, USDC `0x534b…943A3`,
  USDT `0x1314b22df27BDcD4F8D11a0f4185943e55748917`, WMON `0x97B3070F9Da6C002343862b35E68Bd8e22608943`,
  TokenRegistry `0x82289127fda2d521c851C696796c41EDB6b6461D`,
  StableFaucet `0x50959dd2a4ef310f9aa2df9498cE9aC0aB956276`,
  StakingRewards (WMON/USDC LP) `0xe23B3825F950637256e8DE1BF39743E8f29D97F1`.
- Pairs: USDC/WMON `0x1FBC7b6B54726D735fF1B47Df75535B4B9021902` (also the farm's
  staked LP), USDT/WMON `0x0002b40B245eFcD99A41fd0FB11F2ED90123933d`.

### Critical on-chain gotcha

The app's routing "core tokens" come from **`TokenRegistry.listCoreTokens()`**
on-chain (currently WMON, USDT, core-USDC), NOT from config. `useAllPools` hides
any pool whose tokens aren't core, and routing only hops through core tokens.
Changing the core set needs `VERIFIER_ROLE` on the registry; changing faucet
mint targets needs `OPERATOR_ROLE` on the faucet. **Neither the deployer nor the
operator holds these roles** — the admin is an unknown wallet from the original
DexCore deployment (registry created ~block 33334581; the public RPC won't serve
that old creation tx, so the admin address is currently unknown). If future work
needs registry/faucet admin, that key must come from whoever deployed core.

## TODO 3 — Seed deep floating liquidity

Goal: give users good fills without a peg. Deepen `USDC/WMON` and `USDT/WMON`.

- Stable side is flush (131k USDC, 1.44M USDT in operator). **The binding
  constraint is MON**: operator has only ~24 MON. Deep WMON pools need MON
  funded in (the foundation can send it, as before). Decide a target depth and
  MON budget first.
- Current live pool state (2026-08-09 ~15:00 UTC): USDC/WMON ≈ 0.127 stable/WMON,
  ~766 WMON deep (shallow, left over from the retired rebalancer's seed);
  USDT/WMON ≈ 0.031, ~17,866 WMON deep. Both currently float.
- There is a leftover ~1,000-WMON seed LP the operator owns in USDC/WMON; you can
  withdraw/consolidate before reseeding.
- Add liquidity via the router `addLiquidity` at whatever ratio you want the
  starting price to be (0.03 stable/WMON was the old anchor; floating means the
  exact start ratio is your choice). No rebalancer will defend it.
- Scripts exist: `scripts/add-deep-liquidity.sh`, `scripts/add-deep-liquidity-2.sh`
  (they assume pre-funded USDC — fine here since operator holds it).
- **Do NOT reintroduce a peg/rebalancer.** Floating is the anti-farming property.

## TODO 5 — Farm incentives

- The farm `StakingRewards` `0xe23B…97F1` already stakes the USDC/WMON LP
  (`0x1FBC…1902`) and is wired into `web/src/lib/farms.ts` (FARMS) and the
  `/farm` page. Since USDC is staying as-is, the existing farm already points at
  the canonical pool — **task 5 may be a no-op** beyond optionally topping up
  WMON rewards (via `FundStakingRewards`, admin = `monad-deployer`) once TODO 3
  has deepened the pool so the APR display isn't based on trivial TVL.
- Deploy runbook: `docs/runbooks/staking-rewards.md`. A second pool's farm (e.g.
  USDT/WMON) would be a new `StakingRewards` deploy + `config` + `FARMS` entry.
- `docs/announcements/farm-launch.md` has a ready tweet draft for when depth is in.

## Health reporter (done — how to operate it)

- `scripts/pool-health-reporter.sh`, deployed on Railway project
  `port-swap-rebalancer` / service `dex-rebalancer` (start command + Dockerfile
  CMD repointed). Read-only: reads core-pool price + WMON depth each cycle,
  publishes to the heartbeat gist `44b8bbb6180de10e510d2d84baed799a`, and pings
  Discord on price moves ≥15% or reserve drains ≥25% (tunable via env
  `PRICE_MOVE_ALERT_PCT`, `RESERVE_DRAIN_ALERT_PCT`).
- Deploy from repo root: `railway up --service dex-rebalancer --detach` (after
  `railway link --project port-swap-rebalancer --environment production`). Note:
  MCP `railway deploy` fails for this service — use the CLI.

## Guardrails (done — what changed)

- `web/src/hooks/useBestQuote.ts`: computes `priceImpactBps` via a marginal
  reference trade on the best route.
- `web/src/pages/SwapPage.tsx`: shows price impact, warns >3%, hard-blocks >15%
  behind an "I understand" checkbox; default slippage 0.5%.
- Tests in `web/src/hooks/__tests__/useBestQuote.test.ts` (73 web tests pass,
  `npx tsc --noEmit` clean).

## The bot (for situational awareness)

Wallet cluster and full forensics in `docs/incidents/2026-08-09-mon-farming-bot.md`.
Trading bot `0x0b8cba056037887e3eb466a8d150e155eb12aa5a`, funded/controlled by
`0xd222efd60088598ace49a98dee732c3725c491a1` (Sepolia treasury: 1,555 ETH,
216k USDC). It buys MON from whatever pool is cheap; with the peg gone it can no
longer be farmed at a subsidy. The durable fix is off-chain: ensure hoarded
testnet MON carries no eligibility weight, and hand the cluster to whoever runs
any such program.
