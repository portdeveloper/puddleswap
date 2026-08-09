# Handoff: "Healthy DEX" work — 2026-08-09

Continuation doc for picking this up (e.g. in Codex). Covers what shipped, what's
left, decisions already made, and the exact constraints/gotchas so you don't
re-derive them.

## Context in one paragraph

PuddleSwap is a Uniswap-V2 fork on Monad testnet (chain 10143). A price-pegging
core-pool rebalancer was being farmed by a well-funded bot for testnet MON; the
peg was dropped and the rebalancer **retired** (see
`docs/incidents/2026-08-09-mon-farming-bot.md` — read it first). The follow-on
goal is a healthy, user-facing DEX. The initial work items are now done or
resolved; ongoing operation is intentionally conservative.

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
| 3 | Seed bounded floating liquidity | ✅ 500 WMON added to USDC/WMON; no USDT/WMON treasury addition |
| 4 | Swap UI guardrails (slippage + price impact) | ✅ done, committed `b609d4c` |
| 5 | Point farm incentives at the canonical pool | ✅ canonical farm active with 1 WMON / 7 days |
| 6 | Read-only pool health reporter | ✅ done, committed `5c714b2`, live on Railway |

## Commits made this session

- `a2e402b` … `199c6df` — rebalancer skim-and-reseed + ratchet (now retired, historical)
- `b5a87c4` — incident report
- `b609d4c` — swap price-impact guardrails + 0.5% default slippage
- `5c714b2` — read-only health reporter replaces rebalancer

`docs/announcements/` is an unrelated local farm-launch draft and is not part of
this work.

## URGENT security item

Listing Railway env vars printed secrets in cleartext this session:
- `HEARTBEAT_GIST_TOKEN` is a live GitHub PAT — **rotate it**
  (revoke on GitHub, reissue, update the Railway var on service `dex-rebalancer`).
- Operator `PRIVATE_KEY` was partially shown; it has been **removed** from the
  (now read-only) Railway service. Consider rotating the operator wallet anyway.

## Key addresses & access

- Operator wallet: `0xe67A8D64C648e7BEBeE61B872E1e6ba9de255bE0`
  - Holds ~**24 MON**, **131,560 USDC**, **1,439,290 USDT**, ~0 WMON.
  - Private key: was in Railway `dex-rebalancer` env and is now deleted. It is
    not present in the repository or local Foundry keystore; recover it only
    from the proper secret store.
- Deployer keystore `monad-deployer` = `0x3eeCb6532B0C9CE1E5759E1a23300bAABb37aBfE`
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
operator holds these roles.** The known admin/verifier/operator is
`0xb0E956d64cd412Edb242839793C7910e5E15a298`, but its signer is not present in
the local Foundry keystore. Recover it from the proper secret store before
attempting governance changes, then migrate roles to a securely controlled
admin wallet.

## Pool action completed — bounded floating liquidity

On 2026-08-09, the controlled `monad-deployer` wallet performed a bounded,
one-time pool intervention. No loop, peg, or replenishment mechanism exists.

- Spent 567.211339 faucet USDT to recover 8,998.864699 WMON from the cheap
  USDT/WMON pool and align it with the USDC/WMON price. Transaction:
  `0x8e40d291cc791e91b1b0081ddd3a2b26631a083d5a7c0951ec6e0295e8251c3a`.
- Converted 62 USDT into 62.379557 canonical USDC. Transaction:
  `0x3f155d064e9ec2cc95561af982d36d315ae3c5c9f00e944b90e391f3e8225664`.
- Added exactly 500 WMON + 63.404019 USDC to USDC/WMON with 1% minimums;
  LP belongs to `monad-deployer`. Transaction:
  `0xabe9f901da4b0a0d4a19512dd07a6a339c7936c0ca8aca9dded2628525811524`.
- Post-action reserves: USDC/WMON ≈ 160.543885 USDC + 1,266.038705 WMON;
  USDT/WMON ≈ 1,124.461349 USDT + 8,867.429505 WMON. Both prices were
  ≈0.126808 stable/WMON at completion and now float freely.
- Do not add treasury WMON to the faucet-mintable USDT pool. Do not
  automatically replenish either pool. Any future USDC/WMON addition requires
  a fresh simulation, explicit cumulative MON budget, and non-zero minimums.
- The legacy `add-deep-liquidity*.sh` scripts now fail closed because their
  stale wallets, zero minimums, and USDT deepening behavior were unsafe.

## Farm incentives (active, deliberately small)

- The farm `StakingRewards` `0xe23B…97F1` already stakes the USDC/WMON LP
  (`0x1FBC…1902`) and is wired into `web/src/lib/farms.ts` (FARMS) and the
  `/farm` page. It was funded with exactly 1 WMON over seven days on 2026-08-09;
  `periodFinish=1786898820` and `rewardRate=1653439153439` wei/second. Keep
  rewards small while outside staked TVL remains low.
- Deploy runbook: `docs/runbooks/staking-rewards.md`. Do **not** add a
  USDT/WMON farm: its input stable is locally faucet-mintable.
- `docs/announcements/farm-launch.md` has a ready tweet draft for when depth is in.

## Health reporter (done — how to operate it)

- `scripts/pool-health-reporter.sh`, deployed on Railway project
  `port-swap-rebalancer` / service `dex-rebalancer` (start command + Dockerfile
  CMD repointed). Read-only: reads core-pool price + WMON depth each cycle,
  publishes to the heartbeat gist `44b8bbb6180de10e510d2d84baed799a`, and pings
  Discord on price moves, reserve drains, absolute low depth, cross-pool price
  divergence, pool read failures, or heartbeat failures. It redacts the RPC URL
  and publishes `degraded` rather than `ok` when a pool read fails.
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
