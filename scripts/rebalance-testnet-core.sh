#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}"
ACCOUNT_NAME="${ACCOUNT_NAME:-puddleswap}"
PASSWORD_FILE="${PASSWORD_FILE:-$HOME/.monad-keystore-password}"
PRIVATE_KEY="${PRIVATE_KEY:-}"
TARGET_STABLE_PER_WMON="${TARGET_STABLE_PER_WMON:-1000000000}"
TARGET_TOLERANCE_BPS="${TARGET_TOLERANCE_BPS:-50}"
SEED_WMON_WEI="${SEED_WMON_WEI:-1000000000000000000000}"
GAS_BUFFER_WEI="${GAS_BUFFER_WEI:-5000000000000000000}"

ADDR_FILE="config/addresses/10143.json"

FACTORY_ADDRESS="${FACTORY_ADDRESS:-$(jq -r '.contracts.uniswapV2Factory' "$ADDR_FILE")}"
ROUTER_ADDRESS="${ROUTER_ADDRESS:-$(jq -r '.contracts.uniswapV2Router02' "$ADDR_FILE")}"
USDC_ADDRESS="${USDC_ADDRESS:-$(jq -r '.contracts.usdc' "$ADDR_FILE")}"
USDT_ADDRESS="${USDT_ADDRESS:-$(jq -r '.contracts.testUSDT' "$ADDR_FILE")}"
WMON_ADDRESS="${WMON_ADDRESS:-$(jq -r '.contracts.wmon' "$ADDR_FILE")}"

if [[ -n "$PRIVATE_KEY" ]]; then
  OPERATOR_ADDRESS="${OPERATOR_ADDRESS:-$(cast wallet address --private-key "$PRIVATE_KEY")}"
else
  OPERATOR_ADDRESS="${OPERATOR_ADDRESS:-$(cast wallet address --account "$ACCOUNT_NAME" --password-file "$PASSWORD_FILE")}"
fi

for v in FACTORY_ADDRESS ROUTER_ADDRESS USDC_ADDRESS USDT_ADDRESS WMON_ADDRESS OPERATOR_ADDRESS; do
  if [[ -z "${!v}" || "${!v}" == "null" ]]; then
    echo "Missing required value: $v"
    exit 1
  fi
done

echo "Rebalancing core pools with operator: $OPERATOR_ADDRESS"

echo "Factory: $FACTORY_ADDRESS"
echo "Router:  $ROUTER_ADDRESS"
echo "USDC:    $USDC_ADDRESS"
echo "USDT:    $USDT_ADDRESS"
echo "WMON:    $WMON_ADDRESS"

echo "Target stable/WMON: $TARGET_STABLE_PER_WMON (6-decimal stable units)"
echo "Tolerance bps:      $TARGET_TOLERANCE_BPS"
echo "Seed WMON (wei):    $SEED_WMON_WEI"

pushd contracts >/dev/null
if [[ -n "$PRIVATE_KEY" ]]; then
  FACTORY_ADDRESS="$FACTORY_ADDRESS" \
  ROUTER_ADDRESS="$ROUTER_ADDRESS" \
  USDC_ADDRESS="$USDC_ADDRESS" \
  USDT_ADDRESS="$USDT_ADDRESS" \
  WMON_ADDRESS="$WMON_ADDRESS" \
  OPERATOR_ADDRESS="$OPERATOR_ADDRESS" \
  TARGET_STABLE_PER_WMON="$TARGET_STABLE_PER_WMON" \
  TARGET_TOLERANCE_BPS="$TARGET_TOLERANCE_BPS" \
  SEED_WMON_WEI="$SEED_WMON_WEI" \
  GAS_BUFFER_WEI="$GAS_BUFFER_WEI" \
  forge script script/RebalanceCorePools.s.sol:RebalanceCorePools \
    --rpc-url "$RPC_URL" \
    --private-key "$PRIVATE_KEY" \
    --broadcast
else
  FACTORY_ADDRESS="$FACTORY_ADDRESS" \
  ROUTER_ADDRESS="$ROUTER_ADDRESS" \
  USDC_ADDRESS="$USDC_ADDRESS" \
  USDT_ADDRESS="$USDT_ADDRESS" \
  WMON_ADDRESS="$WMON_ADDRESS" \
  OPERATOR_ADDRESS="$OPERATOR_ADDRESS" \
  TARGET_STABLE_PER_WMON="$TARGET_STABLE_PER_WMON" \
  TARGET_TOLERANCE_BPS="$TARGET_TOLERANCE_BPS" \
  SEED_WMON_WEI="$SEED_WMON_WEI" \
  GAS_BUFFER_WEI="$GAS_BUFFER_WEI" \
  forge script script/RebalanceCorePools.s.sol:RebalanceCorePools \
    --rpc-url "$RPC_URL" \
    --account "$ACCOUNT_NAME" \
    --password-file "$PASSWORD_FILE" \
    --broadcast
fi
popd >/dev/null

echo "Rebalance run complete."
