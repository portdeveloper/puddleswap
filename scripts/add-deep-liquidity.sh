#!/usr/bin/env bash
set -euo pipefail

# ─── Config ───
RPC="https://testnet-rpc.monad.xyz"
ACCOUNT="puddleswap"
ADDR="0xb0E956d64cd412Edb242839793C7910e5E15a298"

WMON="0x97B3070F9Da6C002343862b35E68Bd8e22608943"
USDC="0x534b2f3A21130d7a60830c2Df862319e593943A3"
USDT="0x1314b22df27BDcD4F8D11a0f4185943e55748917"
ROUTER="0x430c23895c8D44883526e3E0B09327dAD8766660"
FAUCET="0x50959dd2a4ef310f9aa2df9498cE9aC0aB956276"

# Amounts: 3950 WMON per pool, 3950000 stables per pool
MON_PER_POOL="3950000000000000000000"   # 3950e18
USDC_AMOUNT="3950000000000"              # 3,950,000 USDC (6 decimals)
USDT_AMOUNT="3950000000000"              # 3,950,000 USDT (6 decimals)
MAX_UINT256="115792089237316195423570985008687907853269984665640564039457584007913129639935"
DEADLINE=$(($(date +%s) + 3600))

echo "=== Step 1: Skipped (real USDC — wallet must be pre-funded) ==="

echo ""
echo "=== Step 2: Admin-mint 3,950,000 USDT ==="
cast send $FAUCET "adminMint(address,address,uint256)" \
  $USDT $ADDR $USDT_AMOUNT \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 3: Wrap 7900 MON → WMON ==="
cast send $WMON "deposit()" \
  --value "7900000000000000000000" \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 4: Approve router for WMON ==="
cast send $WMON "approve(address,uint256)" $ROUTER $MAX_UINT256 \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 5: Approve router for USDC ==="
cast send $USDC "approve(address,uint256)" $ROUTER $MAX_UINT256 \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 6: Approve router for USDT ==="
cast send $USDT "approve(address,uint256)" $ROUTER $MAX_UINT256 \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 7: Add liquidity WMON/USDC (3950 WMON + 3,950,000 USDC) ==="
cast send $ROUTER \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $WMON $USDC \
  $MON_PER_POOL $USDC_AMOUNT \
  0 0 \
  $ADDR $DEADLINE \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Step 8: Add liquidity WMON/USDT (3950 WMON + 3,950,000 USDT) ==="
cast send $ROUTER \
  "addLiquidity(address,address,uint256,uint256,uint256,uint256,address,uint256)" \
  $WMON $USDT \
  $MON_PER_POOL $USDT_AMOUNT \
  0 0 \
  $ADDR $DEADLINE \
  --account $ACCOUNT --rpc-url $RPC

echo ""
echo "=== Done! Checking new reserves ==="
echo ""

PAIR_USDC=$(cast call 0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B "getPair(address,address)(address)" $WMON $USDC --rpc-url $RPC)
PAIR_USDT=$(cast call 0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B "getPair(address,address)(address)" $WMON $USDT --rpc-url $RPC)

echo "WMON/USDC reserves:"
cast call $PAIR_USDC "getReserves()(uint112,uint112,uint32)" --rpc-url $RPC

echo ""
echo "WMON/USDT reserves:"
cast call $PAIR_USDT "getReserves()(uint112,uint112,uint32)" --rpc-url $RPC

echo ""
echo "Remaining MON balance:"
cast balance $ADDR --rpc-url $RPC --ether
