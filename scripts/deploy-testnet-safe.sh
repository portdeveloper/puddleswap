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

TARGET_SCRIPT="${TARGET_SCRIPT:-DeployDexCore}"
SCRIPT_PATH="script/${TARGET_SCRIPT}.s.sol:${TARGET_SCRIPT}"

pushd contracts >/dev/null
forge script "$SCRIPT_PATH" --rpc-url "$RPC_URL" --sender "$SAFE_ADDRESS"
popd >/dev/null

BROADCAST_FILE="${BROADCAST_FILE:-contracts/broadcast/${TARGET_SCRIPT}.s.sol/${CHAIN_ID}/dry-run/run-latest.json}"

SAFE_ADDRESS="$SAFE_ADDRESS" \
RPC_URL="$RPC_URL" \
CHAIN_ID="$CHAIN_ID" \
BROADCAST_FILE="$BROADCAST_FILE" \
SAFE_TX_SERVICE_URL="${SAFE_TX_SERVICE_URL:-https://api.safe.global/tx-service/monad-testnet/api/v1}" \
SAFE_CREATE_CALL="${SAFE_CREATE_CALL:-0x9b35Af71d77eaf8d7e40252370304687390A1A52}" \
SAFE_API_KEY="${SAFE_API_KEY:-}" \
node scripts/safe/propose-broadcast.mjs

echo "Safe transactions proposed successfully for ${TARGET_SCRIPT}."
echo "Open queue: https://app.safe.global/transactions/queue?safe=monad-testnet:${SAFE_ADDRESS}"
