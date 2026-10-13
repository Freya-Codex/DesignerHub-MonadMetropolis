# Alchemy integration notes (server-side data layer)

Designer Hub uses Alchemy as a **server-side data layer**: RPC (chain reads / indexing) and Webhooks
(event push). **The front end stays key-free** — all Alchemy access happens in Next.js server routes or
scripts.

## Why it lives on the server

- `NEXT_PUBLIC_*` is inlined into the front-end bundle → effectively public. So the Alchemy key is used
  **only as `ALCHEMY_API_KEY`** (no prefix).
- The front end (wagmi / `publicClientFor` / browser tail scan) continues to use the public RPC
  `https://testnet-rpc.monad.xyz`, keeping the "single file, dependency-free, zero key" public story.
- The server obtains its transport uniformly through `web/lib/serverRpc.ts`: **Alchemy first, public RPC
  auto-fallback** (viem `fallback`), so the site does not go down even if Alchemy has not enabled the
  network or is temporarily rate-limited.

## Environment variables (`web/.env.example`)

| Variable | Purpose |
| --- | --- |
| `ALCHEMY_API_KEY` | Alchemy API key (**server-side only**, do not add `NEXT_PUBLIC_`): `https://monad-testnet.g.alchemy.com/v2/<key>` |
| `ALCHEMY_RPC_URL` | Optional, set the RPC URL directly (takes precedence over the key concatenation above) |
| `ALCHEMY_MONAD_HOST` | Optional, override the host prefix (default `https://monad-testnet.g.alchemy.com/v2`) |
| `ALCHEMY_WEBHOOK_SIGNING_KEY` | Optional, Alchemy webhook signing key (when set, callback signatures are enforced) |

> ⚠️ On first use you must **enable the MONAD_TESTNET network** in the corresponding App in the Alchemy
> Dashboard, otherwise it returns `MONAD_TESTNET is not enabled for this app` (in which case it falls back
> to the public RPC automatically).

## Code points

- `web/lib/serverRpc.ts` — `serverRpcUrl() / serverTransport() / serverPublicClient() / usingAlchemy()`; the key is read only here.
- `web/app/api/relay/route.ts` — the sponsoring relayer's server node goes through `serverTransport()`; `GET` returns `rpcProvider / rpcLabel`.
- `web/scripts/index-activity.ts` — the offline indexer goes through `serverTransport()`; with Alchemy the shard size scales up automatically (default 2000 blocks vs. 100 for the public RPC).
- `web/app/api/alchemy/webhook/route.ts` — Alchemy Address Activity receiver: verifies `X-Alchemy-Signature` (HMAC-SHA256),
  decodes `SchemeMinted` / `SchemeApplied`, and appends incrementally to `data/activity-webhooks.json` (runtime, gitignored).
- `web/app/api/activity/route.ts` — merges the offline index `data/activity.json` with the webhook increment `data/activity-webhooks.json`.

## Webhook setup

1. Alchemy Dashboard → Webhooks → create an **Address Activity** webhook, network Monad Testnet,
   addresses = the five contracts (DreamScheme / SchemeMarket / AgentRegistry / ProvenanceRegistry / PasskeyAccountFactory).
2. Callback URL: `https://<your-domain>/api/alchemy/webhook`.
3. Copy the Signing Key into `ALCHEMY_WEBHOOK_SIGNING_KEY` (if left empty, signatures are not verified — for local testing only).

## Offline indexing (optional)

```bash
cd web
npm run index                 # head 20000 + tail 20000 blocks
INDEX_FULL=1 npm run index    # deploy block → latest block (most complete)
```

With Alchemy it automatically uses a larger `eth_getLogs` range, cutting request count and time significantly.

## Security boundary

- The Alchemy key lives only in `web/.env.local` (gitignored), **never committed and never shipped to the front end**.
- Once the signing key is configured, unsigned or incorrectly-signed requests to the webhook receiver are always `401`.
