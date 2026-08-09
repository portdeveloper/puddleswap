#!/usr/bin/env bash
set -euo pipefail

# Read-only PuddleSwap pool health reporter. Replaces the retired rebalancer:
# it observes the core pools and publishes a status doc + Discord anomaly pings,
# but holds NO key and signs NO transaction. Purely informational.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

INTERVAL_SECONDS="${REPORT_INTERVAL_SECONDS:-300}"
REPORT_ONCE="${REPORT_ONCE:-0}"
RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}"
DISCORD_WEBHOOK_URL="${DISCORD_WEBHOOK_URL:-}"

# Anomaly thresholds (per cycle, vs the previous observation).
PRICE_MOVE_ALERT_PCT="${PRICE_MOVE_ALERT_PCT:-15}"
RESERVE_DRAIN_ALERT_PCT="${RESERVE_DRAIN_ALERT_PCT:-25}"
CROSS_POOL_DIVERGENCE_ALERT_PCT="${CROSS_POOL_DIVERGENCE_ALERT_PCT:-25}"
USDC_MIN_WMON_DEPTH="${USDC_MIN_WMON_DEPTH:-500}"
USDT_MIN_WMON_DEPTH="${USDT_MIN_WMON_DEPTH:-1000}"
ANOMALY_ALERT_COOLDOWN_SECONDS="${ANOMALY_ALERT_COOLDOWN_SECONDS:-3600}"
STATE_DIR="${STATE_DIR:-/app/state}"
mkdir -p "$STATE_DIR"

ADDR_FILE="$ROOT_DIR/config/addresses/10143.json"
FACTORY_ADDRESS="${FACTORY_ADDRESS:-$(jq -r '.contracts.uniswapV2Factory' "$ADDR_FILE")}"
USDC_ADDRESS="${USDC_ADDRESS:-$(jq -r '.contracts.usdc' "$ADDR_FILE")}"
USDT_ADDRESS="${USDT_ADDRESS:-$(jq -r '.contracts.testUSDT' "$ADDR_FILE")}"
WMON_ADDRESS="${WMON_ADDRESS:-$(jq -r '.contracts.wmon' "$ADDR_FILE")}"

# port-monitor heartbeat gist (same doc the rebalancer used).
HEARTBEAT_GIST_ID="${HEARTBEAT_GIST_ID:-44b8bbb6180de10e510d2d84baed799a}"
HEARTBEAT_GIST_TOKEN="${HEARTBEAT_GIST_TOKEN:-${GH_PAT:-}}"

send_discord_alert() {
  local message="$1"
  [[ -z "$DISCORD_WEBHOOK_URL" ]] && { echo "Discord not configured."; return 1; }
  curl -fsS -X POST "$DISCORD_WEBHOOK_URL" -H "Content-Type: application/json" \
    -d "$(jq -n --arg content "$message" '{content: $content}')" >/dev/null
}

# Echoes "stableReserve wmonReserve price" (price = stable per WMON, 6-dec units
# scaled by 1e18/1e18 => integer stable-per-1-WMON*1e0). Returns non-zero when
# any required read fails so the cycle cannot publish a false healthy status.
read_pool() {
  local stable="$1" pair token0 reserves r0 r1 sres wres
  if ! pair="$(cast call "$FACTORY_ADDRESS" "getPair(address,address)(address)" "$stable" "$WMON_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null)"; then
    return 1
  fi
  [[ -z "$pair" || "$pair" == 0x0000000000000000000000000000000000000000 ]] && return 1
  if ! token0="$(cast call "$pair" "token0()(address)" --rpc-url "$RPC_URL" 2>/dev/null)"; then
    return 1
  fi
  if ! reserves="$(cast call "$pair" "getReserves()(uint112,uint112,uint32)" --rpc-url "$RPC_URL" 2>/dev/null)"; then
    return 1
  fi
  reserves="$(cut -d' ' -f1 <<<"$reserves")"
  r0="$(echo "$reserves" | sed -n 1p)"; r1="$(echo "$reserves" | sed -n 2p)"
  [[ -z "$token0" || -z "$r0" || -z "$r1" ]] && return 1
  if [[ "$(echo "$token0" | tr 'A-F' 'a-f')" == "$(echo "$stable" | tr 'A-F' 'a-f')" ]]; then sres="$r0"; wres="$r1"; else sres="$r1"; wres="$r0"; fi
  [[ "$sres" =~ ^[0-9]+$ && "$wres" =~ ^[0-9]+$ ]] || return 1
  [[ "$wres" != "0" ]] || return 1
  # price = stable(6dec) per 1 WMON(18dec) = sres*1e18/wres, in 6-dec units.
  awk -v s="$sres" -v w="$wres" 'BEGIN { if (w+0>0) printf "%s %s %d", s, w, (s*1e18/w); }'
}

