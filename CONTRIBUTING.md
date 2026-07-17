# Contributing to PuddleSwap

Thank you for your interest in contributing to PuddleSwap - a static, no-backend DEX on Monad testnet, live at [app.puddleswap.org](https://app.puddleswap.org).

## About the project

PuddleSwap gives builders stablecoins and token swaps on Monad testnet without waiting for mainnet DEX deployments. The frontend is RPC-only: no backend, no indexer, no API keys.

**Stack:** Foundry (Solidity contracts) + Vite + React + TypeScript (static web app).

```
contracts/          Foundry - Solidity contracts, deploy scripts, tests
web/                Vite + React + TypeScript - static frontend (RPC-only)
config/             Deployed contract addresses per chain
scripts/            Deploy, verify, rebalance, sync helpers
docs/               Runbooks and security docs
```

### What to contribute (and what not to)

The core AMM contracts (factory, router, registry) are deployed on testnet and are not up for casual changes; redeploying core is a maintainer decision. The contribution surface is the periphery:

- LP and analytics dashboards (pool stats, volume, price history from RPC)
- SDK / helper libraries for interacting with the pools
- Subgraph or other indexing that stays optional for the app
- Tests: contract tests in Foundry, web tests for routing and UI logic
- Frontend improvements: routing UX, token registry UX, accessibility

One hard constraint: the frontend must stay static and backend-free. Features that require a server the app depends on will not be merged.

## Getting started

```bash
git clone https://github.com/portdeveloper/puddleswap
cd puddleswap
make setup    # install Foundry deps + pnpm install
make test     # run contract tests + web tests
make dev      # start Vite dev server
```

No env vars are needed for web development; `VITE_RPC_URL` and `VITE_EXPLORER_BASE_URL` are optional overrides. Deployed addresses live in `config/addresses/10143.json`.

## How to contribute

Contributions are welcome via Issues and Pull Requests.

- **Report bugs** or **suggest features** by opening an Issue.
- **Build periphery**: dashboards, SDK, subgraph, analytics.
- **Improve tests** around routing, pools, and the registry.
- **Fix bugs** in the swap flow, pool management, or token search.

### Guidelines

- Search for existing Issues and PRs before creating your own.
- Each contribution should focus on one thing - don't mix a feature with style fixes.
- Follow the existing patterns in `web/src`; the star-routing quote logic is the heart of the app, so changes there need tests.
- Batched RPC calls are the norm; don't add per-token request waterfalls.

### Rules

1. **Every PR requires an approved Issue first.** Open an Issue describing what you want to do and wait for a maintainer to agree before writing code. PRs without a linked, approved Issue will be closed.
2. Contributors must be humans, not bots.
3. First-time contributions must not be only spelling, grammar, or formatting fixes.

### Issues

Open an Issue before doing any work. Describe what you want to change and why. This lets us discuss the approach, avoid duplicate effort, and say no early if the change doesn't fit.

When reporting a bug:

- Describe what you expected vs what happened.
- Include the tokens/pool involved and the wallet you tested with (address only, never keys).
- Screenshots and the failing transaction hash help.

### Pull requests

Once your Issue is approved, follow the fork-and-pull workflow:

1. Fork the repo
2. Create a branch with a descriptive name
3. Make your changes
4. Run `make test` and make sure the web app builds
5. Push to your fork and open a PR

Tips for a good PR:

- Keep the title short and descriptive.
- Link the approved Issue.
- Describe what changed and why.
- One commit per logical change is fine; we squash-merge.

PRs without a linked Issue, or that change things not discussed in the Issue, will be closed. After review, we may ask questions or request changes. Once approved, we'll squash-and-merge.

## Security

Never commit private keys, keystore passwords, or `.env` files. If you find a vulnerability in the deployed contracts or the rebalancer, do not open a public Issue; email the maintainer instead (see `docs/`).
