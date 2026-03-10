#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

: "${RPC_URL:=https://testnet-rpc.monad.xyz}"
ACCOUNT_NAME="${ACCOUNT_NAME:-puddleswap}"
PASSWORD_FILE="${PASSWORD_FILE:-$HOME/.monad-keystore-password}"

TARGET_SCRIPT="${TARGET_SCRIPT:-DeployDexCore}"
SCRIPT_PATH="script/${TARGET_SCRIPT}.s.sol:${TARGET_SCRIPT}"

DEPLOYER_ADDRESS="$(cast wallet address --account "$ACCOUNT_NAME" --password-file "$PASSWORD_FILE")"
echo "Deploying ${TARGET_SCRIPT} with keystore account: ${ACCOUNT_NAME} (${DEPLOYER_ADDRESS})"

pushd contracts >/dev/null
ADMIN_ADDRESS="${ADMIN_ADDRESS:-$DEPLOYER_ADDRESS}" \
forge script "$SCRIPT_PATH" \
  --rpc-url "$RPC_URL" \
  --account "$ACCOUNT_NAME" \
  --password-file "$PASSWORD_FILE" \
  --sender "$DEPLOYER_ADDRESS" \
  --broadcast
popd >/dev/null

echo ""
echo "Deployment complete for ${TARGET_SCRIPT}."
echo "Update config/addresses/10143.json with deployed addresses, then run: make sync-artifacts"
