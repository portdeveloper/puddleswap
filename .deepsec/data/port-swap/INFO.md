# port-swap

## What this codebase does

PuddleSwap is a static Vite + React + TypeScript DEX UI for Monad testnet,
backed by Foundry Solidity contracts and shell/Forge deployment scripts.
The frontend has no app backend or server sessions: wallet actions go directly
through wagmi/viem RPC calls to deployed Uniswap V2, token registry, faucet,
and WMON contracts.
A Railway rebalancer script periodically trades the USDC/WMON and USDT/WMON
pools toward a target testnet price.

## Auth shape

- No web auth middleware, sessions, cookies, or API routes; user identity is
  only the connected wallet address from wagmi.
- Frontend write gating uses `useChainGuard`, `isCorrectChain`, `monadTestnet`,
  and `CHAIN_ID`; writes should target Monad testnet only.
- Contract admin authorization uses OpenZeppelin `AccessControl`, especially
  `DEFAULT_ADMIN_ROLE`, `VERIFIER_ROLE`, `OPERATOR_ROLE`, and `REGISTRY_ROLE`.
- Token registration authorization is split between `TokenRegistry.registerBasic`,
  `TokenRegistry.registerVerified`, and `OpenRegistrationGate.authorizeAndConsume`.
- Rebalancer/deploy scripts authenticate via Foundry keystore or `PRIVATE_KEY`
  env; those secrets should remain outside source and frontend bundles.

## Threat model

Highest impact is anything that lets a hostile wallet drain or misroute user
swaps/liquidity, bypass slippage/deadline protection, or trick the UI into
signing on the wrong chain or wrong contract address.
Next is registry abuse: promoting scam tokens, bypassing BASIC limits, setting
misleading images/core status, or weakening verifier/admin role checks.
Operator/admin key compromise is also important because the rebalancer can
spend operator balances and privileged contracts can mint/configure test tokens.
The app is explicitly testnet-only, but bad behavior can still waste user funds,
testnet USDC, or pollute the public registry.

## Project-specific patterns to flag

- `writeContractAsync` or Forge broadcast paths that skip
  `isCorrectChain`/`monadTestnet` gating, use unchecked route/user token
  addresses, or omit `isAddress` validation before contract calls.
- Router swaps or liquidity calls that pass `0` minimum outputs, omit the
  20-minute deadline convention, ignore the 50% slippage cap, or compute min
  amounts from untrusted/display-only values.
- Registry changes that let BASIC registrations set `imageURI`, `isCore`,
  CHECKMARK/TOP_VERIFIED status, bypass `registrationGate.authorizeAndConsume`,
  or loosen symbol/name restrictions.
- AccessControl changes that grant `VERIFIER_ROLE`, `OPERATOR_ROLE`,
  `REGISTRY_ROLE`, or `MINTER_ROLE` too broadly, fail to bind registry/gate
  roles, or allow arbitrary `adminMint` tokens.
- Rebalancer changes that remove `MAX_INPUT_FRACTION_BPS`, skip operator
  balance checks, approve non-router spenders, log secrets, or move
  `PRIVATE_KEY`/webhook material into tracked files.

## Known false-positives

- Public frontend routes such as `/`, `/pools`, `/pool/:pairAddress`, `/tokens`,
  `/tokens/:slug`, and `/learn/*` are intentionally unauthenticated.
- `VITE_RPC_URL`, `VITE_EXPLORER_BASE_URL`, WalletConnect-style frontend env,
  deployed addresses, and explorer URLs are public client configuration.
- `TokenRegistry.search`, `listCoreTokens`, faucet `claim`, and BASIC
  `registerBasic` are intentionally public with testnet/rate-limit/trust-tier
  mitigations.
- `contracts/out`, `contracts/cache`, and `contracts/broadcast` are Foundry
  generated artifacts or deployment logs; source lives under `contracts/src`
  and `contracts/script`.
- `RouterCompileStub`, `FactoryCompileStub`, stock Uniswap V2 artifacts,
  `.deepsec/data`, and SEO/static content files are usually scan context noise
  rather than app-specific auth surfaces.
