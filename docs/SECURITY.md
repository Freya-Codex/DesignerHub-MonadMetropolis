# Security & threat model

Scope: the on-chain trust/identity/data primitives in `contracts/src` and their off-chain client
(`web/lib/passkey.ts`, `sdk/`). This document states what is guaranteed, what is explicitly **not**
guaranteed, and where the trust boundaries are.

---

## 1. Identity — passkey smart account

**Construction.** A P-256 (ES256) WebAuthn credential is created in the device secure element
(Secure Enclave / StrongBox / TPM). The account address is
`CREATE2(salt = keccak256(x, y, rpIdHash, originHash))` via `PasskeyAccountFactory`. The private key
is **never** exportable and never leaves the device.

**What the account guarantees**
- **Authorization is the signature, not the sender.** `execute(to, value, data, assertion)` may be
  submitted by *any* address; it succeeds only if the WebAuthn assertion verifies. A relayer cannot
  forge or alter a call.
- **No replay.** Every execution consumes a monotonically increasing `nonce`; the challenge includes
  the current nonce, so a captured assertion is single-use.
- **No tampering.** The challenge is
  `keccak256(abi.encodePacked("dh/passkey/tx", account, chainId, nonce, to, value, keccak256(data)))`
  — it binds the **exact** calldata, target, value, chain, and account. Changing any byte invalidates
  the signature.
- **Domain binding.** `rpIdHash = sha256(rpId)` and `originHash = keccak256(origin)` are immutables,
  so a credential registered for one site cannot be used against another with the same account
  params.

**Explicit non-guarantees / cautions**
- **`originHash == bytes32(0)` disables the origin check.** Use it only if you deliberately want the
  credential to work from any origin with the same `rpId`. The demo expects a real origin hash.
- **P-256 signature malleability.** `P256.verify` rejects `s == 0 || s >= N` but does **not** enforce
  low-`s`. This does not affect the WebAuthn flow (the nonce prevents replay, and each nonce is used
  once), but do not reuse this verifier where a third party could exploit malleability.
- **Key loss = account loss (until recovery).** Up to **4** keys per account (`addKey`) allow
  multi-device recovery; the social/backup process is out of scope here.
- The address is determined by `(x, y, rpIdHash, originHash)`: a **different domain or port**
  (e.g. `localhost` vs `127.0.0.1`) yields a **different account**. This is a UX footgun, not a
  vulnerability.

---

## 2. Verifier correctness

- Supports the **RIP-7212 `0x100` precompile** when present, and **falls back to a pure-Solidity
  P-256 implementation** otherwise. We measured Monad Testnet: `0x100` has no code, and the `0x05`
  modexp precompile is non-standard (416 zero bytes), so the **pure-Solidity path is the live path**.
  The correct path is selected at runtime and exercised by tests.
- Tested against Foundry fixtures (`contracts/test/fixtures/`) with fixed challenge vectors; the TS
  client's `deriveSingleChallenge` / `rpIdHashHex` / `originHashHex` are cross-checked to reproduce
  the same bytes on-chain (verified against the known vector during development).
- CBOR/COSE parsing (EC2 keys, `-2`/`-3` coordinates) and DER→(r,s) conversion are implemented
  locally in the client with no third-party crypto dependency.

---

## 3. Data ownership — ProvenanceRegistry

- Only `commitment = keccak256(contentHash ‖ salt)` is stored; the **content and the salt stay
  off-chain**. Attestation proves *that* a commitment existed at a time, not what it was — unless the
  owner reveals the preimage.
- `attest` is public and records `msg.sender` as the attestor. For a passkey user, the account calls
  `attest` through `execute`, so `msg.sender` is the account (not the relayer).
- An optional EIP-712 `attestByRelayer` path exists for EOAs; the signature binds the exact request.

---

## 4. Money — SchemeMarket

- **No vault, no withdraw.** `applyScheme` splits the payment in the same transaction: 90/10
  (original) or 85/10/5 creator/platform/ancestor pool (remixed), ancestors deduped, depth capped at
  16, dust to platform. Nothing is custodied by an operator.
- Creator addresses are fixed at mint time and survive NFT transfers. If a creator rejects the
  native token, their share is escrowed rather than reverting the buyer's flow.
- `setPrice` is creator-only; `splitPreview` is the dry-run.

---

## 5. Relayer trust model

The demo relayer (`web/app/api/relay`) holds a testnet key and pays gas so passkey users need no MON.

- **It cannot move funds or alter calls** (challenge binding + `value` forced to `0`).
- Guardrails: **testnet only**, **target allowlist** (our contracts + the account's `addKey`),
  **global + per-account daily caps** (in-process), **simulate before submit**.
- It **can** censor (decline to submit) or run out of quota — that is the intended trust boundary for a
  demo. It is **replaceable**: any address can submit the same signed call. Production would add
  persistent quotas, metering, and KMS-managed keys.

---

## 6. Secrets handling ("no leaked secrets")

- **No private key, mnemonic, or API secret is committed.** Repo scans find only public keys (P-256
  `x/y`) and WebAuthn fixtures; keys are read from `.env.local` (gitignored).
- `.env.example` files contain **only placeholders** and no real values.
- The relayer key falls back to `MONAD_PRIVATE_KEY`; both live only in the untracked `.env.local`.
- **Recommendation before submission/public release:** run `gitleaks`/`trufflehog` over the full git
  history, and rotate any key ever used locally on testnet.

---

## 7. Known limitations

- Demo-grade relayer (see §5) and demo-grade comment store (`web/data/comments`, non-authoritative).
- Not audited. Code is written to be reviewable, but has not had a third-party security review.
- Passkey flows are browser-only; the SDK's WebAuthn functions require a secure context (HTTPS or
  `localhost`).
