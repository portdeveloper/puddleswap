#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

: "${RPC_URL:=https://testnet-rpc.monad.xyz}"
: "${FEE_TO_SETTER:?FEE_TO_SETTER is required}"
ACCOUNT_NAME="${ACCOUNT_NAME:-puddleswap}"
PASSWORD_FILE="${PASSWORD_FILE:-$HOME/.monad-keystore-password}"

echo "Deploying Uniswap V2 with keystore account: ${ACCOUNT_NAME}"

pushd contracts >/dev/null

FACTORY_BYTECODE="$(forge inspect lib/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory bytecode)"
ROUTER_BYTECODE="$(forge inspect lib/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02 bytecode)"

FEE_TO_SETTER="$FEE_TO_SETTER" \
FACTORY_BYTECODE="$FACTORY_BYTECODE" \
ROUTER_BYTECODE="$ROUTER_BYTECODE" \
WMON_ADDRESS="${WMON_ADDRESS:-}" \
FACTORY_ADDRESS="${FACTORY_ADDRESS:-}" \
forge script script/DeployUniswapDirect.s.sol:DeployUniswapDirect \
  --rpc-url "$RPC_URL" \
  --account "$ACCOUNT_NAME" \
  --password-file "$PASSWORD_FILE" \
  --broadcast

popd >/dev/null

echo ""
echo "Uniswap V2 deployment complete."
echo "Update config/addresses/10143.json with deployed addresses, then run: make sync-artifacts"
