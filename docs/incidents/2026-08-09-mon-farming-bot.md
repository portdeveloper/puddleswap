# Incident report: MON-farming bot vs. the core-pool rebalancer

**Dates:** 2026-08-08 → 2026-08-09 · **Network:** Monad testnet (10143) · **Status:** closed — peg dropped, rebalancer retired
**Author:** compiled from on-chain forensics + Railway logs, 2026-08-09

## Summary

A well-capitalized, adaptive operator farmed testnet MON from PuddleSwap's USDC/WMON core pool by exploiting the price-pegging rebalancer: it bought MON with CCTP-bridged testnet USDC, and every time the rebalancer restored the 0.03 USDC/WMON peg it restocked cheap MON for the next buy. Across the whole campaign the bot extracted **~170k MON for ~14k USDC** (~0.08 USDC/MON blended). Countermeasures (shallow pool + skim-and-reseed + price ratchet) raised its cost up to ~8× and captured its payments, but each change was met with a same-day adaptation. Final resolution: **the peg itself was the vulnerability** — the rebalancer was shut down for good and core pools now float like any normal DEX.

## The wallet cluster

| # | Address | Chain | Role | Last observed state |
|---|---------|-------|------|---------------------|
| 1 | `0x0b8cba056037887e3eb466a8d150e155eb12aa5a` | Monad | Trading bot: every farming buy, always `swapExactTokensForETH` with `amountOutMin=1` | 200,467 MON · 240,250 core USDC · nonce 39 |
| 2 | `0xd222efd60088598ace49a98dee732c3725c491a1` | Sepolia + Monad | Treasury/controller: burned 251,000 USDC on Sepolia via CCTP v2 minted straight to the bot (Monad tx `0xb8df6e40…`); sent the bot's first gas on Monad (2 MON, block 51898422, tx `0xe19d8daf…`). Same key on both chains — the identity anchor. | 1,555 Sepolia ETH · 216,597 Sepolia USDC · 13 MON on Monad |
| 3 | `0xdc646c197d0202fc2a0326af8ab55066a3549e2e` | Monad | Secondary funder ("associated", one funding tx): routed core USDC to the bot via contract #4 (tx `0x47569659…`, ~block 51,967,050). Nonce moved 40 → 49 on 2026-08-09 — still active. | 3.2 MON · 56 USDC · nonce 49 |
| 4 | `0xb327709ec4f0830722776746b1da42f98d51868e` | Monad | Helper contract used by #3 to move USDC to the bot | contract, code deployed |

Not his (Circle infrastructure, do not log): CCTP MessageTransmitter `0xe737e5cebeeba77efe34d4aa090756590b1ce275` (Monad), TokenMessenger `0x8fe6b999dc680ccfdd5bf7eb0974218be2542daa` (Sepolia).

Key discovery about "core USDC" (`0x534b2f3A21130d7a60830c2Df862319e593943A3`): it is **Circle's canonical CCTP testnet USDC**. It has no local mint/faucet, but anyone can bridge arbitrary amounts from Sepolia via CCTP `receiveMessage` — so pool pegs can always be attacked with effectively unlimited USDC.

## Relevant protocol addresses

| Contract | Address |
|----------|---------|
| Operator wallet (rebalancer) | `0xe67A8D64C648e7BEBeE61B872E1e6ba9de255bE0` |
| USDC/WMON pair (staking-farm staked token) | `0x1FBC7b6B54726D735fF1B47Df75535B4B9021902` |
| USDT/WMON pair | `0x0002b40B245eFcD99A41fd0FB11F2ED90123933d` |
| UniswapV2Factory | `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B` |
| UniswapV2Router02 | `0x430c23895c8D44883526e3E0B09327dAD8766660` |
| Core USDC (Circle CCTP) | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| USDT | `0x1314b22df27BDcD4F8D11a0f4185943e55748917` |
| WMON | `0x97B3070F9Da6C002343862b35E68Bd8e22608943` |

## Timeline

### Phase 0 — setup (before 2026-08-08)
- Rebalancer (Railway project `port-swap-rebalancer`, service `dex-rebalancer`) loops every ~5 min, defending `TARGET_STABLE_PER_WMON = 30000` (0.03 USDC/WMON) by swapping against the core pools. Operator held ~99.8% of USDC/WMON LP (later measured 97.2%; outside LPs ~3%).
- Bot funding: block 51898422 — `0xd222…` sends 2 MON gas. ~Block 51903744 — bot approves USDC to router. Block ~51967050 — CCTP mint of 250,974.90 USDC to the bot (burned on Sepolia by `0xd222…`); a further ~10k USDC had arrived earlier (path via `0xdc646c…`/`0xb327…`).

### Phase 1 — the pool-break (2026-08-08 ~08:20 UTC, block 51903751)
- Single swap: **9,999 USDC → ~122,000 WMON** (tx `0x06f2ba91…`), leaving the pool at 6.39 USDC/WMON vs the 0.03 target (~200× off). This was the cause of the "2026-08-08 price-fix incident."
- Fixed same day (~12:30 UTC) by remove-liquidity → tiny swap → re-add at 0.03. Monitoring hardened (failure paging, dynamic low-MON threshold, affordable-swap caps).

### Phase 2 — farming the peg defense (2026-08-08 afternoon → 2026-08-09 morning)
- Bot: 6 buys, 3,975 USDC → 32,972 WMON (avg 0.12 USDC/MON). Cadence: 500–1,000 USDC every few hours, `amountOutMin=1`.
- Rebalancer: 43 corrective sells walking the price back down, **20,106 WMON out, only 2,908 USDC recovered** (the structural flaw: selling inventory down the curve to the same buyer).
- Operator ran dry (4.96 MON < 5 MON gas buffer) → every cycle logged `skip: no wmon/native balance` + low-MON Discord alerts ("gas too low" errors). Pool stuck at 223,493 vs 30,000.

