# PuddleSwap

A static, no-backend DEX on Monad testnet. Solves the problem of builders needing stablecoins and token swaps on testnet without waiting for mainnet DEX deployments.

- **Mintable stablecoins** — testnet USDC/USDT that we issue, making distribution easy
- **Stock Uniswap V2** — unmodified factory/router, immutable and GPL-licensed
- **Static frontend** — no backend, RPC-only. Not branded as Uniswap or Monad
- **Onchain token registry** — prefix search with three tiers (Top Verified, Checkmark, Basic) so the UI can autocomplete without maintaining a token list in git
- **Star routing** — core tokens (USDC, USDT, WMON) are used as intermediaries. Any token with a pool against a core token is tradeable. Best route is found via a single batched RPC call
- **Open registration** — anyone can register a token with a 7-day cooldown. Basic tokens don't display custom images (NSFW protection). Verified/checkmark status is granted by a verifier role
- **Faucet** — users can claim testnet USDC/USDT with a per-address cooldown

## Repository layout

- `contracts/` — Foundry contracts, scripts, tests
- `web/` — Vite + React frontend (RPC-only, no backend)
- `config/addresses/10143.json` — deployment addresses
- `scripts/` — deployment + artifact sync helpers
- `docs/runbooks/` — operator runbooks

## Quick start

```bash
make setup
make test
make dev
```

## Deployment flow

1. Create a Foundry keystore account:

```bash
cast wallet import puddleswap --interactive
```

2. Export required env vars in `.env`.
3. Deploy Uniswap V2:

```bash
FEE_TO_SETTER=<deployer-address> make deploy-uniswap
```

4. Deploy core contracts:

```bash
TARGET_SCRIPT=DeployDexCore make deploy-testnet
```

Other script targets can be deployed by changing `TARGET_SCRIPT`:
- `RegisterCoreTokens`
- `SeedCorePools`

## ABI/address sync for web

After contracts compile/deploy:

```bash
make sync-artifacts
```

This updates `web/src/config/generated.ts` from Foundry artifacts and `config/addresses/10143.json`.

## Environment

Copy `.env.example` to `.env` and fill values.

## Security notes

- All privileged roles are owned by the deployer keystore account.
- UI blocks writes if wallet is not on Monad testnet (`10143`).
- BASIC tokens in registry intentionally do not display custom images.
