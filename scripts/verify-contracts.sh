#!/usr/bin/env bash
set -euo pipefail

# Verifies all deployed contracts on Monad testnet block explorers
# (Socialscan, MonadVision, Monadscan) via the devnads verification API.

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

if [[ -f .env ]]; then
  # shellcheck disable=SC1091
  source .env
fi

RPC_URL="${RPC_URL:-https://testnet-rpc.monad.xyz}"
CHAIN_ID="${CHAIN_ID:-10143}"
ADDR_FILE="config/addresses/${CHAIN_ID}.json"
API_URL="https://agents.devnads.com/v1/verify"

if [[ ! -f "$ADDR_FILE" ]]; then
  echo "Address file not found: $ADDR_FILE"
  exit 1
fi

# Build contracts to ensure out/ is fresh
echo "Building contracts..."
pushd contracts >/dev/null
forge build
popd >/dev/null

verify_contract() {
  local address="$1"
  local contract_path="$2"  # e.g. src/WMON.sol:WMON
  local constructor_args="${3:-}"

  local contract_name
  contract_name="${contract_path##*:}"
  local source_file
  source_file="${contract_path%%:*}"

  echo ""
  echo "=== Verifying ${contract_name} at ${address} ==="

  local artifact_file="contracts/out/${contract_name}.sol/${contract_name}.json"
  if [[ ! -f "$artifact_file" ]]; then
    echo "  ERROR: Artifact not found: $artifact_file"
    return 1
  fi

  local compiler_version
  # metadata may be a JSON string or object depending on forge version
  local meta_type
  meta_type="$(jq -r '.metadata | type' "$artifact_file")"
  if [[ "$meta_type" == "string" ]]; then
    compiler_version="$(jq -r '.metadata | fromjson | .compiler.version' "$artifact_file")"
  else
    compiler_version="$(jq -r '.metadata.compiler.version' "$artifact_file")"
  fi

  local standard_input
  standard_input="$(cd contracts && forge verify-contract "$address" "$contract_path" \
    --chain "$CHAIN_ID" \
    --show-standard-json-input 2>/dev/null)"

  local metadata
  if [[ "$meta_type" == "string" ]]; then
    metadata="$(jq '.metadata | fromjson' "$artifact_file")"
  else
    metadata="$(jq '.metadata' "$artifact_file")"
  fi

  local request_file
  request_file="$(mktemp)"

  if [[ -n "$constructor_args" ]]; then
    jq -n \
      --arg chainId "$CHAIN_ID" \
      --arg contractAddress "$address" \
      --arg contractName "$contract_path" \
      --arg compilerVersion "v${compiler_version}" \
      --argjson standardJsonInput "$standard_input" \
      --argjson foundryMetadata "$metadata" \
      --arg constructorArgs "$constructor_args" \
      '{
        chainId: ($chainId | tonumber),
        contractAddress: $contractAddress,
        contractName: $contractName,
        compilerVersion: $compilerVersion,
        standardJsonInput: $standardJsonInput,
        foundryMetadata: $foundryMetadata,
        constructorArgs: $constructorArgs
      }' > "$request_file"
  else
    jq -n \
      --arg chainId "$CHAIN_ID" \
      --arg contractAddress "$address" \
      --arg contractName "$contract_path" \
      --arg compilerVersion "v${compiler_version}" \
      --argjson standardJsonInput "$standard_input" \
      --argjson foundryMetadata "$metadata" \
      '{
        chainId: ($chainId | tonumber),
        contractAddress: $contractAddress,
        contractName: $contractName,
        compilerVersion: $compilerVersion,
        standardJsonInput: $standardJsonInput,
        foundryMetadata: $foundryMetadata
      }' > "$request_file"
  fi

  local response
  response="$(curl -fsS -X POST "$API_URL" \
    -H "Content-Type: application/json" \
    -d @"$request_file" 2>&1)" || {
    echo "  FAILED: $response"
    rm -f "$request_file"
    return 1
  }

  rm -f "$request_file"
  echo "  Response: $response"
}

# Read addresses
WMON="$(jq -r '.contracts.wmon' "$ADDR_FILE")"
USDC="$(jq -r '.contracts.usdc' "$ADDR_FILE")"
USDT="$(jq -r '.contracts.testUSDT' "$ADDR_FILE")"
FAUCET="$(jq -r '.contracts.stableFaucet' "$ADDR_FILE")"
FACTORY="$(jq -r '.contracts.uniswapV2Factory' "$ADDR_FILE")"
ROUTER="$(jq -r '.contracts.uniswapV2Router02' "$ADDR_FILE")"
OPEN_GATE="$(jq -r '.contracts.openRegistrationGate' "$ADDR_FILE")"
REGISTRY="$(jq -r '.contracts.tokenRegistry' "$ADDR_FILE")"

