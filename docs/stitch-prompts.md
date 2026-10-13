# Designer Hub · Monad — Google Stitch Web-Design Prompt Pack

> Purpose: re-plan / re-draw the `monad` project's web UI in [Google Stitch](https://stitch.withgoogle.com).
> How to use: run **① Design-system master prompt** first (sets the tone), then run the **② per-screen prompts** one at a time
> (Stitch produces the best result one screen at a time).
> Project facts: a Monad Testnet DApp (chainId 10143), track **Track 04 — Trust, Identity & AI Infrastructure**,
> bilingual (English + Chinese), wallet-free Passkey as the primary flow.

---

## 0. One-line product positioning (reuse throughout the prompts)

**English**: Turn AI-generated interior-design schemes into on-chain creative assets that are remixable, attributable and revenue-sharing — **the GitHub for Interior Design**.

> The shipped site is bilingual: English is the primary copy with small subtitles on request; the design system should support an EN/ZH toggle.

---

## ① Design-system master prompt (run this first)

```
Design a modern web3 + design-tool hybrid product website called "Designer Hub" — a marketplace where AI-generated interior design schemes become on-chain ERC-721 creative assets that people can remix, cite, and revenue-share. Tagline: "The GitHub for Interior Design".

BRAND & TONE
- Audience: web3 builders, AI creators, and interior-design hobbyists. Confident, technical-but-clean, quietly premium. Not neon, not playful-crypto.
- The signature idea is ARCHITECTURAL BLUEPRINT: thin dimension lines, small tick marks and tiny monospace annotations (like measurement lines on a floor plan) used as section dividers and accents.

COLOR SYSTEM
- Dark "ink" sections: near-black #0F0F12, with a very subtle faint grid/blueprint background and soft violet glow blobs.
- Light "paper" sections: warm off-white #FBFAF9.
- Primary accent: electric violet #6E54FF (deep #4F47EB), used for CTAs, links, active states.
- Secondary: plum #25043A (deep dark panels), soft coral #FFA1A1 (highlight only).
- Text on light: ink #0F0F12 with muted gray #727285 for body; on dark: white with 60–70% white for body.
- Hairline borders #ECECEC, rounded cards (12–16px radius), soft long shadows.

TYPOGRAPHY
- Display headings: a geometric grotesque like Archivo, tight tracking, large sizes (hero 56–64px desktop / 34–36px mobile).
- Body: clean system sans (Inter).
- Technical labels, numbers, chain IDs, addresses, contract names: MONOSPACE, UPPERCASE, wide letter-spacing (e.g. "CHAIN 10143 · MONAD TESTNET").
- Small "eyebrow" labels above headings: uppercase mono, e.g. "FEATURED · CURATED SCHEMES".

LAYOUT & COMPONENTS
- Max content width ~1152px, generous whitespace, strong vertical rhythm.
- Sticky top bar: brand mark (a white hexagonal line "house/blueprint" glyph on a violet rounded square) + wordmark "Designer Hub" + tiny mono subtitle "On-chain. Remixable. Attributable · MONAD"; nav: HOME / GALLERY / MINT / TRADES / BOARD / DOCS; far right a single "Passkey" pill control (shows "Create passkey" when not set, or "Passkey · 0x1a2b…" with a green status dot when ready) and a small "EN / ZH" language toggle.
- Cards ("sheets"): white surface, 1px hairline border, soft shadow, hover lifts border to violet.
- Buttons: filled violet primary (white text), outline-light on dark, ghost/text links. Rounded ~10px.
- Footer: hairline top border, mono meta line "CHAIN 10143 · MONAD TESTNET · ERC-721 + ERC-2981 · IPFS" plus links RPC / Faucet / Explorer / Docs.

Deliver a coherent design system (color, type scale, spacing, components) that works for BOTH desktop web and mobile, with light and dark sections mixed on the same page.
```

---

## ② Per-screen prompts (generate one screen at a time)

