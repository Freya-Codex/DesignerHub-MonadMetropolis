# Designer Hub · Monad — 3-Minute Web Demo Script (v2 · aligned to the latest site)

> Purpose: a 3-minute live / screen-recorded demo. Spoken lines + click path.
> Primary flow: **the full Passkey journey** (no wallet, no MON, relayer pays gas).
> Path: `/` (brand home) → `/demo` (gallery) → `/passkey` → `/mint/create` → `/scheme/[id]` → `/remix/[id]` → `/trades` · `/board`.
> Timings are designed for **180 seconds**. Bracketed text = camera / on-screen action; quoted text = spoken lines.
> Track: Monad Metropolis hackathon **Track 04 — Trust, Identity & AI Infrastructure**.

---

## 0. One-line positioning (for the intro)

> "Designer Hub turns an exported interior-design scheme (from the VirtuHome app) into an on-chain creative asset on Monad — one you can sign, remix, and get paid from. Simply put: a **'GitHub' for interior design**."

---

## 1. Track 04 technical highlights (the "bones" — expand on demand in Q&A)

Judges want to know which **reusable primitives** you brought to Track 04. Four primitives, plus two engineering details:

1. **Identity — Passkey smart account**
   - Mnemonic-free: address = `CREATE2(x, y, rpIdHash, originHash)`, known before deployment.
   - The private key is generated in the **device's secure element** and never leaves it; you sign with Face ID / fingerprint.
   - A **real WebAuthn assertion is verified on-chain** (P-256). A pure-Solidity P-256 verifier probes the `RIP-7212` precompile and falls back to Jacobian curve math — so it works on chains **without** that precompile, **including Monad**.
   - The signature **binds the calldata and nonce**: a relayer can pay gas but **cannot alter a single call**.
2. **Trust — no vault, no withdraw**
   - **No platform vault, no `withdraw()`**: payment is split **instantly inside the buyer's transaction**; nobody can freeze funds.
   - The relayer is **permissionless and replaceable**: anyone can call `execute(...)` — **authorization comes from the signature, not the sender**.
3. **Data ownership — content commitment**
   - `ProvenanceRegistry` stores only `keccak256(contentHash ‖ salt)` on-chain; **the content itself never touches the chain**, yet provenance and a timestamp are provable.
4. **AI infrastructure — generator registry & attribution**
   - `AgentRegistry` registers AI generators and reputation; `mint` / `remix` write the generating `agentId` on-chain — so **both the scheme and the model that generated it are publicly attributable**. Kimi is pre-registered as `agentId = 1`.
5. **Composable assets — lineage + royalty**
   - `DreamScheme`: ERC-721 + ERC-2981 + `parentId` lineage (v1→v2→v3).
   - `SchemeMarket`: creator `setPrice`; applying pays out **instantly along the lineage** — **90/10** original, **85/10/5** remix.
6. **DX — typed SDK**
   - `@designerhub/sdk` packages all of the above as **typed calls**, so a third party integrates **without our UI**.

> One line to tie it together: Track 04 comes down to three questions — **who you are (Passkey), whether the thing is really yours (commitment + lineage), and whether AI's work counts (AgentRegistry)** — and we ship each as an on-chain, composable primitive.

---

## 2. Fee wording (say this whenever you talk about "the split", so it never clashes with "no vault")

- **Platform / lineage fee (charged per apply)**: the platform's cut — **10%** of the apply price for an original (the 90/10 split), or **10% platform plus 5% to the ancestor pool** for a remix (the 85/10/5 split). Settled in the same transaction; **no standing platform fee, no subscription.**
- **Resale royalty (ERC-2981)**: **5%** by default, configurable by the creator between **5% and 10%**; paid automatically on any **secondary resale**, **on top of** the apply split.
- So "no vault / no withdraw" means **no custody of funds** — it does *not* mean "no fees."

---

## 3. Pre-flight checklist (tick these off 5 minutes before recording)

