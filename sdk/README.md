# @yunzhujia/sdk

Typed client for the **Designer Hub** on-chain primitive on Monad Testnet.

It packages the three reusable primitives so you don't have to re-implement the cryptography or
re-declare the ABIs:

1. **Passkey (WebAuthn / P-256) smart accounts** — mnemonic-free identity. The key lives in the
   device secure element; the account address is deterministic via CREATE2; a relayer can pay gas
   without being able to tamper with the call (the signature binds the exact calldata + nonce).
2. **Provenance attestation** — commit `keccak256(contentHash ‖ salt)` on-chain without revealing
   the content, with a timestamp and an AI-agent id.
3. **Remixable design-scheme assets** — ERC-721 with on-chain lineage and **instant** revenue split
   on every use (no platform vault, no `withdraw()`).

> **Status:** not published to npm yet (`publishConfig.access = public` is set and the package
> builds, but `npm publish` is intentionally deferred — see the repo README).

## Install

```bash
npm i @yunzhujia/sdk viem
```

`viem` (>= 2) is a peer dependency.

## Quickstart — read schemes (no wallet, no API key)

```ts
import { publicClient, readTotalSupply, readScheme } from "@yunzhujia/sdk";

const client = publicClient(); // Monad Testnet, https://testnet-rpc.monad.xyz
const total = await readTotalSupply(client);
const scheme = await readScheme(client, total);
console.log(scheme.creator, scheme.parentId, scheme.remixCount, scheme.priceWei);
```

## Quickstart — passkey account (browser)

```ts
import {
  createPasskey, signAssertion, rpIdHashHex, originHashHex,
  deriveSingleChallenge, buildAttestData, passkeyFactoryAbi, publicClient,
  monadTestnet, KIMI_AGENT_ID
} from "@yunzhujia/sdk";

const RP_ID = "designerhub.xyz";          // your registrable domain
const ORIGIN = "https://designerhub.xyz";

// 1. create passkey → public key (x, y), never a private key
const cred = await createPasskey({ rpId: RP_ID });

// 2. deterministic account address
const account = await publicClient().readContract({
  address: monadTestnet.passkeyAccountFactory,
  abi: passkeyFactoryAbi,
  functionName: "accountOf",
  args: [BigInt(cred.x), BigInt(cred.y), rpIdHashHex(RP_ID), originHashHex(ORIGIN)]
});

// 3. build the inner call you want the account to make
const innerData = buildAttestData(/* commitment */ "0x…", KIMI_AGENT_ID);

// 4. sign the challenge derived from that exact call
const assertion = await signAssertion({
  challenge: deriveSingleChallenge({ account, chainId: 10143n, nonce: 0n, to: monadTestnet.provenanceRegistry, value: 0n, data: innerData }),
  rpId: RP_ID,
  credentialId: cred.credentialId
});

// 5. any relayer can now submit `P256PasskeyAccount.execute(to, 0, innerData, assertion)`
```

See `examples/` for runnable code (`npx tsx examples/read-schemes.ts`).

## API surface

| Export | Purpose |
| --- | --- |
| `monadTestnet`, `monadTestnetV1` (deprecated) | deployed addresses + chainId/RPC/explorer |
| `monadTestnetChain`, `publicClient(rpc?)` | viem chain + read client |
| `dreamSchemeAbi` / `schemeMarketAbi` / `agentRegistryAbi` / `provenanceRegistryAbi` / `passkeyAccountAbi` / `passkeyFactoryAbi` | contract ABIs (JSON where tuples are involved) |
| `buildMintData` / `buildRemixData` / `buildSetPriceData` / `buildApplySchemeData` / `buildAttestData` / `buildAddKeyData` / `buildExecuteData` / `buildCommitment` | pure calldata builders (work for EOA and passkey-account flows) |
| `readScheme` / `readSplitPreview` / `readTotalSupply` / `verifyProvenance` / `readAccountNonce` | typed read helpers |
| `mintScheme` / `setSchemePrice` / `applyScheme` | wallet-client write helpers |
| `createPasskey` / `signAssertion` / `derToRS` / `b64urlEncode` / `b64urlDecode` | browser WebAuthn / P-256 |
| `rpIdHashHex` / `originHashHex` / `deriveSingleChallenge` / `deriveBatchChallenge` | contract-mirroring derivation |
| `KIMI_AGENT_ID` | the pre-registered Kimi agent id (1) |

## Contract addresses (Monad Testnet · chainId 10143)

| Contract | Address |
| --- | --- |
| DreamScheme | `0x2541eB7A4AC7bb5287A5944452576f983b3dc3eB` |
| SchemeMarket | `0xD89a267605B7c3Ee9B172aB58b735686b3b0DC64` |
| AgentRegistry | `0x9EB3d5C336c66823577F4FBB1E31dbABcf7c268D` |
| ProvenanceRegistry | `0xCe41D2fa11fC3944662b783ac895D3380B8B09ED` |
| PasskeyAccountFactory | `0x41E72cc140b30891b34Da45f3ed55a525c758C76` |

## Notes on the challenge / key derivation

- `rpIdHash = sha256(utf8(rpId))`, `originHash = keccak256(utf8(origin))` (`bytes32(0)` disables the origin check).
- Single challenge: `keccak256(abi.encodePacked("dh/passkey/tx", account, chainId, nonce, to, value, keccak256(data)))`.
- Batch challenge: `keccak256(abi.encodePacked("dh/passkey/batch", account, chainId, nonce, keccak256(abi.encode(to, value, dataHashes))))`.
- The address is bound to `(x, y, rpIdHash, originHash)` — a different domain or port yields a different account.
- Up to **4 keys per account** (`addKey`) for multi-device recovery.

These match `contracts/src/lib/{P256,WebAuthn}.sol` and `P256PasskeyAccount.sol` exactly; the challenge
vectors are cross-checked against the Foundry fixtures.

## Build

```bash
npm run build       # tsc → dist/
npm run typecheck
```

## License

MIT