### 2.1 Home `/`

```
Design the HOME page for "Designer Hub" (the on-chain GitHub for Interior Design) on Monad Testnet.

SECTION 1 — HERO (dark, near-black with subtle blueprint grid + violet glow blobs)
- Eyebrow (mono, uppercase, muted): "MONAD TESTNET · CHAIN 10143 · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE"
- H1 (huge, white): "The GitHub for Interior Design" with "GitHub" highlighted in electric violet.
- Subtext (white 70%): "Turn interior-design schemes into on-chain creative assets that are remixable, attributable and revenue-sharing. AI generates a scheme; publish it here on-chain and anyone can keep building on your design — parentId records the full lineage, and revenue auto-splits at the creator's price."
- A blueprint signature line: a horizontal thin dimension line with tick marks at both ends, center captioned in tiny mono: "ERC-721 · ERC-2981 · IPFS".
- Buttons: filled violet "Enter Gallery" + outline-light "Create My Scheme" + ghost link "Get Testnet MON ↗".
- A 4-column stats strip separated by a top hairline: SCHEMES / REMIX / APPLIED / FURNITURE with big display numbers (e.g. 3 / 8 / 12 / 47).

SECTION 2 — CAPABILITIES (light paper)
- Eyebrow "CAPABILITIES", H2 "A composable on-chain creative protocol".
- Three cards, each with a mono number 01/02/03, a title and 2-line body:
  01 "Scheme as an Asset" — every scheme is minted as ERC-721, metadata + layout on IPFS, AI credit recorded on-chain.
  02 "Lineage & Attribution" — parentId records every remix; original creators keep ERC-2981 royalties.
  03 "Creator Pricing · Auto Split" — creators set their own price; applying a scheme splits instantly: 90/10 for originals, 85/10/5 for derivatives.

SECTION 3 — FEATURED (light)
- Eyebrow "FEATURED", H2 "Most-referenced designs", right-aligned link "View all →".
- 3 scheme cards: large preview image (interior room photo/render), a small style chip (e.g. "Nordic"), scheme title, creator short address in mono, and a metrics row (remix count, applied count, price in MON, e.g. "0.01 MON"). One card shows a "Derivative" badge.

SECTION 4 — HOW IT WORKS (light)
- Eyebrow "HOW IT WORKS", H2 "From idea to income in four steps".
- 4 numbered step cards: 1 Generate — "Create a design scheme with AI conversation"; 2 Publish — "Mint as an NFT; authorship and lineage go on-chain"; 3 Get Remixed — "Others keep creating on top of your design"; 4 Get Paid — "Applied schemes split instantly at your set price".

SECTION 5 — CLOSING CTA (dark panel, grid sheet)
- H2 "Start your first on-chain design", subtext "No wallet needed — one-click mint with a Passkey, gas paid by the relayer. Browse the gallery first and keep building on a design you like."
- Buttons "Create My Scheme" + "Browse Gallery".

Bilingual labels (English primary, small secondary subtitle). Desktop first, then a mobile version.
```

### 2.2 Gallery `/demo`

```
Design the GALLERY page ("Scheme Gallery") for Designer Hub.

- Header block: eyebrow mono "GALLERY · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "Scheme Gallery", a one-line description, and a stats strip (SCHEMES / REMIX / APPLIED / FURNITURE).
- A "Demo Data Mode" notice chip with an info panel explaining that once the contract address is set the gallery switches to live on-chain data.
- Filter row: a "Filter by style" chip group — All / Modern / Nordic / Japanese / Industrial — with counts, active chip filled violet.
- Main grid of scheme cards (responsive 1 / 2 / 3 columns): each card = preview image, style chip, title, creator mono short address, AI-agent attribution ("AI · Kimi"), metrics (remix / applied / price MON), and a small "Derivative" tag when it has a parent.
- Include a loading skeleton state, an empty state ("No schemes yet…" with a "Create one" button), and an error state.

Keep it dense but airy; the grid should feel like a design-asset marketplace, not a crypto dashboard.
```