- [ ] Open the app at **`http://localhost`** (never `127.0.0.1` — WebAuthn/Passkey throws `invalid domain`).
- [ ] Device has fingerprint / Face ID / Windows Hello enrolled; create a passkey once on `/passkey` beforehand and confirm the address derives.
- [ ] `web/.env.local` has all 5 contract addresses; restart the dev server after configuring.
- [ ] Relayer is live (`RELAYER_PRIVATE_KEY` set); clicking "Apply to my home" produces a real on-chain tx.
- [ ] Gallery is seeded (`npm run seed` — Nordic living room / Japanese bedroom / Industrial study) with at least one remix and one applied, so `/board` isn't empty.
- [ ] Site is set to **English** (header `EN`), and gallery/detail titles render in English (local demo pins carry the `*En` fields).
- [ ] Two tabs pre-opened: A = `/demo` gallery, B = `/scheme/3` detail (one fewer page-load wait).
- [ ] Pop-up notifications silenced; browser zoom at 100–110%.
- [ ] A scheme JSON or a **base64url scheme code** ready to paste (grab one from `assets/schemes/`).
- [ ] Optional: before demoing the SDK live — `cd sdk && npm i viem && npx tsc -p tsconfig.json && npx tsx examples/read-schemes.ts`.

---

## 4. Shot-by-shot script (0:00 – 3:00)

### 0:00 – 0:16 | Opening (16s)
**On screen**: `/` brand home (hero).
**Spoken**:
> "This is Designer Hub — a **'GitHub' for interior design**. In the VirtuHome app, a user scans a room with their phone and generates a 3D design. Here, that same scheme is minted into an on-chain asset you can remix, trace, and get paid from. It maps to the Monad hackathon's **Track 04: Trust, Identity & AI Infrastructure**."

### 0:16 – 0:40 | Gallery: real on-chain data (24s)
**Action**: switch to `/demo`; sweep the cursor across 2–3 cards and point out the AI render / floor-plan preview, creator, `parentId` lineage depth, price, and heat.
**Spoken**:
> "Every card here is real on-chain data, not a static mock. Watch the heat number — **heat = remixes × 2 + applies × 3**. Attention itself becomes a measurable, tradable asset."

### 0:40 – 1:04 | Passkey: no wallet, no gas (24s)
**Action**: go to `/passkey` → click "Create Passkey" → system fingerprint / Face ID prompt → the derived `CREATE2` address appears → click "Sign on-chain".
**Spoken**:
> "The main flow needs no wallet and no MON. Hit 'Create Passkey' — the private key is generated in your **device's secure element** and never leaves it. The address is derived deterministically via `CREATE2(publicKey, domain)`, so it's known before deployment. Now the key moment: one fingerprint tap authorizes the on-chain call, and gas is sponsored by our **relayer**. On-chain, the signature **binds the exact calldata**, so the relayer can pay for you but **cannot alter a single operation**."

### 1:04 – 1:30 | Create and mint an original (26s)
**Action**: `/mint/create` → paste the scheme JSON (or a base64url scheme code) → the floor-plan preview renders on the right → click "Pin to IPFS" → click "Mint" → success with a tokenId.
**Spoken**:
> "Now let's turn a design into an asset. Paste the scheme JSON — a compact **base64url scheme code** works too — and the floor-plan preview renders instantly, generated entirely from the scheme data. The content is pinned to IPFS; only a **content-commitment hash** goes on-chain, so **the content itself never touches the chain** — that's privacy-first provenance. Then we mint: this is an ERC-721, `parentId = 0` means original, and it records the AI agent that generated it — Kimi is **agent #1**, so both the scheme and the model are publicly attributable."

### 1:30 – 1:58 | Scheme detail + apply to my home (28s)
**Action**: `/scheme/3` → point at the lineage tree and version timeline → click "Apply to my home" → the split amounts and on-chain event appear.
**Spoken**:
> "The detail page shows the on-chain lineage tree up top and the same author's version timeline below — v1, v2, v3. **Attribution lives on-chain, not in any platform's database.** The key button is 'Apply to my home': the buyer pays, and **in the very same transaction the money is already split** — 90% to the creator, 10% to the platform for an original, **no platform vault, no withdraw step**. Nobody can freeze it. And the fee picture is explicit: a 10% platform cut on apply; if it's later resold, an **ERC-2981 royalty of 5%** (creator-configurable 5–10%) settles separately — the two never overlap."

### 1:58 – 2:28 | Remix: lineage payout + leaderboard (30s)
**Action**: back on the detail page, click "Remix" → `/remix/[id]` → tweak style / palette / furniture params → preview updates → click "Mint derivative" → go to `/board` and watch the rank jump.
**Spoken**:
> "Now secondary creation. Hit 'Remix' and you land in the style-parameter editor — palette, materials, furniture, all with a live preview. When I mint the derivative, `parentId` automatically points to the source scheme, and the **lineage is written permanently on-chain**. The split changes too: a remix is **85% to me, 10% to the platform, and 5% flows back along the lineage to the original creator** — so originals keep earning when they're reused. Back on the leaderboard, heat is recomputed in real time from remixes and applies, and my rank has already jumped."

