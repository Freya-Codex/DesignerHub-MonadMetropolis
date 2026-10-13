# Judging alignment & gap analysis

_Assessment of the Designer Hub repo against the hackathon's stated judging rubric.
The rubric text is the one provided in-conversation; this document maps **evidence in the repo**
to each criterion and lists what was missing._

Rubric (weights): **Technical Execution 20% · Design & Craft 20% · Originality & Track Insight 15% ·
Founder & Market Readiness 25% · Traction & Path Forward 20%.**

> **Headline:** the rubric evaluates a **developer primitive** ("…usable by the developers who'd
> build on it", "…why they'd choose it over rolling their own", "…one other team integrating it").
> The repo was **app-first**. Before this pass the biggest gap was the entire **developer-facing
> layer** — which spans ~65% of the weight. This pass adds that layer (see "Actions taken").

---

## Criterion-by-criterion

### 1 · Technical Execution — 20%

| | |
| --- | --- |
| **Rubric asks** | trust/identity/data primitive implemented correctly & securely — correct WebAuthn/P256, sound key derivation, **no leaked secrets** |
| **Evidence (have)** | `P256PasskeyAccount` verifies a real WebAuthn assertion on-chain; pure-Solidity P-256 fallback (probes RIP-7212 `0x100`, falls back to Jacobian math); CREATE2 address from `(x, y, rpIdHash, originHash)`; challenge binds `account ‖ chainId ‖ nonce ‖ to ‖ value ‖ keccak256(data)` so a relayer cannot tamper; 103 Foundry tests; **real testnet E2E** (deploy tx `0x5d5c3d9b…`, execute tx `0xd7ef914c…` with an `Attested` event); no secret committed (only public keys/fixtures in repo) |
| **Gap** | No written threat model; `.env.example` files referenced the **old** variable names (an integrator following docs got an empty address); no "no-leaked-secrets" statement (key handling, secret scanning) |
| **Status** | ✅ addressed → `docs/SECURITY.md`; env examples fixed |

### 2 · Design & Craft (developer experience) — 20%

| | |
| --- | --- |
| **Rubric asks** | usable by **developers who'd build on it** — clear docs, clean interface/API, **even without an end-user UI**. Design = DX |
| **Evidence (have)** | a polished end-user Next.js app; `/docs` in-app page |
| **Gap (was the largest)** | **no SDK / typed client, no integration guide, no API reference, no quickstart for a third-party dev**; the repo README was an *app* README, not a *primitive* README |
| **Status** | ✅ addressed → **`@designerhub/sdk`** (`sdk/`, typed, buildable, typechecked, challenge vectors cross-checked) + `docs/INTEGRATING.md` |

### 3 · Originality & Track Insight — 15%

| | |
| --- | --- |
| **Rubric asks** | solves trust/provenance/data-ownership **privacy-preservingly** and **not capturable by a single platform** |
| **Evidence (have)** | `ProvenanceRegistry` stores only `keccak256(contentHash ‖ salt)` — content stays off-chain (privacy-preserving); lineage + instant split live on-chain (not capturable); passkey = no seed phrase to custody; the market has **no platform vault** |
| **Gap** | the anti-capture story was implicit; the relayer is a **single-operator** component and needed an explicit "permissionless / replaceable" argument |
| **Status** | ✅ addressed → `docs/INTEGRATING.md` ("why it isn't capturable") + `docs/SECURITY.md` (relayer trust model) |

### 4 · Founder & Market Readiness — 25% · _highest weight_

| | |
| --- | --- |
| **Rubric asks** | knows **which** specific applications/developers would adopt it, **and why** over rolling their own |
| **Evidence (have)** | a working first integrator (the VirtuHome App) that exports scheme JSON |
| **Gap (was absent entirely)** | **no named adopter segments, no "build vs buy" argument, no adoption/pricing model** |
| **Status** | ✅ addressed → `docs/INTEGRATING.md` ("Who builds on this" + "Why not roll your own") |

### 5 · Traction & Path Forward — 20%

| | |
| --- | --- |
| **Rubric asks** | **evidence of developer interest** (even one other team integrating during the hackathon) + a **specific** post-event integration plan |
| **Evidence (have)** | self-served E2E on testnet (not third-party) |
| **Gap** | **no third-party integration yet**, and no concrete plan; nothing for another team to integrate *with* |
| **Status** | ⚠️ partially — the **integration kit now exists** (SDK + guide), and a concrete post-event plan is written (`docs/INTEGRATING.md` §Roadmap). **No external integration is claimed** — that remains honest/unmet and is the top pre-submission priority |

---

## What was missing — prioritized

| # | Gap | Weight hit | Action |
| --- | --- | --- | --- |
| 1 | No developer SDK / typed API | Design 20% + Market 25% + Traction 20% | **done** — `sdk/` (`@designerhub/sdk`) |
| 2 | No integration docs / quickstart / API reference | Design 20% | **done** — `docs/INTEGRATING.md`, `sdk/README.md` |
| 3 | No "why not roll your own" / named adopters | Market 25% | **done** — `docs/INTEGRATING.md` |
| 4 | No security/threat-model & secrets statement | Technical 20% | **done** — `docs/SECURITY.md` |
| 5 | Env examples stale (old variable names) | DX / Technical | **done** — `.env.example` × 3 fixed |
| 6 | Relayer centralization not addressed | Originality 15% | **done** — permissionsless/replaceable argument |
| 7 | **No third-party integration evidence** | Traction 20% | **open** — needs a second team; plan written, not yet executed |
| 8 | No live deployment URL / demo video | Market + Traction | **open** — `README` still has `youtu.be/REPLACE_ME` |

Items **1–6** are addressed in this pass. Items **7–8** require action outside the codebase
(recruit one integrating team; host the app; record the demo).
