# Runbook: Deploy to Monad Testnet via Safe

## Preconditions

1. Safe 2-of-3 deployed on Monad testnet.
2. At least one signer wallet funded with testnet MON.
3. `claude-monad` keystore present with password file.
4. `.env` configured:
   - `SAFE_ADDRESS`
   - `RPC_URL`
   - `CHAIN_ID=10143`
   - `SAFE_TX_SERVICE_URL`
   - `SAFE_CREATE_CALL`
   - `SAFE_API_KEY` (if required)

## Step 1: Build and test

```bash
make test
```

## Step 2: Propose stock Uniswap V2 deployments

Propose and execute factory first:

```bash
MODE=factory make deploy-uniswap-safe
```

After factory execution, set `FACTORY_ADDRESS` and propose router:

```bash
MODE=router make deploy-uniswap-safe
```

## Step 3: Propose core deployment txs

```bash
TARGET_SCRIPT=DeployDexCore make deploy-testnet-safe
```

This dry-runs `contracts/script/DeployDexCore.s.sol` with `--sender SAFE_ADDRESS`, extracts CREATE tx bytecode, wraps each as `CreateCall.performCreate` delegatecall, and posts proposals to Safe Transaction Service.

## Step 4: Execute in Safe UI

1. Open queue URL printed by script.
2. Collect second signature.
3. Execute each deployment transaction in nonce order.

## Step 5: Register core tokens

Set addresses from deployed contracts, then:

```bash
TARGET_SCRIPT=RegisterCoreTokens make deploy-testnet-safe
```

Execute queue txs in Safe UI.

## Step 6: Seed core pools

Set seed amounts and addresses:

```bash
TARGET_SCRIPT=SeedCorePools make deploy-testnet-safe
```

Execute in Safe UI.

## Step 7: Persist config

Update `config/addresses/10143.json`, then:

```bash
make sync-artifacts
```