### 2.3 Mint Center `/mint`

```
Design the MINT CENTER page for Designer Hub.

- Header: eyebrow "MINT · MINT CENTER", H1 "Mint Center", description mentioning parentId lineage; a "Demo Data Mode" chip when applicable.
- A dark "MY MINT" stats panel (4 stats): SCHEMES my schemes / MINTS on-chain mints / REMIX RECEIVED derived by others / REMIX SENT I derived others.
- Three big entry cards, each with eyebrow + title + CTA:
  - Origin → "Mint an original scheme" → button "Go to create page"
  - Remix → "Remix from someone's work" → button "See remix opportunities"
  - Version → "Publish a new version" → button "See my schemes"
- A "REMIX OPPORTUNITIES" section: "Keep creating on top of someone's design", sorted by popularity, with a note "schemes you've already remixed are excluded", listing compact scheme rows/cards with a "Remix" action.
- If the wallet is on the wrong chain, show a "Switch to Monad Testnet" warning callout.
```

### 2.4 Create Scheme `/mint/create`

```
Design the CREATE page where a user turns a design scheme into an on-chain NFT.

- Left: a large preview / dropzone for the scheme (accepts a "scheme code (base64url)" paste, an image preview, or an uploaded scheme JSON preview showing a rendered room).
- Right: a clean form — Scheme title, style selector (Modern/Nordic/Japanese/Industrial), room type, a price field with "MON" suffix ("creator-set pricing"), AI attribution selector (defaults to "Kimi · agentId 1"), and a "choose preview image" control.
- Show the lineage/attribution note: "Mint as original (parentId = 0)" vs when remixing "Derived from #12".
- Primary CTA "Mint as NFT"; if the user has a Passkey show "One-click mint with Passkey (gas paid by relayer)", otherwise show a "Connect wallet (fallback)" secondary button.
- Add inline validation states and a small "Upload pins to IPFS" hint.
```

### 2.5 Scheme Detail `/scheme/[id]`

```
Design the SCHEME DETAIL page for a single on-chain interior-design scheme (token #id).

- Hero band: large room preview/render on the left; on the right — scheme title, style chip, creator address (mono, with copy), "AI · Kimi" attribution, current price in MON, and a "Derivative · parent #12" breadcrumb when applicable.
- Primary actions: filled violet "Apply to my home" (buy/apply → instant split) and outline "Remix this design"; owner-only "List / change price (setPrice)" control.
- A "SPLIT PREVIEW" mini panel showing how payment divides: for originals 90% creator / 10% platform; for derivatives 85% creator / 10% platform / 5% ancestor lineage pool — visualize as a segmented bar.
- A "LINEAGE" section: a small on-chain tree/graph (parent → this → children) with token ids.
- A "VERSIONS" vertical timeline (v1 → v2 → v3) with dates and author.
- A "COMMENTS" section: off-chain, wallet-signature verified, zero gas — input + list of comments with avatar, short address, timestamp.
- A details panel listing: contract, tokenId, IPFS CID, ERC-2981 royalty (5%), provenance commitment hash.

Blend a product page (like a design-asset store) with a provenance/audit panel.
```

### 2.6 Remix page `/remix/[id]`

```
Design the REMIX page — forking someone else's on-chain scheme.

- Header: "Remix #12 — <scheme title>", a clear "Original author & lineage will be recorded on-chain" callout.
- Side-by-side: left = the ORIGINAL scheme preview (read-only); right = your NEW version editor/preview (you modify style/colors/furniture before minting).
- A diff/summary strip: "Changes" chips (style changed, X furniture replaced).
- A lineage preview: "New scheme will point to parent #12" with a mini tree.
- Actions: "One-click mint this derivative with Passkey (gasless)" primary, "Connect wallet (fallback)" secondary.
- Show the derivative split reminder: 85/10/5 (creator / platform / ancestor pool).
```