# Detect admin address from broadcast file or env.
ADMIN_ROLE="0x0000000000000000000000000000000000000000000000000000000000000000"
if [[ -z "${ADMIN_ADDRESS:-}" ]]; then
  BROADCAST_FILE="contracts/broadcast/DeployDexCore.s.sol/${CHAIN_ID}/run-latest.json"
  if [[ -f "$BROADCAST_FILE" ]]; then
    ADMIN_ADDRESS="$(jq -r '.transactions[0].transaction.from' "$BROADCAST_FILE")"
    echo "Detected admin from broadcast: $ADMIN_ADDRESS"
  fi
fi
: "${ADMIN_ADDRESS:?ADMIN_ADDRESS is required — set it in env or ensure broadcast files exist}"

# Sanity-check against chain
if cast call "$REGISTRY" "hasRole(bytes32,address)(bool)" "$ADMIN_ROLE" "$ADMIN_ADDRESS" --rpc-url "$RPC_URL" 2>/dev/null | grep -q true; then
  echo "Confirmed admin on chain: $ADMIN_ADDRESS"
else
  echo "WARNING: $ADMIN_ADDRESS does not have DEFAULT_ADMIN_ROLE on TokenRegistry"
fi

# Detect fee-to-setter for factory
FEE_TO_SETTER="$(cast call "$FACTORY" "feeToSetter()(address)" --rpc-url "$RPC_URL")"
echo "Detected feeToSetter: $FEE_TO_SETTER"

# Construct constructor args (ABI-encoded, no 0x prefix)

# WMON: no constructor args
verify_contract "$WMON" "src/WMON.sol:WMON" ""

# USDC: real Circle token — not ours to verify

# TestUSDT: constructor(address admin_)
USDT_ARGS="$(cast abi-encode 'constructor(address)' "$ADMIN_ADDRESS" | sed 's/^0x//')"
verify_contract "$USDT" "src/TestUSDT.sol:TestUSDT" "$USDT_ARGS"

# StableFaucet: constructor(address admin_, address usdc_, address usdt_, uint256 claimUSDC, uint256 claimUSDT, uint256 cooldown)
FAUCET_ARGS="$(cast abi-encode 'constructor(address,address,address,uint256,uint256,uint256)' \
  "$ADMIN_ADDRESS" "$USDC" "$USDT" 1000000000 1000000000 86400 | sed 's/^0x//')"
verify_contract "$FAUCET" "src/StableFaucet.sol:StableFaucet" "$FAUCET_ARGS"

# OpenRegistrationGate: constructor(address admin_, uint256 cooldown_, uint256 maxActiveRegistrations_)
GATE_ARGS="$(cast abi-encode 'constructor(address,uint256,uint256)' \
  "$ADMIN_ADDRESS" 604800 1 | sed 's/^0x//')"
verify_contract "$OPEN_GATE" "src/OpenRegistrationGate.sol:OpenRegistrationGate" "$GATE_ARGS"

# TokenRegistry: constructor(address admin_, address verifier_, address registrationGate_)
# Verifier defaults to admin in deploy script
REGISTRY_ARGS="$(cast abi-encode 'constructor(address,address,address)' \
  "$ADMIN_ADDRESS" "$ADMIN_ADDRESS" "$OPEN_GATE" | sed 's/^0x//')"
verify_contract "$REGISTRY" "src/TokenRegistry.sol:TokenRegistry" "$REGISTRY_ARGS"

# UniswapV2Factory: constructor(address feeToSetter)
FACTORY_ARGS="$(cast abi-encode 'constructor(address)' "$FEE_TO_SETTER" | sed 's/^0x//')"
verify_contract "$FACTORY" "lib/v2-core/contracts/UniswapV2Factory.sol:UniswapV2Factory" "$FACTORY_ARGS"

# UniswapV2Router02: constructor(address factory, address WETH)
ROUTER_ARGS="$(cast abi-encode 'constructor(address,address)' "$FACTORY" "$WMON" | sed 's/^0x//')"
verify_contract "$ROUTER" "lib/v2-periphery/contracts/UniswapV2Router02.sol:UniswapV2Router02" "$ROUTER_ARGS"

echo ""
echo "=== Verification complete ==="
