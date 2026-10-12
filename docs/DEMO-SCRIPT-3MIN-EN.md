# Designer Hub · Monad — 3-Minute Web Demo Script (English)

> Purpose: a 3-minute live/screen-recorded demo. Spoken script + click path.
> Primary flow: **full Passkey journey** (no wallet, no MON, relayer pays gas).
> Site: `/demo` gallery → `/passkey` → `/mint/create` → `/scheme/[id]` → `/remix/[id]` → `/trades` · `/board`.
> Timings are designed for 180 seconds. Bracketed text = camera / on-screen action; quoted text = spoken lines.

---

## 0. One-line positioning (for the intro)

"Designer Hub turns an exported interior-design scheme into an on-chain creative asset on Monad — an asset you can sign, remix, and get paid from. Simply put: a GitHub for home design."

---

## 1. Pre-flight checklist (tick these off 5 minutes before recording)

- [ ] Open the app at **`http://localhost`** (never `127.0.0.1` — WebAuthn/Passkey throws `invalid domain`).
- [ ] Device has fingerprint / Face ID / Windows Hello enrolled; create a passkey once on `/passkey` beforehand and confirm the address derives.
- [ ] `web/.env.local` has all 5 contract addresses; restart the dev server after configuring.
- [ ] Relayer is live (`RELAYER_PRIVATE_KEY` set); clicking "Apply to my home" produces a real on-chain tx.
- [ ] Gallery is seeded (`npm run seed` — 3 samples: Nordic living room / Japanese bedroom / Industrial study) with at least one remix and one applied, so `/board` isn't empty.
- [ ] Two tabs pre-opened: A = `/demo`, B = `/scheme/1` (fewer page-load waits).
- [ ] Pop-up notifications silenced; browser zoom at 100–110% for legible card text.
- [ ] A scheme JSON ready to paste (grab one from `assets/schemes/`).

---

## 2. Shot-by-shot script

### 0:00 – 0:18 ｜ Opening (18s)
**On screen**: `/demo` gallery, full card grid.
**Spoken**:
> "This is Designer Hub. In the 云筑家 app, a user scans a room with their phone, generates a 3D design, and exports it. Here, that same scheme JSON is minted into an on-chain asset — one you can remix, trace, and get paid from. It maps to the Monad hackathon's **Track 04: Trust, Identity & AI Infrastructure**."

### 0:18 – 0:42 ｜ Gallery: real on-chain data (24s)
**Action**: sweep the cursor across 2–3 cards; point out the floor-plan preview, creator, `parentId` lineage depth, price, and heat.
**Spoken**:
> "Every card here is real on-chain data, not a static mock. You can see a floor-plan preview, the creator, lineage depth, and price. When a scheme gets remixed or applied, its heat updates in real time — **heat = remixes ×2 + times-applied ×3**. Attention itself becomes a measurable asset."

### 0:42 – 1:05 ｜ Passkey: no wallet, no gas (23s)
**Action**: go to `/passkey` → click "Create Passkey" → system fingerprint / Face ID prompt → the derived `CREATE2` account address appears → click "Sign on-chain".
**Spoken**:
> "The main flow needs no wallet and no MON. Hit 'Create Passkey' — the private key is generated in your device's secure element and never leaves it. The address is derived deterministically via `CREATE2(publicKey, domain)`, so it's known before deployment. Now the key moment: one fingerprint tap authorizes the on-chain call, and gas is sponsored by our relayer. The signature binds the exact calldata, so the relayer can pay for you but **cannot alter a single operation**."

### 1:05 – 1:30 ｜ Create and mint an original (25s)
**Action**: `/mint/create` → drag in / paste the scheme JSON → preview renders on the right → click "Pin to IPFS" → click "Mint" → success with tokenId.
**Spoken**:
> "Now let's turn a design into an asset. Drop in the scheme JSON, and the floor-plan preview renders instantly — generated entirely from the scheme data. The content is pinned to IPFS; only a content-commitment hash goes on-chain, so **the content itself never touches the chain** — that's privacy-first provenance. Then we mint: this is an ERC-721, `parentId = 0` means original, and it also records the AI agent that produced it. Kimi is pre-registered as agent #1, so both the scheme and the model are publicly attributable."