### 2.7 Trades `/trades`

```
Design the TRADES / LEDGER page ("Trade History") for Designer Hub.

- Header: eyebrow "TRADES · ON-CHAIN LEDGER", H1 "Trade History", description: every "Apply to my home" triggers an on-chain split with no platform vault and no withdraw step.
- Dark "LEDGER OVERVIEW" stats panel: APPLIES cumulative applies / VOLUME cumulative volume (MON) / TO CREATORS paid to creators (violet accent) / TO TREASURY platform's cut.
- A "MY EARNINGS" card: "My spend and income" with rows SPENT fees I paid / EARNED received as creator / SETTLEMENT settlement method ("instant split, no withdrawal"), plus a link "View SchemeMarket on explorer ↗".
- "FLOW" section: "All apply records" with filter tabs (All, Bought, Sold, Splits), and a table of rows: time, scheme (with thumbnail), buyer short address, amount MON, split breakdown (creator/platform/ancestor), tx hash (mono, linked).
- Include a demo-data-mode chip and an "Index pending" state.
```

### 2.8 Board `/board`

```
Design the LEADERBOARD page ("Creative Leaderboard") for Designer Hub.

- Header: eyebrow "LEADERBOARD · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "Creative Leaderboard", and an explainer: "heat = applies × 3 + remixes × 2".
- A dark "TOP SCHEME" hero card: the #1 scheme as a large feature — preview image, title, style, creator, and its metrics (remix / applied / furniture count).
- A ranked list (#1–#10) of schemes: rank number (big display), thumbnail, title, creator, a small horizontal "heat" bar, and metric columns (REMIX / APPLIED / FURNITURE). Top 3 get a subtle violet/gold accent.
- Include a demo-data-mode chip and an empty state.
```

### 2.9 Passkey page `/passkey`

```
Design the PASSKEY page — the seedless, gasless identity entry for Designer Hub.

- Dark hero: eyebrow "PASSKEY · MNEMONIC-FREE ACCOUNT (PRIMARY FLOW)", H1 "Sign in to web3 with Face ID".
  Subtext: "No seed phrase, no browser extension, no MON required. The private key is generated inside the device secure element and never exported; the relayer pays gas, so one fingerprint / face tap completes an on-chain action. The Passkey key never touches funds — the payment key is the user's choice."
  Buttons: "Create passkey" primary, "Browse leaderboard" outline, "How it works" ghost.
- A step panel "Step 1–3 · Create → Derive address → Deploy" as a vertical stepper with live status: shows RP ID (domain localhost), the derived CREATE2 account address (mono), and deploy status / tx hash. Each step has pending / success / error states.
- A small "Advanced / fallback" block: "Already have a wallet? Connect MetaMask" — an outline button with a note that paid actions (apply to my home) require the wallet.
- On a non-HTTPS/localhost origin, show an inline warning that a valid domain (localhost / https) is required for WebAuthn.
```

### 2.10 Docs `/docs`

```
Design the DOCS / MECHANICS page ("Mechanics & Rules") for Designer Hub.

- Dark hero: eyebrow "MONAD HACKATHON · TRACK 04 — TRUST, IDENTITY & AI INFRASTRUCTURE", H1 "Mechanics & Rules", subtext about scheme → on-chain remixable/attributable/revenue-splitting creative assets where every iteration, citation and application settles into an on-chain attention asset.
- A "quick start" numbered guide (claim test MON → create → remix → track on Mint & Trades → watch the Leaderboard).
- A FAQ accordion with items like: "Does minting and remixing cost money?" / "Does the Passkey touch my funds?" / "Why do comments need no gas?" / "What is a scheme code (base64url)?" / "Can I demo without configuring Pinata / Kimi?" / "Can scheme content be tampered with?"
- Optional: a technical "primitives" section listing the 5 contracts (DreamScheme / SchemeMarket / AgentRegistry / ProvenanceRegistry / PasskeyAccountFactory) as clean code-styled cards with one-line descriptions.
```

