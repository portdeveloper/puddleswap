#!/usr/bin/env bash
set -euo pipefail

SERVICE_NAME="${SERVICE_NAME:-dex-rebalancer}"
PRIVATE_KEY_VALUE="${PRIVATE_KEY:-${REBALANCER_PRIVATE_KEY:-}}"
DISCORD_WEBHOOK_VALUE="${DISCORD_WEBHOOK_URL:-${REBALANCER_DISCORD_WEBHOOK_URL:-}}"

if ! railway whoami >/dev/null 2>&1; then
  echo "Railway CLI is not authenticated. Run: railway login --browserless"
  exit 1
fi

if ! railway status >/dev/null 2>&1; then
  echo "Directory is not linked to a Railway project. Run: railway link"
  exit 1
fi

if [[ -z "$PRIVATE_KEY_VALUE" ]]; then
  echo "PRIVATE_KEY (or REBALANCER_PRIVATE_KEY) is required."
  exit 1
fi

echo "Ensuring service exists: $SERVICE_NAME"
railway add --service "$SERVICE_NAME" >/dev/null 2>&1 || true

echo "Setting service variables"
printf "%s" "$PRIVATE_KEY_VALUE" | railway variable set --service "$SERVICE_NAME" PRIVATE_KEY --stdin
railway variable set --service "$SERVICE_NAME" \
  RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}" \
  REBALANCE_INTERVAL_SECONDS="${REBALANCE_INTERVAL_SECONDS:-300}" \
  REBALANCE_JITTER_SECONDS="${REBALANCE_JITTER_SECONDS:-30}" \
  TARGET_STABLE_PER_WMON="${TARGET_STABLE_PER_WMON:-100000000}" \
  TARGET_TOLERANCE_BPS="${TARGET_TOLERANCE_BPS:-50}" \
  MAX_INPUT_FRACTION_BPS="${MAX_INPUT_FRACTION_BPS:-5000}" \
  LOW_MON_THRESHOLD_MON="${LOW_MON_THRESHOLD_MON:-200}" \
  LOW_BALANCE_ALERT_COOLDOWN_SECONDS="${LOW_BALANCE_ALERT_COOLDOWN_SECONDS:-21600}" \
  >/dev/null

if [[ -n "$DISCORD_WEBHOOK_VALUE" ]]; then
  printf "%s" "$DISCORD_WEBHOOK_VALUE" | railway variable set --service "$SERVICE_NAME" DISCORD_WEBHOOK_URL --stdin >/dev/null
fi

echo "Deploying service"
railway up --service "$SERVICE_NAME" --detach

echo "Done. Check logs with:"
echo "  railway logs --service $SERVICE_NAME"
