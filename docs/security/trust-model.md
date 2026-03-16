# Trust Model

This document describes the trust assumptions, privileged roles, and threat boundaries for Puddle on Monad testnet.

## Privileged Roles

### Deployer (DEFAULT_ADMIN_ROLE)

The deployer's keystore account serves as the admin for all contracts. It controls:

- **TokenRegistry**: grant/revoke VERIFIER_ROLE, swap registration gates
- **OpenRegistrationGate**: set cooldown and max active registrations
- **StableFaucet**: enable/disable faucet, set cooldown and claim amounts, grant OPERATOR_ROLE
- **TestUSDT**: grant/revoke MINTER_ROLE (USDC is Circle's real token — not admin-controlled)
**Trust assumption:** The deployer keystore is uncompromised and the operator acts in good faith.

### VERIFIER_ROLE (TokenRegistry)

Can register verified tokens, set token levels, toggle core status, set image URIs, and deactivate tokens. Cannot modify admin settings or change the registration gate.

**Trust assumption:** Verifiers act in good faith. A malicious verifier could promote scam tokens to CHECKMARK/TOP_VERIFIED status or deactivate legitimate tokens. Damage is limited to registry data and can be reversed by admin.

### MINTER_ROLE (TestUSDT only)

Can mint unlimited test USDT. Currently granted to:

- Deployer admin
- StableFaucet contract (for user claims)

USDC is Circle's real testnet token — no minting capability. The rebalancer operator must be pre-funded with USDC.

**Trust assumption:** All MINTER_ROLE holders are trusted. A compromised minter can mint unlimited USDT, swap through pools, and drain pool liquidity.

### Rebalancer Operator

An externally-owned account that runs the automated rebalancing loop. Holds:

- Native MON for gas
- WMON, USDC, USDT balances for swap operations

USDC is a real token — the operator must be pre-funded and cannot mint more.

**Trust assumption:** The rebalancer private key is uncompromised. If compromised, an attacker can:

1. Drain the operator's USDC/USDT/WMON balances via swaps
2. Spend the operator's MON balance on gas

**Mitigations:**

- Testnet only — no real value at risk
- Low MON balance alerts via Discord webhook
- Rebalancer trades are capped to 50% of pool reserves per cycle (`MAX_INPUT_FRACTION_BPS = 5000`)
- Key is stored as a Railway environment variable (not in code or git)

### OPERATOR_ROLE (StableFaucet)

Can call `adminMint` to mint USDC/USDT to arbitrary addresses. Restricted to the two supported tokens only.

## Public (Untrusted) Functions

### Token Registration (registerBasic)

Any user can register a token via `registerBasic`. Protections:

- Registration gate enforces cooldown between registrations
- Maximum active registrations per address
- Symbol restricted to alphanumeric, hyphen, underscore (max 15 chars)
- Name restricted to max 64 chars
- BASIC tokens cannot set image URIs
- BASIC tokens appear lowest in search results
- Verifiers can deactivate fraudulent registrations

**Known limitation:** `registerBasic` does not verify on-chain metadata. A user can register token `0xABC` with symbol "USDC" even if the contract's actual symbol differs. This is by design — on-chain symbol verification would fail for non-standard tokens and increase gas costs. The BASIC tier label and search ranking mitigate confusion.

### Faucet Claims

Any user can claim test tokens. Protected by per-address cooldown and admin-configurable amounts. The faucet can be disabled entirely by admin.

### Swap / Liquidity Operations

All swap and liquidity operations go through the stock Uniswap V2 Router. No custom wrapper contracts are involved. The frontend enforces:

- Slippage protection on swaps (user-configurable, default 1%, capped at 50%)
- Slippage protection on add liquidity (2% tolerance)
- Slippage protection on remove liquidity (2% tolerance based on proportional reserves)
- 20-minute transaction deadline

## Key Management

| Key | Storage | Access |
|-----|---------|--------|
| Deployer keystore | Local `~/.foundry/keystores/` | Developer machine only |
| Keystore password | Local `~/.monad-keystore-password` | Developer machine only |
| Rebalancer private key | Railway environment variable | Automated rebalancer process |
| WalletConnect project ID | Vite env var (`VITE_*`) | Bundled in frontend (public) |
| Discord webhook URL | Railway environment variable | Rebalancer alerts |

## Contract Upgrade Path

No contracts are upgradeable. All contracts are deployed as immutable bytecode. Changes require deploying new contracts and migrating via the admin account (e.g., updating the registration gate on TokenRegistry).

## Network Assumptions

- All contracts are deployed on Monad testnet (chain ID 10143)
- Testnet tokens have no real economic value
- RPC endpoint (`testnet-rpc.monad.xyz`) is a public endpoint with no SLA
- The Uniswap V2 factory and router are stock deployments with no modifications
