#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INTERVAL_SECONDS="${REBALANCE_INTERVAL_SECONDS:-300}"
JITTER_SECONDS="${REBALANCE_JITTER_SECONDS:-30}"
RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}"
LOW_MON_THRESHOLD_MON="${LOW_MON_THRESHOLD_MON:-200}"
LOW_BALANCE_ALERT_COOLDOWN_SECONDS="${LOW_BALANCE_ALERT_COOLDOWN_SECONDS:-21600}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
LOW_BALANCE_ALERT_STATE_FILE="${LOW_BALANCE_ALERT_STATE_FILE:-/app/state/low-mon-alert.ts}"
mkdir -p "$(dirname "$LOW_BALANCE_ALERT_STATE_FILE")"

if [[ -z "${PRIVATE_KEY:-}" ]]; then
  echo "PRIVATE_KEY is required."
  exit 1
fi

if ! [[ "$INTERVAL_SECONDS" =~ ^[0-9]+$ ]] || [[ "$INTERVAL_SECONDS" -lt 1 ]]; then
  echo "REBALANCE_INTERVAL_SECONDS must be a positive integer."
  exit 1
fi

if ! [[ "$JITTER_SECONDS" =~ ^[0-9]+$ ]]; then
  echo "REBALANCE_JITTER_SECONDS must be a non-negative integer."
  exit 1
fi

if ! [[ "$LOW_BALANCE_ALERT_COOLDOWN_SECONDS" =~ ^[0-9]+$ ]] || [[ "$LOW_BALANCE_ALERT_COOLDOWN_SECONDS" -lt 1 ]]; then
  echo "LOW_BALANCE_ALERT_COOLDOWN_SECONDS must be a positive integer."
  exit 1
fi

OPERATOR_ADDRESS="$(cast wallet address --private-key "$PRIVATE_KEY" 2>/dev/null)" || {
  echo "Failed to derive operator address from PRIVATE_KEY."
  exit 1
}

send_discord_alert() {
  local message="$1"
  if [[ -z "$DISCORD_WEBHOOK_URL" ]]; then
    echo "Discord webhook not configured; cannot send alert."
    return 1
  fi

  local payload
  payload="$(jq -n --arg content "$message" '{content: $content}')"
  curl -fsS -X POST "$DISCORD_WEBHOOK_URL" \
    -H "Content-Type: application/json" \
    -d "$payload" >/dev/null
}

check_low_mon_balance() {
  local balance_wei balance_mon now_ts last_ts

  balance_wei="$(cast balance "$OPERATOR_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "")"
  if [[ -z "$balance_wei" ]]; then
    echo "Could not fetch MON balance for $OPERATOR_ADDRESS"
    return
  fi

  balance_mon="$(cast from-wei "$balance_wei" ether 2>/dev/null || echo "0")"

  if ! awk -v bal="$balance_mon" -v thr="$LOW_MON_THRESHOLD_MON" 'BEGIN { exit !(bal < thr) }'; then
    return
  fi

  now_ts="$(date +%s)"
  last_ts=0
  if [[ -f "$LOW_BALANCE_ALERT_STATE_FILE" ]]; then
    last_ts="$(cat "$LOW_BALANCE_ALERT_STATE_FILE" 2>/dev/null || echo 0)"
  fi
  if ! [[ "$last_ts" =~ ^[0-9]+$ ]]; then
    last_ts=0
  fi

  if (( now_ts - last_ts < LOW_BALANCE_ALERT_COOLDOWN_SECONDS )); then
    echo "Low MON balance detected (${balance_mon} MON) but alert cooldown is active."
    return
  fi

  local timestamp
  timestamp="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  local message
  message=$'PORT SWAP ALERT: Low MON balance on rebalancer wallet\n'
  message+="address: ${OPERATOR_ADDRESS}"$'\n'
  message+="balance: ${balance_mon} MON"$'\n'
  message+="threshold: ${LOW_MON_THRESHOLD_MON} MON"$'\n'
  message+="network: Monad testnet (10143)"$'\n'
  message+="time: ${timestamp}"

  if send_discord_alert "$message"; then
    echo "$now_ts" > "$LOW_BALANCE_ALERT_STATE_FILE"
    echo "Low balance alert sent to Discord."
  else
    echo "Failed to send low balance alert to Discord."
  fi
}

echo "Starting Railway rebalancer loop"
echo "Interval: ${INTERVAL_SECONDS}s, Jitter: ${JITTER_SECONDS}s"
echo "RPC_URL: ${RPC_URL}"
echo "Operator: ${OPERATOR_ADDRESS}"
echo "Low MON threshold: ${LOW_MON_THRESHOLD_MON} MON"
if [[ -n "$DISCORD_WEBHOOK_URL" ]]; then
  echo "Discord alerts: enabled (cooldown ${LOW_BALANCE_ALERT_COOLDOWN_SECONDS}s)"
else
  echo "Discord alerts: disabled (set DISCORD_WEBHOOK_URL to enable)"
fi

while true; do
  STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[$STARTED_AT] Rebalance cycle started"

  check_low_mon_balance

  if bash "$ROOT_DIR/scripts/rebalance-testnet-core.sh"; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rebalance cycle succeeded"
  else
    EXIT_CODE=$?
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rebalance cycle failed with exit code $EXIT_CODE"
  fi

  check_low_mon_balance

  EXTRA_DELAY=0
  if [[ "$JITTER_SECONDS" -gt 0 ]]; then
    EXTRA_DELAY=$((RANDOM % (JITTER_SECONDS + 1)))
  fi
  SLEEP_FOR=$((INTERVAL_SECONDS + EXTRA_DELAY))

  echo "Sleeping ${SLEEP_FOR}s before next cycle"
  sleep "$SLEEP_FOR"
done
