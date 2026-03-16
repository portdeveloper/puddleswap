# PuddleSwap

A static, no-backend DEX on Monad testnet. Solves the problem of builders needing stablecoins and token swaps on testnet without waiting for mainnet DEX deployments.

**Live at [app.puddleswap.org](https://app.puddleswap.org)**

## How it works

### Swapping tokens

Select a token to sell and a token to buy. PuddleSwap finds the best route automatically using **star routing** — core tokens (USDC, USDT, WMON) act as intermediaries. For any swap A -> B, the UI checks all possible paths in a single batched RPC call:

- A -> B (direct)
- A -> USDC -> B, A -> USDT -> B, A -> WMON -> B (3-hop)
- A -> USDC -> WMON -> B, A -> WMON -> USDC -> B, etc. (4-hop)

This means any token with a pool against at least one core token is tradeable against any other. The best quote wins. Slippage is configurable (default 1%, max 50%) and quotes refresh every 6 seconds.

### Creating pools

Navigate to Pools > Create. Pick two tokens, set initial amounts, approve both, and create. This deploys a new Uniswap V2 pair and adds the first liquidity in one flow.

### Managing liquidity

Click any pool to see reserves, your LP balance, and add or remove liquidity. Removing burns your LP tokens and returns both underlying tokens proportionally.

### Token registry

An onchain registry lets the UI autocomplete token names without maintaining a list in git. Tokens have three trust tiers:

- **Top Verified** — core tokens like USDC, USDT, WMON
- **Checkmark** — vetted by a verifier
- **Basic** — registered by anyone (7-day cooldown, max 1 active per address, no custom images for NSFW protection)

Search works by symbol prefix (up to 4 characters). Higher-tier tokens appear first.

### Faucet

The StableFaucet contract lets anyone claim testnet USDT with a per-address cooldown (default 24 hours). An admin can tune claim amounts or disable the faucet. USDC is Circle's real testnet token (acquired via [Circle's faucet](https://faucet.circle.com/)).

### Rebalancer

An automated service on Railway keeps the core pools (USDC/WMON, USDT/WMON) near a target price. It runs every 5 minutes and sends Discord alerts on low MON balance. The operator wallet must be pre-funded with USDC (real token, no minting).

## Architecture

```
contracts/          Foundry — Solidity contracts, deploy scripts, tests
web/                Vite + React + TypeScript — static frontend (RPC-only)
config/             Deployed contract addresses per chain
scripts/            Deploy, verify, rebalance, sync helpers
docs/               Runbooks and security docs
```

The frontend has zero backend dependencies. All data comes from RPC calls to Monad testnet. Wallet connection uses an injected provider (MetaMask, Rabby, etc.).

## Contracts (Monad testnet)

| Contract | Address |
|----------|---------|
| WMON | `0x97B3070F9Da6C002343862b35E68Bd8e22608943` |
| USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| TestUSDT | `0x1314b22df27BDcD4F8D11a0f4185943e55748917` |
| StableFaucet | `0x50959dd2a4ef310f9aa2df9498cE9aC0aB956276` |
| UniswapV2Factory | `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B` |
| UniswapV2Router02 | `0x430c23895c8D44883526e3E0B09327dAD8766660` |
| OpenRegistrationGate | `0xd1a37dF00238b97F453fC583806711048eB9987c` |
| TokenRegistry | `0x82289127fda2d521c851C696796c41EDB6b6461D` |

All contracts are verified on [MonadVision](https://testnet.monadvision.com), [Socialscan](https://monad-testnet.socialscan.io), and [Monadscan](https://testnet.monadscan.com).

## Development

```bash
make setup    # install Foundry deps + pnpm install
make test     # run contract tests + web tests
make dev      # start Vite dev server
```

## Deployment

### Contracts

1. Create a Foundry keystore:

```bash
cast wallet import puddleswap --interactive
```

2. Store the password for scripted use:

```bash
echo -n "your-password" > ~/.monad-keystore-password
chmod 600 ~/.monad-keystore-password
```

3. Copy `.env.example` to `.env` and fill values.

4. Deploy:

```bash
FEE_TO_SETTER=<deployer-address> make deploy-uniswap
TARGET_SCRIPT=DeployDexCore make deploy-testnet
TARGET_SCRIPT=RegisterCoreTokens make deploy-testnet
TARGET_SCRIPT=SeedCorePools make deploy-testnet
```

5. Update addresses and sync to frontend:

```bash
# edit config/addresses/10143.json with new addresses
make sync-artifacts
```

6. Verify on all block explorers:

```bash
ADMIN_ADDRESS=<deployer-address> make verify-contracts
```

### Frontend

Deployed to Vercel. Pushes to `master` auto-deploy. The only required env var is `VITE_WALLETCONNECT_PROJECT_ID`.

### Rebalancer

Runs on Railway as a Docker service. See `docs/runbooks/railway-rebalancer.md`.

```bash
PRIVATE_KEY=<key> make deploy-railway-rebalancer
```

## Security

- All privileged roles are owned by the deployer keystore account.
- UI blocks writes if wallet is not on Monad testnet (chain ID `10143`).
- Rebalancer key is stored as a Railway env var, never in code.
- Uniswap V2 contracts are stock/unmodified.
- See `docs/security/trust-model.md` for the full threat model.