---

## ③ Component-level prompts (for adding detail)

**SchemeCard**
```
Design a single scheme card component: rounded white card, hairline border, hover → violet border lift. Top: 4:3 preview image of an interior room, with an overlay style chip (e.g. "Nordic") top-left and a price chip "0.02 MON" top-right. Bottom: title (bold), creator short address in mono gray, a small "AI · Kimi" byline, and a metrics row with tiny icons: ⟳ 3 remix · ⬚ 5 applied. If derived, a small "Derivative" tag.
```

**LineageTree**
```
Design a compact on-chain lineage tree component: small rounded nodes labelled "#12 v1", "#18 v2", "#24 v3" connected by thin vertical/elbow lines (blueprint style), the current node highlighted in violet, ancestors muted, children dashed. Add tiny mono captions "parentId" on the edges.
```

**VersionTimeline**
```
Design a vertical version timeline: a thin left rail with dots; each entry shows version tag "v2", a short change summary, author short address + date in mono. Current version dot filled violet.
```

**SplitBar**
```
Design a payment-split visualization: a single horizontal rounded bar segmented by percentage with labels — original: 90% Creator (violet) / 10% Platform (gray); derivative: 85% Creator (violet) / 10% Platform (gray) / 5% Ancestor pool (coral). Include a legend with exact numbers.
```

---

## ④ Tips for using Stitch

1. **Master prompt first, then per-screen**: the first master prompt establishes the style baseline; then prompt each screen separately for more controllable, complete results.
2. **One screen at a time**: Stitch generates one view (desktop or mobile) per prompt. For a long multi-section page like the home page, split it into "Hero+Stats", "Capabilities", "Featured", "How it works", "CTA" and generate them in parts.
3. **Fonts & colors**: state the hex values (#0F0F12 / #FBFAF9 / #6E54FF) and "monospace uppercase labels + geometric display headings" in the prompt for much better consistency.
4. **Blueprint motif**: mention "thin dimension lines with tiny monospace annotations" in every section — it is the project's visual signature; don't lose it.
5. **Language**: Stitch generates English UI by default. For a bilingual interface, state "English primary with a small EN/ZH toggle" and paste the copy in.
6. **Experimental mode**: to get closer to the current site, upload existing screenshots (`brand/pg-home2.png`, `docs/screenshots/*.png`) as an image prompt, then describe the direction in text (e.g. "more whitespace, more restrained cards, less violet").
7. **Iteration**: if a block isn't right, select it and prompt "make this section darker / reduce visual noise / increase whitespace / change CTA to ..." — cheaper than regenerating the whole page.
8. **Export**: Stitch results can be pasted into Figma (Paste to Figma) or exported as front-end code, as a design reference for re-drawing `web/`.

---

## ⑤ Reusable short "English quick-paste" master prompt

```
Design a website for "Designer Hub" — the GitHub for Interior Design. It turns AI-generated interior design schemes into on-chain ERC-721 assets that can be remixed, attributed, and revenue-shared. Built on Monad Testnet (chain 10143), Track 04: Trust, Identity & AI Infrastructure.

Visual language: architectural blueprint meets premium fintech. Dark near-black sections (#0F0F12) with faint blueprint grids and violet glow; light warm-paper sections (#FBFAF9). Accent electric violet #6E54FF. Thin dimension lines with tiny monospace uppercase annotations are the signature motif. Geometric display headings (Archivo-like) + system body font + monospace for technical labels/addresses/numbers. Rounded cards, hairline borders, soft shadows. Bilingual labels with a small EN/ZH toggle. Sticky top bar with a single "Passkey" control; nav: Home / Gallery / Mint / Trades / Board / Docs.

Feel: clean, technical, quietly premium — a design-asset marketplace, not a crypto casino.
```
