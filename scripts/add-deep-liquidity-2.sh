#!/usr/bin/env bash
set -euo pipefail

echo "Refusing to run: this legacy script used stale wallets, zero minimums,"
echo "and attempted to deepen the faucet-mintable USDT/WMON pool."
echo "Use a freshly simulated, bounded one-time transaction instead."
exit 1
