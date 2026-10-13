# Designer Hub · Monad — Project Brief

> **Turning generative content into on-chain creative assets that are signable, remixable, and
> instantly revenue-sharing — a developer-first set of identity / provenance / data-ownership /
> agent-trust primitives.**

- **Track**: **Track 04 — Trust, Identity & AI Infrastructure**
- **Network**: Monad Testnet (chainId `10143`)
- **Deliverables**: 5 deployed contracts + a front-end app + a typed SDK (`@designerhub/sdk`) + integration docs (the "primitive" form Track 04 asks for)
- **This brief is organized per the hackathon's judging rubric (Technical 20% / Design 20% / Originality 15% / Market 25% / Traction 20%)**

---

## 0. Why this belongs in Track 04

The official definition of Track 04: **"AI has made identity, provenance, data ownership, and agent
trust urgent infrastructure problems"** — protocol-level primitives for the AI-native internet
(proof of personhood / content passports / data lockers), best fit for teams "comfortable with
cryptography, protocol design, or agent frameworks." It explicitly requires a **primitive other apps
can build on, not a standalone consumer product**.

Designer Hub maps to this track point by point, and **delivers everything in "third-party-integrable
primitive" form** (SDK + integration docs, not just an app):

| Track 04 keyword | The primitive we ship |
| --- | --- |
| **Identity** | `P256PasskeyAccount` + `PasskeyAccountFactory` — a seedless WebAuthn/P-256 smart account; the private key never leaves the device secure element |
| **Provenance** | `ProvenanceRegistry` — only the content commitment `keccak256(contentHash ‖ salt)` goes on-chain; the content itself never does; `DreamScheme` records on-chain lineage |
| **Data ownership** | Lineage and splits live on-chain, not locked in a single platform's database; no platform vault |
| **Agent trust** | `AgentRegistry` — AI-generator registration + reputation + on-chain `agentId` attribution |
| **"Primitive, not product"** | Ships `@designerhub/sdk` + `docs/INTEGRATING.md`; third parties can build on it without our UI |
| **cryptography / protocol design / agent frameworks** | Real P-256 + WebAuthn on-chain verification, a CREATE2 account protocol, and an AI-agent registry |

---

## 1. The problem

When generative content (design drafts, 3D assets, presets, AI output) spreads and gets remixed,
**attribution, provenance, and revenue** all fail at once:

1. Once a work is remixed / reused, the original creator earns nothing and cannot prove "who made it first";
2. Attribution records are locked in a **single platform's database** — the platform can change, freeze, or erase them; the creator is captured by the platform;
3. Once AI is involved in generation, there is **no neutral, auditable record of which model produced what**;
4. On the user side, "identity" is either a custodial account or a string of seed words — high churn, heavy liability.

Existing approaches just **re-centralize the problem elsewhere**: one more platform vault, one more private database.

---

## 2. The solution: three composable layers of primitives

Designer Hub is not "an app" — it is a set of **third-party-integrable on-chain primitives**, all
already running on Monad Testnet:

| Primitive | Contract | What it provides |
| --- | --- | --- |
| **Passkey identity** | `P256PasskeyAccount` + `PasskeyAccountFactory` | A mnemonic-free smart account. Address = `CREATE2(x, y, rpIdHash, originHash)`; the private key lives permanently in the device secure element (Secure Enclave / StrongBox / TPM); the chain verifies a **real WebAuthn assertion**, and the challenge binds `account ‖ chainId ‖ nonce ‖ to ‖ value ‖ keccak256(data)`, so **any relayer can pay gas yet cannot tamper with the call**. |
| **Provenance / data ownership** | `ProvenanceRegistry` | Only the content commitment `keccak256(contentHash ‖ salt)` goes on-chain (**the content itself never does**), with a timestamp and AI agentId. Privacy-preserving attestation. Supports a direct EOA `attest` or `attestByRelayer` (EIP-712 authorization). |
| **Remixable assets + lineage** | `DreamScheme` + `SchemeMarket` | ERC-721 assets with on-chain lineage via `parentId` (a v1→v2→v3 timeline); creators set their own price with `setPrice`; applying "to my home" splits **instantly** — original **90/10**, derivative **85/10/5** (creator / platform / ancestor lineage pool), **no platform vault, no `withdraw()`**; resale follows ERC-2981 (5% royalty). `AgentRegistry` records AI generators (Kimi pre-registered as `agentId = 1`) and reputation, making "the scheme **and** the model that generated it" publicly attributable. |

