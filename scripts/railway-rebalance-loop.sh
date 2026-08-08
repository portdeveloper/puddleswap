#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INTERVAL_SECONDS="${REBALANCE_INTERVAL_SECONDS:-300}"
JITTER_SECONDS="${REBALANCE_JITTER_SECONDS:-30}"
RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}"
LOW_MON_THRESHOLD_MON="${LOW_MON_THRESHOLD_MON:-200}"
GAS_BUFFER_MON="${GAS_BUFFER_MON:-25}"
MAX_INPUT_FRACTION_BPS="${MAX_INPUT_FRACTION_BPS:-5000}"
LOW_BALANCE_ALERT_COOLDOWN_SECONDS="${LOW_BALANCE_ALERT_COOLDOWN_SECONDS:-21600}"
FAILURE_ALERT_THRESHOLD="${FAILURE_ALERT_THRESHOLD:-3}"
FAILURE_ALERT_COOLDOWN_SECONDS="${FAILURE_ALERT_COOLDOWN_SECONDS:-3600}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"
LOW_BALANCE_ALERT_STATE_FILE="${LOW_BALANCE_ALERT_STATE_FILE:-/app/state/low-mon-alert.ts}"
FAILURE_ALERT_STATE_FILE="${FAILURE_ALERT_STATE_FILE:-/app/state/failure-alert.ts}"
mkdir -p "$(dirname "$LOW_BALANCE_ALERT_STATE_FILE")" "$(dirname "$FAILURE_ALERT_STATE_FILE")"

# Token/factory addresses, used to size the low-balance threshold from what a
# cycle can actually spend (MAX_INPUT_FRACTION_BPS of the largest WMON reserve).
ADDR_FILE="$ROOT_DIR/config/addresses/10143.json"
FACTORY_ADDRESS="${FACTORY_ADDRESS:-$(jq -r '.contracts.uniswapV2Factory' "$ADDR_FILE")}"
USDC_ADDRESS="${USDC_ADDRESS:-$(jq -r '.contracts.usdc' "$ADDR_FILE")}"
USDT_ADDRESS="${USDT_ADDRESS:-$(jq -r '.contracts.testUSDT' "$ADDR_FILE")}"
WMON_ADDRESS="${WMON_ADDRESS:-$(jq -r '.contracts.wmon' "$ADDR_FILE")}"

# port-monitor heartbeat: a status doc published to a gist each cycle and read by
# port-monitor (the central pager). Needs a token with `gist` scope.
HEARTBEAT_GIST_ID="${HEARTBEAT_GIST_ID:-44b8bbb6180de10e510d2d84baed799a}"
HEARTBEAT_GIST_TOKEN="${HEARTBEAT_GIST_TOKEN:-${GH_PAT:-}}"
LAST_SUCCESS_ISO=""

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

# Publish run status to the heartbeat gist. Best-effort: never fails the loop.
# lastRun tracks the last *success* (kept across cycles in this process).
publish_status() {
  local status="$1" summary="${2:-}" error="${3:-}"
  if [[ -z "$HEARTBEAT_GIST_TOKEN" ]]; then return 0; fi
  local now
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  if [[ "$status" == "ok" ]]; then LAST_SUCCESS_ISO="$now"; fi
  local content payload
  content="$(jq -n \
    --arg worker "puddleswap-dex-rebalancer" \
    --arg lastAttempt "$now" \
    --arg lastRun "$LAST_SUCCESS_ISO" \
    --arg lastStatus "$status" \
    --arg lastError "$error" \
    --arg summary "$summary" \
    '{worker:$worker, lastAttempt:$lastAttempt, lastRun:(if $lastRun=="" then null else $lastRun end), lastStatus:$lastStatus, lastError:(if $lastError=="" then null else $lastError end), summary:$summary}')"
  payload="$(jq -n --arg c "$content" '{files: {"heartbeat.json": {content: $c}}}')"
  local http
  http="$(curl -sS -o /tmp/hb_resp -w "%{http_code}" -X PATCH "https://api.github.com/gists/$HEARTBEAT_GIST_ID" \
    -H "Authorization: Bearer $HEARTBEAT_GIST_TOKEN" \
    -H "Accept: application/vnd.github+json" \
    -H "Content-Type: application/json" \
    -d "$payload" 2>/tmp/hb_err)" || true
  if [[ "$http" == "200" ]]; then
    echo "port-monitor heartbeat published (http 200)"
  else
    echo "port-monitor heartbeat publish failed http=[$http] err=[$(head -c 150 /tmp/hb_err 2>/dev/null)] body=[$(head -c 200 /tmp/hb_resp 2>/dev/null)]"
  fi
}

