# PuddleSwap — Testnet Prod Plan

## 1. Replace Safe with Foundry Keystore

The Safe multisig adds unnecessary complexity for a testnet app. Switch to direct
deploys using a foundry keystore (`cast wallet`).

### 1a. Simplify deployment scripts

- [x] Created `scripts/deploy-testnet.sh` — replaces `deploy-testnet-safe.sh`
- [x] Created `scripts/deploy-uniswap.sh` — replaces `deploy-uniswap-stock-safe.sh`
- [x] Deleted `scripts/safe/` directory (`propose-create.mjs`, `propose-broadcast.mjs`)
- [x] Deleted `scripts/deploy-testnet-safe.sh` and `scripts/deploy-uniswap-stock-safe.sh`

### 1b. Update Solidity deploy scripts

- [x] `DeployDexCore.s.sol` — replaced `SAFE_ADDRESS` with `ADMIN_ADDRESS` (defaults to `msg.sender`)
- [x] `DeployPhase2PassGate.s.sol` — same change
- [x] Deleted `DeploySafeCREATE2.s.sol`

### 1c. Update config & env

- [x] `.env.example` — removed Safe vars, added `ACCOUNT_NAME=puddleswap`
- [x] `config/addresses/10143.json` — removed `safe` field
- [x] `web/src/config/generated.ts` — removed `safe` field
- [x] `web/src/lib/contracts.ts` — removed `safe` address
- [x] Updated `Makefile` targets

### 1d. Update docs

- [x] `docs/runbooks/deploy-testnet.md` — rewritten for keystore workflow
- [x] `docs/security/trust-model.md` — removed Safe, documented keystore approach
- [x] `docs/runbooks/phase2-gate-migration.md` — updated for direct broadcast
- [x] `docs/runbooks/ops.md` — replaced Safe proposals with `cast send` commands
- [x] `README.md` — updated deployment flow and security notes

---

## 2. Fix Rebalancer Key Management

- [x] Deleted `.env.rebalancer.local` (contained hardcoded private key)
- [x] Removed local env file sourcing from `scripts/rebalance-testnet-core.sh`
- [x] Updated default keystore account name to `puddleswap`
- [ ] Verify Railway service has `PRIVATE_KEY` set as env var (not in repo)

---

## 3. Deploy Phase 2 Contracts (or Cut Scope)

Decide: do we need `RegistrationPass` and `PassRegistrationGate`?

**If yes:**
- [ ] Deploy `RegistrationPass` via `TARGET_SCRIPT=DeployPhase2PassGate make deploy-testnet`
- [ ] Update `config/addresses/10143.json` with new addresses
- [ ] Run `make sync-artifacts`

**If no:**
- [ ] Remove `RegistrationPass.sol` and `PassRegistrationGate.sol` from contracts
- [ ] Remove empty entries from `config/addresses/10143.json`
- [ ] Delete `docs/runbooks/phase2-gate-migration.md`

---

## 4. Restore CI

- [x] Added back GitHub Actions workflow (`.github/workflows/ci.yml`)
  - Runs `make test` (forge + vitest)
  - Runs `pnpm lint`, `pnpm typecheck`, `pnpm build`

---

## 5. Pre-Launch Checks

- [ ] Verify all deployed contracts on block explorer (socialscan)
- [ ] Test full swap flow end-to-end on testnet
- [ ] Test token registration flow
- [ ] Test faucet claim flow
- [ ] Confirm Vercel deployment works (`vercel.json` config, env vars set)
- [ ] Confirm rebalancer is running on Railway and keeping pools healthy
- [ ] Review CSP headers in `vercel.json` — make sure `connect-src` allows the RPC URL