publish_status() {
  local summary="$1" status="$2"
  echo "heartbeat status=$status"
  if [[ -z "$HEARTBEAT_GIST_TOKEN" ]]; then
    echo "heartbeat disabled: token not configured"
    return 1
  fi
  local now content payload http
  now="$(date -u +"%Y-%m-%dT%H:%M:%SZ")"
  content="$(jq -n --arg worker "puddleswap-pool-health" --arg now "$now" \
    --arg status "$status" --arg summary "$summary" \
    '{worker:$worker, lastAttempt:$now, lastRun:$now, lastStatus:$status, summary:$summary}')"
  payload="$(jq -n --arg c "$content" '{files: {"heartbeat.json": {content: $c}}}')"
  http="$(curl -sS -o /dev/null -w "%{http_code}" -X PATCH "https://api.github.com/gists/$HEARTBEAT_GIST_ID" \
    -H "Authorization: Bearer $HEARTBEAT_GIST_TOKEN" -H "Accept: application/vnd.github+json" \
    -d "$payload" 2>/dev/null)" || true
  echo "heartbeat http=$http"
  [[ "$http" =~ ^2[0-9][0-9]$ ]]
}

maybe_alert_anomaly() {
  local label="$1" msg="$2" key="$3" now_ts last_ts state_file
  state_file="$STATE_DIR/anomaly-${key}.ts"
  now_ts="$(date +%s)"; last_ts=0
  [[ -f "$state_file" ]] && last_ts="$(cat "$state_file" 2>/dev/null || echo 0)"
  [[ "$last_ts" =~ ^[0-9]+$ ]] || last_ts=0
  if (( now_ts - last_ts < ANOMALY_ALERT_COOLDOWN_SECONDS )); then
    echo "anomaly [$label] within cooldown: $msg"; return
  fi
  if send_discord_alert "PUDDLE POOL ALERT: $msg"; then echo "$now_ts" > "$state_file"; echo "alerted: $msg"; fi
}

