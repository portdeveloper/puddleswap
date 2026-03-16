# Railway Rebalancer Runbook

This service continuously runs the core pool rebalancer on Monad testnet.

## Service behavior

- Runs `scripts/rebalance-testnet-core.sh` in a loop
- Rebalances `USDC/WMON` and `USDT/WMON` around target `1000` stable per `1 WMON`
- Sleeps `REBALANCE_INTERVAL_SECONDS` between runs with optional `REBALANCE_JITTER_SECONDS`

## Required variables

- `PRIVATE_KEY` rebalancer wallet private key

## Optional variables

- `RPC_URL` default `https://testnet-rpc.monad.xyz`
- `TARGET_STABLE_PER_WMON` default `100000000`
- `TARGET_TOLERANCE_BPS` default `50`
- `MAX_INPUT_FRACTION_BPS` default `5000`
- `REBALANCE_INTERVAL_SECONDS` default `300`
- `REBALANCE_JITTER_SECONDS` default `30`
- `LOW_MON_THRESHOLD_MON` default `200`
- `LOW_BALANCE_ALERT_COOLDOWN_SECONDS` default `21600` (6h)
- `DISCORD_WEBHOOK_URL` Discord incoming webhook URL for low balance alerts
- `FACTORY_ADDRESS` overrides config file
- `ROUTER_ADDRESS` overrides config file
- `USDC_ADDRESS` overrides config file
- `USDT_ADDRESS` overrides config file
- `WMON_ADDRESS` overrides config file

## Deploy (CLI)

1. `railway login`
2. `railway link` (or `railway init` for a new project)
3. `PRIVATE_KEY=<key> DISCORD_WEBHOOK_URL=<url> make deploy-railway-rebalancer`

Manual equivalent:

1. `railway add --service dex-rebalancer`
2. `railway variable set --service dex-rebalancer PRIVATE_KEY=<key>`
3. `railway variable set --service dex-rebalancer REBALANCE_INTERVAL_SECONDS=300 TARGET_TOLERANCE_BPS=50`
4. `railway up --service dex-rebalancer`

## Verify

1. `railway logs --service dex-rebalancer`
2. Confirm cycle lines:
   - `Rebalance cycle started`
   - `Rebalance run complete.`
   - `within tolerance, no action` or swap execution logs
