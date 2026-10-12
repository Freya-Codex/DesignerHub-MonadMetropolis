# Integrating Designer Hub

Designer Hub is not just a demo app — it is a small **on-chain primitive set** on Monad you can
build on. This guide is for the developer who wants to use it **without** our UI.

If you only read one thing: install [`@designerhub/sdk`](../sdk/README.md) and call `readScheme()` /
`createPasskey()` / `deriveSingleChallenge()`.

---

## The primitive

Three composable primitives, all live on Monad Testnet (chainId 10143):

| Primitive | Contract | What you get |
| --- | --- | --- |
| **Passkey identity** | `P256PasskeyAccount` + `PasskeyAccountFactory` | A mnemonic-free smart account whose address is `CREATE2(x, y, rpIdHash, originHash)`. The key lives in the device secure element; the account executes calls authorized by a WebAuthn assertion that **binds the exact calldata + nonce**, so any relayer can pay gas without being able to change the call. |
| **Provenance / data ownership** | `ProvenanceRegistry` | Commit `keccak256(contentHash ‖ salt)` on-chain (content stays off-chain) with a timestamp + AI-agent id. Privacy-preserving attribution. |
| **Remixable assets with lineage** | `DreamScheme` + `SchemeMarket` | ERC-721 assets with on-chain `parentId` lineage and a creator-set price. Every use pays out **instantly** (90/10 original, 85/10/5 remixed) — no vault, no `withdraw()`. |

These are deliberately **not** interior-design-specific: "a tamper-proof way to sign, attribute, and
pay for content that is generated and remixed over time" applies to any generative content.

---

## Why it isn't capturable by a single platform

- **No platform vault.** Payments go straight from buyer to creator/platform/ancestor in the same
  transaction. There is nothing to freeze and no operator-held balance.
- **Lineage is on-chain, not in a database.** Attribution survives any single app.
- **The relayer is permissionless and replaceable.** `P256PasskeyAccount.execute(...)` can be called
  by *anyone* — the signature, not the sender, is the authorization. Our demo relayer is a
  convenience, not a dependency; you can run your own (or use none, if the user holds MON).
- **Identity is the user's.** A passkey in the user's secure element, not a custodial account.

---

## Who builds on this (and why, not roll-your-own)

| Adopter | Why they'd use it instead of building their own |
| --- | --- |
| **Generative / design tools** (像 云筑家 App 本身) | Get on-chain attribution + revenue split without writing WebAuthn/P256 verification, CREATE2 accounts, or lineage math. |
| **Content marketplaces / asset libraries** (3D assets, floor plans, presets) | Drop-in passkey login (no seed phrases, higher conversion) + enforceable resale royalty and remix lineage. |
| **AI-agent platforms / model & data providers** | `AgentRegistry` + `ProvenanceRegistry` give a neutral, on-chain record of *which model produced what* — useful for audit, disputes, and agent reputation. |
| **Identity / wallet SDKs** | A reference implementation of a P-256 WebAuthn account with a pure-Solidity verifier that works on chains without the RIP-7212 precompile (Monad included). |

**Rolling your own means re-implementing:** WebAuthn assertion parsing + P-256 verification (EC2
COSE keys, DER→(r,s), low-s/edge cases), a CREATE2 account with replay-safe nonces, an anti-tamper
challenge scheme, an attestation registry, and a lineage-aware revenue splitter. That is a week of
security-sensitive work; the SDK exposes all of it in a few typed calls.

---

## Integration paths

### A. Read-only (no wallet, no keys) — 2 minutes

```ts
import { publicClient, readTotalSupply, readScheme, readSplitPreview } from "@designerhub/sdk";

const client = publicClient();
const total = await readTotalSupply(client);
const s = await readScheme(client, total);            // creator, parentId, lineage, price, agent id
const split = await readSplitPreview(client, total, s.priceWei); // dry-run the payout
```

### B. Standard wallet (EOA) — mint / set price / apply

```ts
import { mintScheme, setSchemePrice, applyScheme } from "@designerhub/sdk";

await mintScheme(wallet, { parentId: 0n, contentHash, agentId: 1n, metadataURI: "ipfs://…" });
await setSchemePrice(wallet, tokenId, 10_000_000_000_000_000n); // 0.01 MON, your call
await applyScheme(wallet, tokenId, priceWei);                    // instant split
```

### C. Passkey account (no mnemonic, optional gas sponsorship)

```ts
import { createPasskey, rpIdHashHex, originHashHex, passkeyFactoryAbi,
         buildAttestData, deriveSingleChallenge, signAssertion, publicClient, monadTestnet } from "@designerhub/sdk";

const cred = await createPasskey({ rpId: "yourdomain.xyz" });
const account = await publicClient().readContract({
  address: monadTestnet.passkeyAccountFactory, abi: passkeyFactoryAbi, functionName: "accountOf",
  args: [BigInt(cred.x), BigInt(cred.y), rpIdHashHex("yourdomain.xyz"), originHashHex("https://yourdomain.xyz")]
});
const data = buildAttestData(commitment, 1n);
const assertion = await signAssertion({
  challenge: deriveSingleChallenge({ account, chainId: 10143n, nonce: 0n,
    to: monadTestnet.provenanceRegistry, value: 0n, data }),
  rpId: "yourdomain.xyz", credentialId: cred.credentialId
});
// → submit P256PasskeyAccount.execute(to, 0, data, assertion) from ANY relayer
```

Run the bundled examples: `npx tsx sdk/examples/read-schemes.ts`.

---

## Gas sponsorship (relayer) — what it is and its boundaries

The demo app ships a **relayer** at `web/app/api/relay` so a passkey user with **zero MON** can still
transact. Its guardrails (so it can't be abused):

- **Testnet only** (chainId `10143`); `value` is always **0**; target allowlist (our 4 contracts + the
  account's own `addKey`); global + per-account daily caps; **simulate before submit**.

Because the signature binds the calldata, a relayer is a pure gas payer — it cannot redirect funds or
change arguments. To integrate, either run your own relayer, use a paymaster, or require the user to
hold a little MON. See `docs/SECURITY.md` for the trust model.

---

## Post-event integration plan

Traction today is **self-served only** (no third-party integration yet — stated honestly). Concretely:

1. **Ship the kit** (done): publish `@designerhub/sdk` + this guide + runnable examples.
2. **Land one integrator during the event**: 云筑家 App is the first-party integrator (already exports
   the scheme JSON); recruit **one external team** (a design tool, an asset library, or an AI-agent
   platform) to mint/attest through the SDK — even a read-only integration counts.
3. **Post-event**: open a small integration-bounty / "built on Designer Hub" track, add a
   `builtWith` registry, and host the app (demo URL + recorded video).
4. **Follow-ups**: meter/paid relayer, per-agent analytics on `AgentRegistry`, and an EIP draft for
   the commitment+lineage pattern.
