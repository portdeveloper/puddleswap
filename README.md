# Port Swap (Monad Testnet DEX)

Static, no-backend DEX for Monad testnet with:
- Testnet USDC/USDT contracts
- Stock Uniswap V2 factory/router
- Onchain token registry with prefix search
- Safe-based deployment and admin workflow

## Repository layout

- `contracts/` Foundry contracts, scripts, tests
- `web/` Vite React app (RPC-only)
- `config/addresses/10143.json` deployment addresses
- `scripts/` helper scripts for Safe tx proposal + artifact sync
- `docs/runbooks/` operator runbooks

## Quick start

```bash
make setup
make test
make dev
```

## Safe deployment flow

1. Create/deploy Safe (2-of-3) on Monad testnet.
2. Export required env vars in `.env`.
3. Propose and execute stock Uniswap v2 deployments:

```bash
MODE=factory make deploy-uniswap-safe
# execute in Safe UI, then set FACTORY_ADDRESS
MODE=router make deploy-uniswap-safe
```

4. Dry-run a deployment script as Safe sender and propose txs:

```bash
TARGET_SCRIPT=DeployDexCore make deploy-testnet-safe
```

Other script targets can be proposed by changing `TARGET_SCRIPT`:
- `RegisterCoreTokens`
- `SeedCorePools`
- `DeployPhase2PassGate`

## ABI/address sync for web

After contracts compile/deploy:

```bash
make sync-artifacts
```

This updates `web/src/config/generated.ts` from Foundry artifacts and `config/addresses/10143.json`.

## Environment

Copy `.env.example` to `.env` and fill values.

## Security notes

- All privileged roles should be owned by Safe.
- UI blocks writes if wallet is not on Monad testnet (`10143`).
- BASIC tokens in registry intentionally do not display custom images.
