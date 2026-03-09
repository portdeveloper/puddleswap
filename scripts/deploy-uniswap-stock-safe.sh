#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

: "${SAFE_ADDRESS:?SAFE_ADDRESS is required}"
: "${RPC_URL:=https://testnet-rpc.monad.xyz}"
: "${CHAIN_ID:=10143}"

MODE="${MODE:-factory}"

if [[ "$MODE" == "factory" ]]; then
  : "${FEE_TO_SETTER:?FEE_TO_SETTER is required for MODE=factory}"

  FACTORY_BYTECODE="$(cd contracts && forge inspect lib/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory bytecode)"
  FACTORY_ARGS="$(cast abi-encode 'constructor(address)' "$FEE_TO_SETTER")"
  DEPLOYMENT_BYTECODE="${FACTORY_BYTECODE}${FACTORY_ARGS#0x}"

  SAFE_ADDRESS="$SAFE_ADDRESS" \
  RPC_URL="$RPC_URL" \
  CHAIN_ID="$CHAIN_ID" \
  SAFE_TX_SERVICE_URL="${SAFE_TX_SERVICE_URL:-https://api.safe.global/tx-service/monad-testnet/api/v1}" \
  SAFE_CREATE_CALL="${SAFE_CREATE_CALL:-0x9b35Af71d77eaf8d7e40252370304687390A1A52}" \
  SAFE_API_KEY="${SAFE_API_KEY:-}" \
  SAFE_ORIGIN="uniswap-v2-factory" \
  DEPLOYMENT_BYTECODE="$DEPLOYMENT_BYTECODE" \
  node scripts/safe/propose-create.mjs

  echo "Factory deployment proposed. Execute in Safe queue before proposing router."

elif [[ "$MODE" == "router" ]]; then
  : "${FACTORY_ADDRESS:?FACTORY_ADDRESS is required for MODE=router}"
  : "${WMON_ADDRESS:?WMON_ADDRESS is required for MODE=router}"

  ROUTER_BYTECODE="$(cd contracts && forge inspect lib/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 bytecode)"
  ROUTER_ARGS="$(cast abi-encode 'constructor(address,address)' "$FACTORY_ADDRESS" "$WMON_ADDRESS")"
  DEPLOYMENT_BYTECODE="${ROUTER_BYTECODE}${ROUTER_ARGS#0x}"

  SAFE_ADDRESS="$SAFE_ADDRESS" \
  RPC_URL="$RPC_URL" \
  CHAIN_ID="$CHAIN_ID" \
  SAFE_TX_SERVICE_URL="${SAFE_TX_SERVICE_URL:-https://api.safe.global/tx-service/monad-testnet/api/v1}" \
  SAFE_CREATE_CALL="${SAFE_CREATE_CALL:-0x9b35Af71d77eaf8d7e40252370304687390A1A52}" \
  SAFE_API_KEY="${SAFE_API_KEY:-}" \
  SAFE_ORIGIN="uniswap-v2-router" \
  DEPLOYMENT_BYTECODE="$DEPLOYMENT_BYTECODE" \
  node scripts/safe/propose-create.mjs

  echo "Router deployment proposed."

else
  echo "Unsupported MODE: $MODE"
  echo "Use MODE=factory or MODE=router"
  exit 1
fi

echo "Open queue: https://app.safe.global/transactions/queue?safe=monad-testnet:${SAFE_ADDRESS}"
