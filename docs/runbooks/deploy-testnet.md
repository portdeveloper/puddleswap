# Runbook: Deploy to Monad Testnet

## Preconditions

1. Foundry keystore account created (default: `puddleswap`).
2. Keystore password file at `~/.monad-keystore-password`.
3. Deployer wallet funded with testnet MON.
4. `.env` configured:
   - `RPC_URL`
   - `CHAIN_ID=10143`
   - `ACCOUNT_NAME` (optional, defaults to `puddleswap`)

## Step 1: Build and test

```bash
make test
```

## Step 2: Deploy Uniswap V2

```bash
FEE_TO_SETTER=<deployer-address> make deploy-uniswap
```

This deploys WMON (if not set), UniswapV2Factory, and UniswapV2Router02 in a single transaction.

## Step 3: Deploy core contracts

```bash
TARGET_SCRIPT=DeployDexCore make deploy-testnet
```

Deploys TestUSDC, TestUSDT, StableFaucet, OpenRegistrationGate, and TokenRegistry. The deployer (`msg.sender`) becomes the admin.

## Step 4: Register core tokens

Set addresses from deployed contracts, then:

```bash
TOKEN_REGISTRY=<addr> USDC_ADDRESS=<addr> USDT_ADDRESS=<addr> WMON_ADDRESS=<addr> \
  TARGET_SCRIPT=RegisterCoreTokens make deploy-testnet
```

## Step 5: Seed core pools

```bash
ROUTER_ADDRESS=<addr> USDC_ADDRESS=<addr> USDT_ADDRESS=<addr> WMON_ADDRESS=<addr> LP_OWNER=<addr> \
  TARGET_SCRIPT=SeedCorePools make deploy-testnet
```

## Step 6: Persist config

Update `config/addresses/10143.json`, then:

```bash
make sync-artifacts
```

## Keystore setup

Create a new keystore account:

```bash
cast wallet import puddleswap --interactive
```

Store the password in `~/.monad-keystore-password` for scripted use.