check_pool() {
  local label="$1" stable="$2" pool_key="$3" min_depth="$4" data prev_file slug
  slug="$(echo "$label" | tr '/' '-')"
  if ! data="$(read_pool "$stable")" || [[ -z "$data" ]]; then
    echo "$label: no pool / read failed"
    return 1
  fi
  local sres wres price; read -r sres wres price <<<"$data"
  local price_h; price_h="$(awk -v p="$price" 'BEGIN { printf "%.6f", p/1e6 }')"
  local wmon_h; wmon_h="$(cast from-wei "$wres" ether 2>/dev/null | cut -d. -f1)"
  echo "$label: price=${price_h} stable/WMON, WMON depth=${wmon_h}"
  SUMMARY+="${label} ${price_h} (WMON ${wmon_h}); "

  if [[ "$pool_key" == "usdc" ]]; then
    USDC_PRICE="$price"
  else
    USDT_PRICE="$price"
  fi

  if awk -v d="$wmon_h" -v t="$min_depth" 'BEGIN { exit !(d+0 < t+0) }'; then
    maybe_alert_anomaly "$label" \
      "${label} WMON depth is below ${min_depth} (now ${wmon_h} WMON)" "low-depth-${slug}"
  fi

  prev_file="$STATE_DIR/prev-${slug}.kv"
  if [[ -f "$prev_file" ]]; then
    read -r pprice pwres < "$prev_file" || true
    if [[ "$pprice" =~ ^[0-9]+$ ]] && (( pprice > 0 )); then
      local move; move="$(awk -v a="$pprice" -v b="$price" 'BEGIN { d=(b-a)/a*100; printf "%.1f", d<0?-d:d }')"
      awk -v m="$move" -v t="$PRICE_MOVE_ALERT_PCT" 'BEGIN { exit !(m+0 >= t+0) }' && \
        maybe_alert_anomaly "$label" "${label} price moved ${move}% since last check (now ${price_h} stable/WMON)" "price-${slug}"
    fi
    if [[ "$pwres" =~ ^[0-9]+$ ]] && (( pwres > 0 )); then
      local drain; drain="$(awk -v a="$pwres" -v b="$wres" 'BEGIN { d=(a-b)/a*100; printf "%.1f", d }')"
      awk -v d="$drain" -v t="$RESERVE_DRAIN_ALERT_PCT" 'BEGIN { exit !(d+0 >= t+0) }' && \
        maybe_alert_anomaly "$label" "${label} WMON reserve dropped ${drain}% since last check (now ${wmon_h} WMON)" "drain-${slug}"
    fi
  fi
  echo "$price $wres" > "$prev_file"
}

check_cross_pool_divergence() {
  [[ "$USDC_PRICE" =~ ^[0-9]+$ && "$USDT_PRICE" =~ ^[0-9]+$ ]] || return 1
  (( USDC_PRICE > 0 && USDT_PRICE > 0 )) || return 1
  local divergence
  divergence="$(awk -v a="$USDC_PRICE" -v b="$USDT_PRICE" \
    'BEGIN { lo=a<b?a:b; hi=a>b?a:b; printf "%.1f", (hi-lo)/lo*100 }')"
  echo "cross-pool price divergence=${divergence}%"
  SUMMARY+="cross-pool divergence ${divergence}%; "
  if awk -v d="$divergence" -v t="$CROSS_POOL_DIVERGENCE_ALERT_PCT" \
    'BEGIN { exit !(d+0 >= t+0) }'; then
    maybe_alert_anomaly "cross-pool" \
      "USDC/WMON and USDT/WMON prices differ by ${divergence}%" "cross-pool-divergence"
  fi
}

echo "Starting PuddleSwap pool health reporter (read-only)"
echo "RPC: configured (URL redacted)  interval: ${INTERVAL_SECONDS}s"
echo "Alerts: price move >=${PRICE_MOVE_ALERT_PCT}%, reserve drain >=${RESERVE_DRAIN_ALERT_PCT}%, cross-pool divergence >=${CROSS_POOL_DIVERGENCE_ALERT_PCT}% (Discord $([[ -n "$DISCORD_WEBHOOK_URL" ]] && echo on || echo off))"

while true; do
  echo "[$(date -u +"%Y-%m-%dT%H:%M:%SZ")] health cycle"
  SUMMARY=""
  USDC_PRICE=""
  USDT_PRICE=""
  cycle_status="ok"
  check_pool "USDC/WMON" "$USDC_ADDRESS" "usdc" "$USDC_MIN_WMON_DEPTH" || cycle_status="degraded"
  check_pool "USDT/WMON" "$USDT_ADDRESS" "usdt" "$USDT_MIN_WMON_DEPTH" || cycle_status="degraded"
  check_cross_pool_divergence || cycle_status="degraded"
  if ! publish_status "${SUMMARY%%; }" "$cycle_status"; then
    echo "health cycle degraded: heartbeat publication failed"
    maybe_alert_anomaly "heartbeat" "Pool health heartbeat publication failed" "heartbeat" || true
  fi
  [[ "$REPORT_ONCE" == "1" ]] && break
  sleep "$INTERVAL_SECONDS"
done