### Phase 3 — skim-and-reseed deployed (2026-08-09 06:54 UTC, commit `a2e402b`)
- New design: out-of-tolerance pool → withdraw operator's entire LP (pockets the counterparty's payment without trading) → fix the remnant price (swap for real remnants, donate+`sync()` for dust, donation capped at seed/10 to avoid gifting outside LPs) → re-add a fixed seed (1,000 WMON + 30 USDC) at target. MON at risk per cycle ≈ one seed, not pool depth.
- First live skim recovered 1,632 USDC + 7,323 WMON; remnant fixed with a 359-WMON swap; pool reseeded shallow.
- Deterministic target ratchet added to the loop: +25% per 2 skims, decaying to the floor when idle. Deliberately **deterministic, not an LLM** — two-knob controller with a binary signal; an LLM would add latency, cost, nondeterminism, and prompt-injection surface.
- Operator topped up with 10,000 MON by the team.

### Phase 4 — bot escalates (2026-08-09 afternoon)
- Bot switched to buying **nearly every 5-minute cycle**. In a few hours it converted the operator's ~15.7k MON inventory into **6,700 USDC (avg ~0.43 USDC/MON — 8× the old realized rate)**, including one 6,500-USDC buy into a drained pool at 8.7 USDC/MON. Inventory exhausted → low-balance alert (the second "error" report).
- One cycle failed harmlessly: bot traded between forge simulation and broadcast, tripping `removeLiquidity`'s 99% min guard (tx `0xb1eaf6cc…`); next cycle harvested everything.
- Ratchet bug found & fixed (`7c50709`): it required *consecutive* skim cycles, which an episodic buyer never produces against a 5-min loop; changed to cumulative skims (streak survives quiet cycles, clears on the 24h idle step-down). Ratchet then engaged: 30,000 → 37,500.

### Phase 5 — bot right-sizes (2026-08-09 late afternoon)
- Bot adapted again: **50-USDC orders** buying ~800 WMON (~half the shallow pool) at ~0.06 USDC/MON — it discovered that taking fraction *f* of a constant-product pool costs only ≈ `target/(1−f)`, so the slippage moat tops out at ~2–3× quote against a calibrated buyer.
- Ceiling policy settled after discussion: briefly uncapped (`e2a395a`), then re-capped at **3× floor** (`199c6df`) on the principle that the core pool serves *all* app users — quotes must stay human-usable, not maximize extraction. Idle decay made per-cycle so abandoned high quotes return to floor in hours.

### Phase 6 — resolution: drop the peg (2026-08-09 evening)
- Decision: a pegged market maker below market-clearing price *is* the farm; no AMM trick stops a willing buyer, and identity-based pricing dies to sybil rotation. A dynamic-fee (impact-priced) pool was evaluated and deferred: real benefit only if deep user liquidity becomes the priority; meaningful contract risk against this adversary; migration would break the staking farm (stakes the current pair's LP token).
- **Rebalancer shut down** (`railway down --service dex-rebalancer`); heartbeat gist set to `lastStatus: "retired"` so port-monitor sees an intentional stop. Core pools now float freely.

## Final accounting

| Party | Result |
|-------|--------|
| Bot | ~170k MON extracted total (~122k in the pool-break + ~33k vs old rebalancer + ~15.7k vs skim-and-reseed) for ~14k USDC paid. Holds ~200k MON + 240k core USDC + 216k Sepolia USDC. |
| Operator | **131,560 core USDC · 1.44M USDT · ~24 native MON · 0 WMON.** Seed LP (~47 USDC + ~1,574 WMON) still in the floating USDC/WMON pool. |
| Realized rates over time | 0.055 (old peg defense) → 0.12 → 0.43 (skim-and-reseed) → 0.06 (bot right-sized) USDC/MON |

## Lessons

1. **A price peg below market-clearing price is a standing subsidy.** Any pegged AMM position on a permissionless chain will be farmed by whoever values the discounted asset most. Real DEXes float; that is the safeguard.
2. **Defend with liquidity operations, not swaps.** Swapping a pool back to target sells inventory down the curve to the attacker. Remove/re-add ("skim-and-reseed") captures the attacker's payment instead and bounds loss per cycle at the seed size.
3. **Slippage-as-margin has a ceiling.** A calibrated buyer taking ≤50% of a shallow pool pays only ~2× quote. Depth alone cannot make farming expensive.
4. **Deterministic controllers beat LLMs in the loop.** Binary signal, bounded response, no injection surface. LLMs belong in offline analysis, not 5-minute control loops.
5. **Adversary iterates same-day.** Every deployed change was countered within hours. Design for the equilibrium, not the current behavior.
6. **"Non-mintable" testnet tokens may still be infinite.** Core USDC is CCTP-bridgeable from Sepolia in unlimited amounts; threat models must include bridges.
7. **The durable fix is off-chain.** If the bot farms testnet MON for eligibility/airdrop weight, the defense lives in the eligibility criteria (behavioral filters: CCTP bankrolls, DEX-loop accumulation), not in the AMM. A blocklist of these four wallets is necessary but not sufficient — fresh wallets are cheap.

## Outstanding actions

- [ ] Confirm internally that hoarded testnet MON has zero weight in any eligibility program; hand this wallet cluster to whoever runs it.
- [ ] Remove `puddleswap-dex-rebalancer` from port-monitor's watch list (heartbeat already reports `retired`).
- [ ] Decide whether to withdraw the operator's seed LP from the floating USDC/WMON pool or leave it as routing liquidity.
- [ ] Optional: identify `0xd222efd6…` — 1,555 Sepolia ETH usually traces to known testnet infrastructure operators.