The main flow uses Passkey (fingerprint / Face ID login; the user needs no MON, the relayer pays gas);
MetaMask is kept as an "advanced mode".

---

## 3. Mapping to the Track 04 rubric (What judges look for)

> The 5 criteria below, weighted 20 / 20 / 15 / 25 / 20, come from Track 04's official rubric. Each
> lists "what judges look for" → "our evidence."

### Scoring at a glance

| Criterion | Weight | One-line landing | Status |
| --- | --- | --- | --- |
| Technical Execution | 20% | real WebAuthn/P256 on-chain verification, CREATE2 key derivation, no leaked secrets (103 tests + testnet E2E) | ✅ strong |
| Design & Craft (DX) | 20% | a typed SDK + integration guide + runnable examples, usable without our UI | ✅ strong (new) |
| Originality & Track Insight | 15% | content never on-chain + no platform vault + permissionless, replaceable relayer | ✅ strong |
| Founder & Market Readiness | 25% | four named adopter segments + "why not roll your own" cost argument + a first-party integrator | ✅ strong (new) |
| Traction & Path Forward | 20% | integration kit shipped; **no third-party integration yet** (stated honestly) + a 4-step post-event plan | ⚠️ partial (gap is the third party) |

### 1. Technical Execution — 20%
**Asked**: trust / identity / data primitives implemented correctly and securely — correct WebAuthn/P256, sound key derivation, no leaked secrets.

- The chain verifies a **real WebAuthn assertion**; a pure-Solidity P-256 fallback (probes the RIP-7212 `0x100` precompile, falls back to Jacobian math when absent) → works on chains without the precompile, **including Monad**.
- **Key derivation**: `CREATE2(x, y, rpIdHash, originHash)` — the counterfactual address can be shown before deployment; up to 4 keys per account (`addKey`) for multi-device recovery.
- **Tamper-proofing**: the challenge binds the full calldata digest + nonce; a relayer cannot change arguments or the recipient.
- **No leaked secrets**: the repo contains only public keys / test fixtures; `docs/SECURITY.md` documents the threat model, key handling, and secret scanning.
- **Tests & reality**: Foundry **103 cases all passing**; real testnet E2E has run (deploy tx `0x5d5c3d9b…`, execute tx `0xd7ef914c…`, including an `Attested` event).

**Evidence**: `contracts/test/*` (103 cases) · `docs/SECURITY.md`

### 2. Design & Craft (developer experience) — 20%
**Asked**: usable by "the developers who'd build on it" — clear docs, a clean interface/API, **even without an end-user UI**.

- A typed SDK **`@designerhub/sdk`** (buildable, typechecked, challenge vectors cross-checked against the chain), with three integration paths:
  - **Read-only** (no wallet, no keys, 2 minutes);
  - **Standard EOA wallet** (mint / setPrice / apply);
  - **Passkey account** (mnemonic-free + optional gas sponsorship).
- Docs: `docs/INTEGRATING.md` (integration guide + adopters + "why not roll your own" + gas-sponsorship boundaries + post-event plan), `sdk/README.md` (API reference + examples), and the in-app `/docs` page.
- Runnable: `npx tsx sdk/examples/read-schemes.ts`.

**Evidence**: `sdk/` (typed, buildable) · `docs/INTEGRATING.md` · `sdk/README.md`

### 3. Originality & Track Insight — 15%
**Asked**: solve trust / provenance / data ownership in a **privacy-preserving way that cannot be captured by a single platform**, rather than re-centralizing in a new shape.

- **Privacy-preserving**: `ProvenanceRegistry` stores only the commitment hash; the content never goes on-chain.
- **Not capturable**:
  - **No platform vault** — payment goes **within the same transaction** straight to creator / platform / ancestors; there is no balance to freeze;
  - **Lineage is on-chain, not in a database** — attribution does not depend on any single app;
  - **The relayer is permissionless and replaceable** — `execute(...)` can be called by anyone, **the signature is the authorization**; our demo relayer is a convenience, not a dependency;
  - **Identity belongs to the user** — the key lives in the user's device secure element, non-custodial.

**Evidence**: `docs/INTEGRATING.md` §"Why it isn't capturable" · `docs/SECURITY.md` (relayer trust model)

### 4. Founder & Market Readiness — 25% (highest weight)
**Asked**: know **which specific applications / developers** would adopt it, **and why** over rolling their own.

**Target adopters** (`docs/INTEGRATING.md`):

