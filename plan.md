# PuddleSwap — Testnet Prod Plan

## Status: COMPLETE

All items done. Production URL: https://app.puddleswap.org

## 1. Replace Safe with Foundry Keystore — DONE

- Removed Safe deployment infrastructure
- New deploy scripts use `forge script --account puddleswap`
- All docs updated

## 2. Fix Rebalancer Key Management — DONE

- Deleted `.env.rebalancer.local`
- Key lives in Railway env vars only

## 3. Phase 2 Pass Registration — CUT

- Open registration is sufficient for testnet
- Removed RegistrationPass/PassRegistrationGate code

## 4. Restore CI — DONE

- `.github/workflows/ci.yml` restored

## 5. Fresh Contract Deployment — DONE

| Contract | Address |
|----------|---------|
| WMON | `0x97B3070F9Da6C002343862b35E68Bd8e22608943` |
| USDC | `0x534b2f3A21130d7a60830c2Df862319e593943A3` |
| TestUSDT | `0x1314b22df27BDcD4F8D11a0f4185943e55748917` |
| StableFaucet | `0x50959dd2a4ef310f9aa2df9498cE9aC0aB956276` |
| UniswapV2Factory | `0xd498f5beBD0C9f1FE0135a0Cf942dA67Ee6e8A9B` |
| UniswapV2Router02 | `0x430c23895c8D44883526e3E0B09327dAD8766660` |
| OpenRegistrationGate | `0xd1a37dF00238b97F453fC583806711048eB9987c` |
| TokenRegistry | `0x82289127fda2d521c851C696796c41EDB6b6461D` |

- Admin: `0xb0E956d64cd412Edb242839793C7910e5E15a298` (puddleswap keystore)
- All contracts verified on MonadVision, Socialscan, Monadscan
- Core tokens registered (USDC, USDT, WMON as TOP_VERIFIED)
- Pools seeded (USDC/USDT, USDC/WMON, USDT/WMON)
- Rebalancer granted MINTER_ROLE on both stablecoins

## 6. Deployment — DONE

- Vercel: auto-deployed from git push, live at https://app.puddleswap.org
- Railway: rebalancer redeployed with new contract addresses