# Worst-case MON a single cycle can need: MAX_INPUT_FRACTION_BPS of the largest
# core-pair WMON reserve, plus a gas buffer. Falls back to 0 on RPC errors so the
# static LOW_MON_THRESHOLD_MON still applies.
required_mon_for_cycle() {
  local stable pair token0 reserves r0 r1 wmon_wei wmon_mon max_wmon_mon=0
  for stable in "$USDC_ADDRESS" "$USDT_ADDRESS"; do
    pair="$(cast call "$FACTORY_ADDRESS" "getPair(address,address)(address)" "$stable" "$WMON_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "")"
    if [[ -z "$pair" || "$pair" == "0x0000000000000000000000000000000000000000" ]]; then continue; fi
    token0="$(cast call "$pair" "token0()(address)" --rpc-url "$RPC_URL" 2>/dev/null || echo "")"
    reserves="$(cast call "$pair" "getReserves()(uint112,uint112,uint32)" --rpc-url "$RPC_URL" 2>/dev/null | sed 's/ \[.*//' || echo "")"
    r0="$(echo "$reserves" | sed -n 1p)"
    r1="$(echo "$reserves" | sed -n 2p)"
    if [[ -z "$token0" || -z "$r0" || -z "$r1" ]]; then continue; fi
    if [[ "$(echo "$token0" | tr 'A-F' 'a-f')" == "$(echo "$WMON_ADDRESS" | tr 'A-F' 'a-f')" ]]; then wmon_wei="$r0"; else wmon_wei="$r1"; fi
    wmon_mon="$(cast from-wei "$wmon_wei" ether 2>/dev/null || echo 0)"
    max_wmon_mon="$(awk -v a="$max_wmon_mon" -v b="$wmon_mon" 'BEGIN { print (b > a) ? b : a }')"
  done
  awk -v r="$max_wmon_mon" -v bps="$MAX_INPUT_FRACTION_BPS" -v gas="$GAS_BUFFER_MON" \
    'BEGIN { printf "%.2f", r * bps / 10000 + gas }'
}

check_low_mon_balance() {
  local balance_wei balance_mon required_mon effective_threshold now_ts last_ts

  balance_wei="$(cast balance "$OPERATOR_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null || echo "")"
  if [[ -z "$balance_wei" ]]; then
    echo "Could not fetch MON balance for $OPERATOR_ADDRESS"
    return
  fi

  balance_mon="$(cast from-wei "$balance_wei" ether 2>/dev/null || echo "0")"

  required_mon="$(required_mon_for_cycle)"
  effective_threshold="$(awk -v a="$LOW_MON_THRESHOLD_MON" -v b="$required_mon" 'BEGIN { print (b > a) ? b : a }')"

  if ! awk -v bal="$balance_mon" -v thr="$effective_threshold" 'BEGIN { exit !(bal < thr) }'; then
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
  message=$'PUDDLE ALERT: Low MON balance on rebalancer wallet\n'
  message+="address: ${OPERATOR_ADDRESS}"$'\n'
  message+="balance: ${balance_mon} MON"$'\n'
  message+="threshold: ${effective_threshold} MON (static ${LOW_MON_THRESHOLD_MON}, cycle needs ~${required_mon})"$'\n'
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

# Page Discord after FAILURE_ALERT_THRESHOLD consecutive cycle failures (with
# cooldown), and send a recovery notice once cycles succeed again.
CONSECUTIVE_FAILURES=0
FAILURE_ALERTED=0

alert_on_failure_streak() {
  local now_ts last_ts
  if (( CONSECUTIVE_FAILURES < FAILURE_ALERT_THRESHOLD )); then
    return
  fi
  now_ts="$(date +%s)"
  last_ts=0
  if [[ -f "$FAILURE_ALERT_STATE_FILE" ]]; then
    last_ts="$(cat "$FAILURE_ALERT_STATE_FILE" 2>/dev/null || echo 0)"
  fi
  if ! [[ "$last_ts" =~ ^[0-9]+$ ]]; then
    last_ts=0
  fi
  if (( now_ts - last_ts < FAILURE_ALERT_COOLDOWN_SECONDS )); then
    echo "Failure streak (${CONSECUTIVE_FAILURES}) but alert cooldown is active."
    return
  fi

  local message
  message=$'PUDDLE ALERT: Rebalancer cycles are failing\n'
  message+="consecutive failures: ${CONSECUTIVE_FAILURES}"$'\n'
  message+="operator: ${OPERATOR_ADDRESS}"$'\n'
  message+="network: Monad testnet (10143)"$'\n'
  message+="time: $(date -u +"%Y-%m-%dT%H:%M:%SZ")"$'\n'
  message+="check: railway logs --service dex-rebalancer"

  if send_discord_alert "$message"; then
    echo "$now_ts" > "$FAILURE_ALERT_STATE_FILE"
    FAILURE_ALERTED=1
    echo "Failure streak alert sent to Discord."
  else
    echo "Failed to send failure streak alert to Discord."
  fi
}

while true; do
  STARTED_AT="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  echo "[$STARTED_AT] Rebalance cycle started"

  check_low_mon_balance

  if bash "$ROOT_DIR/scripts/rebalance-testnet-core.sh"; then
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rebalance cycle succeeded"
    if (( FAILURE_ALERTED )); then
      send_discord_alert "PUDDLE RECOVERY: Rebalancer cycles are succeeding again (after ${CONSECUTIVE_FAILURES} consecutive failures)." || true
    fi
    CONSECUTIVE_FAILURES=0
    FAILURE_ALERTED=0
    publish_status "ok" "rebalance cycle ok" "" || true
  else
    EXIT_CODE=$?
    CONSECUTIVE_FAILURES=$((CONSECUTIVE_FAILURES + 1))
    echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] Rebalance cycle failed with exit code $EXIT_CODE (streak: $CONSECUTIVE_FAILURES)"
    publish_status "failed" "rebalance cycle failed" "exit code $EXIT_CODE" || true
    alert_on_failure_streak
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
