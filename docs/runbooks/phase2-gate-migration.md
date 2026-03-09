# Runbook: Phase 2 Migration to PassRegistrationGate

## Goal
Replace open registration gate with NFT pass-gated registration.

## Steps

1. Propose phase2 deployment txs:

```bash
TARGET_SCRIPT=DeployPhase2PassGate make deploy-testnet-safe
```

2. Execute all queued txs in Safe UI.

The script deploys:
- `RegistrationPass`
- `PassRegistrationGate`

And configures:
- `RegistrationPass.CONSUMER_ROLE -> PassRegistrationGate`
- `PassRegistrationGate.REGISTRY_ROLE -> TokenRegistry`
- `TokenRegistry.setRegistrationGate(passGate)`

## Post-migration validation

1. `TokenRegistry.registrationGate()` equals deployed `PassRegistrationGate`.
2. `OpenRegistrationGate` no longer used for new registrations.
3. Mint a short-lived pass and verify `registerBasic` consumes it.
