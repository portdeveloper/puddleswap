# Backlink outreach — PuddleSwap

A checklist for getting indexed + ranked for "monad testnet swap" and adjacent queries.
Backlinks from trusted Monad-ecosystem sites matter more than any code change. Start with the
highest-leverage targets and work down.

## Canonical one-liner (use everywhere)

> **PuddleSwap** — a static, no-backend DEX on Monad Testnet. Swap any ERC-20 via USDC,
> USDT, or WMON star routing; create pools in one flow; no signup, no KYC.
> <https://app.puddleswap.org>

Shorter variant (character-limited fields, Twitter bio, etc.):

> Swap tokens on Monad Testnet · PuddleSwap — app.puddleswap.org

## Priority targets

### 1. Monad ecosystem directory (highest authority)
- Monad's official ecosystem/dApps page (check <https://monad.xyz/ecosystem> or equivalent).
  Submission is usually via a form linked from that page, Discord, or by DM'ing the DevRel team.
- **Discord** — in the Monad server, post in `#builders` or the current ecosystem-submissions channel
  with the canonical one-liner. A single link from `monad.xyz` is worth a hundred from random lists.

### 2. Monad community resources repo (PR)
- <https://github.com/monad-developers/community-resources> accepts community contributions.
  Fit: add under "Ecosystem Participant Resources" or a new "Testnet Tooling" section.
- Open a PR with the one-liner above plus a one-paragraph intro. Reference this file in the PR
  description if useful.

### 3. DefiLlama / onchain trackers
- DefiLlama Monad page: <https://defillama.com/chain/Monad>. Once testnet DEXes start appearing,
  submit PuddleSwap via their listing form (<https://docs.llama.fi/list-your-project/submit-a-project>).
- Dune dashboards that track Monad testnet DEX activity — reach out to the dashboard author on X.

### 4. Awesome-lists + dev tool directories
- `awesome-monad` repos — none canonical today; `Kali-Decoder/awesome-monad-hackathon-templates`
  is the closest. Low-authority but still a real link.
- Generic Web3 lists: <https://github.com/ahmet/awesome-web3>, <https://github.com/piotr-roslaniec/awesome-web3>
  — submit under DEXes or testnet tools.

### 5. X (Twitter) + Discord
- Pin a tweet from `@port_dev` introducing PuddleSwap, linking `https://app.puddleswap.org`. X links
  are nofollow but surface impressions that eventually convert to organic backlinks.
- Drop the link in any Monad-adjacent Discord channel that allows project mentions (read pinned rules first).

### 6. Monad blog posts + guides
- Find Monad Testnet tutorials on Mirror, Medium, HackerNoon, or dev blogs. Leave a helpful reply
  with the PuddleSwap link where it genuinely adds value ("if you need USDC/USDT test tokens, PuddleSwap routes
  through both"). Never comment-spam — one good contextual reply per post is plenty.

## Search Console monitoring

After 3–5 days (longer for fresh sites):

1. **GSC → Performance → Queries** — see which queries already generate impressions.
   Often these are not the queries you targeted — that data reshapes copy decisions.
2. **GSC → Pages** — confirm `/`, `/pools`, `/pool/new` are indexed. If any show
   "Discovered — currently not indexed", request indexing manually.
3. **GSC → Enhancements → Structured data** — confirm the WebApplication JSON-LD is
   recognized. Runs <https://search.google.com/test/rich-results> on
   `https://app.puddleswap.org/` for a live check.

## What to skip

- Paid link lists and SEO directories. Google discounts or penalizes most of them.
- Mass submission to 100 generic crypto directories — low-quality links can be actively harmful for
  a fresh site's reputation.
- Exact-match anchor text on every backlink ("monad testnet swap" repeated verbatim). Vary it:
  "PuddleSwap", "app.puddleswap.org", "PuddleSwap DEX on Monad Testnet".

## Ranking timeline

- **Week 1–2:** indexed, appearing on long-tail / low-competition queries ("puddleswap",
  "puddleswap monad").
- **Week 3–6:** ranking on "monad testnet dex" type phrases if 2–3 quality backlinks landed.
- **Month 2+:** ranking on "monad testnet swap" depends on how competitive the SERP gets as
  mainnet launches. First-mover brand recall matters.
