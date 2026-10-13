# Envio HyperIndex — Designer Hub · Monad

Indexes the on-chain events of Designer Hub's five contracts into queryable entities and exposes a
GraphQL endpoint that **powers the front end's core data features** (not a "install it and forget it"
dependency).

## What it powers

| Front-end feature | Data source | Events |
|---|---|---|
| `/trades` trade ledger | `Trade` entity | `SchemeApplied` |
| `/scheme/[id]` scheme detail + lineage | `Scheme` entity (by `parentId`) | `SchemeMinted`, `RoyaltySet` |
| Derivative split receipts | `AncestorPayout` | `AncestorPaid` |
| `/board` agent reputation board | `Agent`, `ReputationEvent` | `AgentRegistered`, `ReputationAdded` |
| On-chain attestation records | `Attestation` | `Attested` |

## Why it's needed (instead of querying RPC directly)

Monad's public testnet RPC caps `eth_getLogs` at **100 blocks**, while the span from the deploy block
`66892530` to the latest block is already **tens of millions of blocks**. If the front end or scripts
scanned the full history themselves it would take tens of thousands of requests — slow and easy to miss
(the current `index-activity.ts` offline sharding exists for exactly this reason). Envio **HyperSync**
handles historical backfill and **HyperIndex** turns events into entities, so the front end only queries
GraphQL.

## Quick start

```bash
cd envio
pnpm install          # or npm install
pnpm codegen          # generate types from config.yaml + schema.graphql
cp .env.example .env  # set ENVIO_API_TOKEN (from the Envio Cloud console)
pnpm dev              # run the local indexer + GraphQL (default http://localhost:8080)
```

Deploy to Envio Cloud (recommended — gives reviewers a hosted endpoint):

```bash
pnpm dlx envio@latest deploy
```

## Network

- **Monad Testnet**, chainId `10143`, start_block `66892530`
- Contract addresses are in `config.yaml` (consistent with `contracts/deployments/monad-testnet.json`)

## Relationship to the front end / Alchemy

- **Envio** = read path / index layer: GraphQL drives `/trades`, `/scheme/[id]`, `/board`.
- **Alchemy** (`web/lib/serverRpc.ts`) = write path / RPC channel: relay sponsorship, fallback transport.
- The front end keeps a public-RPC fallback: even if Envio is not deployed, the site does not go blank.
- The index endpoint is read-only and key-free, honoring the repo's "no secrets in repo" rule.