### 2:28 – 2:45 | Trade ledger (17s)
**Action**: `/trades` split ledger → point at a row: Token / buyer / creator cut / platform cut / ancestor pool / block / tx.
**Spoken**:
> "Every payout settles here — who bought, the creator's cut, the platform's cut, the **ancestor pool**, down to the block and transaction hash. All the revenue logic is **independently auditable on-chain**."

### 2:45 – 3:00 | Close: this is a developer primitive (15s)
**Spoken**:
> "One last point: this isn't just an app. Identity, provenance, remixable assets, and AI-agent trust — all four primitives are packaged as a **typed SDK, `@designerhub/sdk`**, plus integration docs, so any third-party design tool, asset library, or AI-agent platform can build on it **without our UI**. Thank you."

---

## 5. Fallback lines (if something breaks on stage)

| Situation | Response |
| --- | --- |
| Passkey prompt doesn't appear | "This relies on the device secure element; it was verified in this recording environment." → jump to the pre-captured derived-address screenshot and keep going. |
| Transaction takes a while | "Monad produces blocks fast — usually one to two seconds." → keep talking about the mechanism, then check the tx in `/trades`. |
| Gallery is empty | Environment has no addresses / wasn't restarted: switch to `/docs`, walk through the mechanics, and note "the gallery enumerates via `totalSupply`." |
| Kimi returns nothing | "Without an API key it falls back to the built-in rule engine — functionally equivalent." No need to elaborate. |
| Network restricted | Use the local `local://` demo mode + `/api/cid`; the whole flow still runs. |
| SDK hits an RPC error live | Monad's public RPC caps at **15 req/s**: the SDK's reads are sequentially paced (`paceMs`); just retry in a moment. |

---

## 6. Optional 30-second pitch (ultra-short)

> "Designer Hub is a **'GitHub' for interior design**. Every scheme becomes an ERC-721 with on-chain lineage — remix it, trace it, get paid from it. Sign in with a **Passkey**: the key stays in your device's secure element, the address is `CREATE2`-derived, and a **relayer pays gas without being able to alter your call** because the signature binds the calldata and nonce. Apply a scheme for an **instant 90/10 split** — no platform vault, no withdraw. Remix it and **5% flows back along the lineage** to the original creator. Content never goes on-chain — only a `keccak256` commitment. AI generators are registered on-chain (**Kimi = `agentId` 1**), so both the scheme and the model are attributable. Four primitives — identity, provenance, data ownership, and agent trust — shipped as a typed SDK (`@designerhub/sdk`) any developer can build on. **Track 04: Trust, Identity & AI Infrastructure.**"

---

## 7. Key facts cheat-sheet (for Q&A)

- Network: Monad Testnet, chainId **10143**; explorer `testnet.monadexplorer.com`.
- Contracts (5): `DreamScheme` / `SchemeMarket` / `AgentRegistry` / `ProvenanceRegistry` / `PasskeyAccountFactory` (addresses in `contracts/deployments/monad-testnet.json`; all public on-chain info, safe to show).
- Splits: original **90/10**; remix **85/10/5** (creator / platform / ancestor lineage pool); resale royalty ERC-2981 **5%** (configurable 5–10%).
- Heat: **remixes × 2 + applies × 3**.
- Identity: address = `CREATE2(x, y, rpIdHash, originHash)`; key never leaves the secure element; a WebAuthn assertion is verified on-chain (P-256, with a RIP-7212 fallback).
- Provenance: only `keccak256(contentHash ‖ salt)` on-chain; content never goes on-chain.
- AI attribution: Kimi pre-registered as `agentId = 1`.
- SDK: `@designerhub/sdk` (typed; verified to build and run `examples/read-schemes.ts`).
- Tests: Foundry **103 cases, all passing**; no private keys anywhere in the repo.
- Roadmap: partnership talks with an **operating interior-design firm** (helping their designers ship AI-generated schemes and anchor authorship on-chain); post-event marketing on **Xiaohongshu (RED)** for reach; ongoing refinement from user feedback plus more showcase features; support sought — **compute / token credits** and an official **Kimi** collaboration.