| Adopter | Why use it instead of building it themselves |
| --- | --- |
| **Generative / design tools** (like the VirtuHome App itself) | Get on-chain attribution + revenue splitting without writing WebAuthn/P256 verification, CREATE2 accounts, or lineage math. |
| **Content marketplaces / asset libraries** (3D assets, floor plans, presets) | Drop-in passkey login (no seed phrases, higher conversion) + enforceable resale royalty and remix lineage. |
| **AI-agent platforms / model & data providers** | `AgentRegistry` + `ProvenanceRegistry` provide a neutral on-chain record of "which model produced what," for audit, disputes, and reputation (Track 04's agent-trust scenario). |
| **Identity / wallet SDKs** | A reference implementation of a P-256 WebAuthn account + pure-Solidity verifier (works on chains without the RIP-7212 precompile). |

**Rolling your own means re-implementing**: WebAuthn assertion parsing + P-256 verification (EC2 COSE keys, DER→(r,s), low-s/edge cases), a CREATE2 account with replay-safe nonces, an anti-tamper challenge scheme, an attestation registry, and a lineage-aware splitter — about a week of security-sensitive work; the SDK compresses it into a few typed calls.

**The first-party integrator is already in place**: the VirtuHome App (`virtu-home`) can integrate by exporting a scheme JSON.

### 5. Traction & Path Forward — 20%
**Asked**: evidence of developer interest (even **one other team** integrating during the hackathon), plus a **specific** post-event integration plan.

- **Status (honest)**: today **self-served E2E works, but there is no third-party integration yet**; we do not overstate this. The "interface" needed to integrate is ready (SDK + guide + runnable examples).
- **Post-event plan** (`docs/INTEGRATING.md` §Roadmap, concrete and executable):
  1. **Ship the kit** (done): publish `@designerhub/sdk` + guide + examples;
  2. **Land one integrator during the event**: the VirtuHome App is the first-party integrator; recruit **one external team** (a design tool / asset library / AI-agent platform) to mint/attest through the SDK — **even a read-only integration counts**;
  3. **Post-event**: open a small integration bounty / "built on Designer Hub" track, add a `builtWith` registry, and host the demo (Demo URL + recorded video);
  4. **Follow-ups**: a metered / paid relayer, per-agent analytics on `AgentRegistry`, and an EIP draft for the "commitment + lineage" pattern.

---

## 4. Status & honest gaps (pre-submission priorities)

| Item | Status |
| --- | --- |
| 5 contracts deployed + 103 tests + testnet E2E | ✅ done |
| SDK / integration docs / security docs | ✅ done |
| Third-party integration evidence | ⚠️ **not achieved** — need to recruit a second team (top priority) |
| Live demo URL / demo video | ⚠️ **not done** — README still has `youtu.be/REPLACE_ME` |

---

## 5. Deployment info (Monad Testnet · chainId 10143)

| Contract | Address |
| --- | --- |
| `DreamScheme` | `0x2541eB7A4AC7bb5287A5944452576f983b3dc3eB` |
| `SchemeMarket` | `0x51DBCb43D2279e7d108753490794f97AA43877a9` |
| `AgentRegistry` | `0x9EB3d5C336c66823577F4FBB1E31dbABcf7c268D` |
| `ProvenanceRegistry` | `0xCe41D2fa11fC3944662b783ac895D3380B8B09ED` |
| `PasskeyAccountFactory` | `0x41E72cc140b30891b34Da45f3ed55a525c758C76` |

- Deploy block `66892530` · Kimi `agentId = 1` · platform / deployer `0x33DD409d85115E300B4570EeB6D4DA7eF1605D08`
- Explorer <https://testnet.monadexplorer.com> · RPC `https://testnet-rpc.monad.xyz` · Faucet <https://faucet.monad.xyz>

---

## 6. Further reading

| Doc | Contents |
| --- | --- |
| [`README.md`](../README.md) | architecture, contracts, routes, quick start |
| [`docs/INTEGRATING.md`](./INTEGRATING.md) | primitives, adopters, "why not roll your own", integration paths, gas sponsorship, post-event plan |
| [`docs/SECURITY.md`](./SECURITY.md) | threat model, P-256/WebAuthn correctness, relayer trust, key handling |
| [`docs/JUDGING-ALIGNMENT.md`](./JUDGING-ALIGNMENT.md) | criterion-by-criterion mapping (evidence / gaps / actions) |
| [`sdk/README.md`](../sdk/README.md) | SDK API reference and examples |