### 1:30 – 1:58 ｜ Scheme detail + apply to my home (28s)
**Action**: `/scheme/1` → point at the lineage tree and version timeline → (optional) glance at the comment box → back to top, click "Apply to my home" → the split amounts and on-chain event appear.
**Spoken**:
> "Here's the scheme detail page: the on-chain lineage tree on top, and below it the same author's version timeline — v1, v2, v3. Attribution lives on-chain, not in any platform's database. The key button is 'Apply to my home'. The buyer pays, and **in the very same transaction the money is already split**: 90% to the creator, 10% to the platform for an original — **no platform vault, no withdraw step**. Nobody can freeze it. You can also leave a comment at the bottom — wallet-signature verified, zero gas."

### 1:58 – 2:28 ｜ Remix: lineage payout + leaderboard (30s)
**Action**: back on the detail page, click "Remix" → `/remix/[id]` → tweak style / palette / furniture params → preview updates → click "Mint derivative" → then go to `/board` and watch the rank jump.
**Spoken**:
> "Now secondary creation. Hit 'Remix' and you land in the style-parameter editor — I can change palette, materials, and furniture, with a live preview on the right. When I mint the derivative, `parentId` automatically points to the source scheme, and the lineage is written permanently on-chain. The split changes too: for a remix it's 85% to me, 10% to the platform, and **5% flows back along the lineage to the original creator** — so originals keep earning when they're reused. Back on the leaderboard, heat is recomputed in real time from remixes and applies, and my rank has already jumped up."

### 2:28 – 2:45 ｜ Trade ledger (17s)
**Action**: `/trades` split ledger → point at a row: Token / buyer / creator cut / platform cut / ancestor pool / block / tx.
**Spoken**:
> "Every payout settles here — who bought, the creator's cut, the platform's cut, the ancestor pool, down to the block and transaction hash. All the revenue logic is independently auditable on-chain."

### 2:45 – 3:00 ｜ Close: this is a developer primitive (15s)
**Spoken**:
> "One last point: this isn't just an app. Identity, provenance, remixable assets, and AI-agent trust — all four primitives are packaged as a typed SDK with integration docs, so any third-party design tool, asset library, or AI-agent platform can build on it **without our UI**. Thank you."

---

## 3. Fallback lines (if something breaks on stage)

| Situation | Response |
| --- | --- |
| Passkey prompt doesn't appear | "This relies on the device secure element; it was verified in this recording environment." → jump to the pre-captured derived-address screenshot and keep going. |
| Transaction takes a while | "Monad produces blocks fast — usually one to two seconds." → keep talking about the mechanism, then check the tx in `/trades`. |
| Gallery is empty | Environment has no addresses / wasn't restarted: switch to `/docs`, walk through mechanics, and note "the gallery enumerates via totalSupply." |
| Kimi returns nothing | "Without an API key it falls back to the built-in rule engine — functionally equivalent." No need to elaborate. |
| Network restricted | Use the local `local://` demo mode + `/api/cid`; the whole flow still runs. |

---

## 4. Optional 30-second pitch (ultra-short)

> "Designer Hub is a GitHub for home design. Each interior-design scheme becomes an ERC-721 with on-chain lineage. Users sign in with a Passkey — the key stays in the device's secure element, and a relayer pays gas without being able to tamper with the call. Apply a scheme to your home for an **instant 90/10 split** — no platform vault. Remix it and **5% flows back along the lineage** to the original creator. Four primitives — identity, provenance, remixable assets, agent trust — shipped as a typed SDK any developer can build on. Track 04: Trust, Identity & AI Infrastructure."

---

## 5. Key facts cheat-sheet (for Q&A)

- Network: Monad Testnet, chainId **10143**; explorer `testnet.monadexplorer.com`.
- Contracts: `DreamScheme` / `SchemeMarket` / `AgentRegistry` / `ProvenanceRegistry` / `PasskeyAccountFactory` (addresses in `contracts/deployments/monad-testnet.json`).
- Splits: original **90/10**; remix **85/10/5** (creator / platform / ancestor lineage pool); resale royalty ERC-2981 **5%**.
- Heat: **remixes ×2 + times-applied ×3**.
- Tests: Foundry **96 cases, all passing**; no private keys anywhere in the repo.
