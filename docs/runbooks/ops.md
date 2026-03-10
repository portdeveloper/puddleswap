# Runbook: Ongoing Operations

All admin operations use the deployer keystore account via `cast send`.

## Rotate verifier role

```bash
cast send <TokenRegistry> "grantRole(bytes32,address)" <VERIFIER_ROLE> <newVerifier> \
  --account puddleswap --password-file ~/.monad-keystore-password --rpc-url https://testnet-rpc.monad.xyz
```

Optionally revoke old verifier role with `revokeRole`.

## Adjust faucet params

```bash
cast send <StableFaucet> "setClaimAmounts(uint256,uint256)" <usdcAmount> <usdtAmount> \
  --account puddleswap --password-file ~/.monad-keystore-password --rpc-url https://testnet-rpc.monad.xyz
```

Other functions: `setCooldown(uint256)`, `setEnabled(bool)`.

## Emergency admin mint

```bash
cast send <StableFaucet> "adminMint(address,address,uint256)" <token> <to> <amount> \
  --account puddleswap --password-file ~/.monad-keystore-password --rpc-url https://testnet-rpc.monad.xyz
```

## Registry moderation

- Promote/demote token level: `TokenRegistry.setTokenLevel(token, level)`
- Deactivate problematic token: `TokenRegistry.setTokenActive(token, false)`
- Adjust core routing token status: `TokenRegistry.setCore(token, bool)`
