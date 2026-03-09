# Runbook: Ongoing Operations

## Rotate verifier role

1. Propose Safe tx:
   - `TokenRegistry.grantRole(VERIFIER_ROLE, newVerifier)`
2. Execute via Safe.
3. Optionally revoke old verifier role.

## Adjust faucet params

1. Propose one or more Safe txs:
   - `StableFaucet.setClaimAmounts(usdcAmount, usdtAmount)`
   - `StableFaucet.setCooldown(seconds)`
   - `StableFaucet.setEnabled(bool)`
2. Execute via Safe.

## Emergency admin mint

1. Propose `StableFaucet.adminMint(token, to, amount)` as Safe/operator role.
2. Execute via Safe.

## Registry moderation

1. Promote/demote token level:
   - `TokenRegistry.setTokenLevel(token, level)`
2. Deactivate problematic token:
   - `TokenRegistry.setTokenActive(token, false)`
3. Adjust core routing token status:
   - `TokenRegistry.setCore(token, bool)`

## Pause mint surfaces (if enabled)

If pausable logic is enabled in token contracts, use Safe-admin pause and unpause functions.
