# Staking Rewards (LP Farm) Runbook

`StakingRewards` is a Synthetix-style single-pool LP farm: users stake a Uniswap V2 LP token and
earn a reward token streamed linearly over `rewardsDuration`. One contract is deployed per farmed
pool. The first farm is **WMON/USDC LP → WMON rewards**.

Source: `contracts/src/StakingRewards.sol`. Frontend: `/farm` page (`web/src/pages/FarmPage.tsx`,
`web/src/hooks/useFarms.ts`, `web/src/lib/farms.ts`).

## Contract behavior

- `stake(amount)` / `withdraw(amount)` / `getReward()` / `exit()` for stakers.
- Rewards accrue per staked LP, pro-rata, only while `block.timestamp < periodFinish`.
- Funding model: transfer reward tokens to the contract, then `notifyRewardAmount(amount)` sets the
  per-second `rewardRate = amount / rewardsDuration` and sets `periodFinish = now + rewardsDuration`.
  A solvency guard reverts if the contract doesn't actually hold enough reward tokens.
- Roles: `OPERATOR_ROLE` may `notifyRewardAmount`; `DEFAULT_ADMIN_ROLE` may `setRewardsDuration`
  (only after a period ends) and `recoverERC20` (the staking token can never be recovered).

## 1. Deploy a farm

Requires a funded keystore account (same setup as `scripts/deploy-testnet.sh`). The deploy script
reads the factory/WMON/USDC addresses from env and derives the LP pair via `getPair`.

```bash
TARGET_SCRIPT=DeployStakingRewards \
FACTORY_ADDRESS=0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B \
WMON_ADDRESS=0x97B3070F9Da6C002343862b35E68Bd8e22608943 \
USDC_ADDRESS=0x534b2f3A21130d7a60830c2Df862319e593943A3 \
REWARDS_DURATION=604800 \
bash scripts/deploy-testnet.sh
```

Optional env: `REWARDS_TOKEN` (default = `WMON_ADDRESS`), `REWARDS_DURATION` (default `7 days`),
`ADMIN_ADDRESS` (default deployer). Addresses live in `config/addresses/10143.json`.

Then wire it into the app:

1. Copy the logged `StakingRewards(WMON/USDC)` address into
   `config/addresses/10143.json` → `.contracts.stakingRewardsWmonUsdc`.
2. `make sync-artifacts` (regenerates `web/src/config/generated.ts` with the address + ABI).
3. Rebuild/redeploy the web app. The farm appears on `/farm` automatically (it is gated on the
   address being set — empty string = hidden).

## 2. Fund / top up rewards

The reward token defaults to **WMON**. Wrap MON → WMON first if needed (WMON is WETH-like:
`cast send <WMON> "deposit()" --value <wei>`). The funding account must hold `REWARD_AMOUNT` reward
tokens and have `OPERATOR_ROLE` (the deployer does).

```bash
TARGET_SCRIPT=FundStakingRewards \
STAKING_REWARDS_ADDRESS=<deployed address> \
REWARD_AMOUNT=7000000000000000000000 \
bash scripts/deploy-testnet.sh
```

`FundStakingRewards` transfers the reward in and calls `notifyRewardAmount`, starting (or extending)
the streaming window. Re-run any time to top up — leftover rewards from the current period roll into
the new rate. `REWARD_AMOUNT` is in reward-token base units (WMON has 18 decimals, so the example
above is 7,000 WMON over 7 days ≈ 1,000/day).

## 3. `rewardsDuration` semantics

- Set at deploy (`REWARDS_DURATION`, seconds). It is the window each `notifyRewardAmount` streams over.
- To change it, wait until the current period ends (`block.timestamp >= periodFinish`), then call
  `setRewardsDuration(newSeconds)` from the admin, then re-fund.

## 4. Add a second pool (e.g. WMON/USDT)

1. Deploy another `StakingRewards` instance (step 1) with `USDC_ADDRESS` swapped for the USDT address.
2. Add the new address to `config/addresses/10143.json` (e.g. `stakingRewardsWmonUsdt`), add it to the
   `artifacts` map in `scripts/sync-artifacts.mjs`, and `make sync-artifacts`.
3. Surface it: add the address to `contractAddresses` in `web/src/lib/contracts.ts` and append an
   entry to `FARMS` in `web/src/lib/farms.ts`. No page changes needed — `/farm` lists every entry.

## 5. Verify

- On-chain: `cast call <staking> "periodFinish()(uint256)"` is in the future; `rewardRate()` > 0.
- App: open `/farm`, connect a wallet holding WMON/USDC LP, then Approve → Stake → (pending rewards
  tick up) → Claim → Unstake. Tx links should resolve on the explorer.
- Contract logic is covered by `contracts/test/StakingRewards.t.sol` (`forge test`); the APR helper by
  `web/src/lib/__tests__/farms.test.ts` (`pnpm --dir web test`).

## Notes

- APR shown on `/farm` is a best-effort estimate: it values staked LP and annualized rewards in
  reward-token (WMON) units using current pool reserves. It reads `0`/`—` once rewards end.
- This is testnet-only: rewards are subsidized emissions you fund, not organic yield.
