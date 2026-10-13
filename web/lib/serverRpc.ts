import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { monadTestnet } from "./chains";

/**
  * Server-side RPC providers (Alchemy first, Envio HyperRPC next, public RPC auto-fallback).
 *
  * WARNING: server-side only:
  *   - the ALCHEMY_API_KEY / ENVIO_API_TOKEN read here have no NEXT_PUBLIC_ prefix,
  *     so Next.js does not inline them into the front-end bundle;
  *   - the front end (wagmi / publicClientFor / events.ts tail scan) keeps using the public RPC, ensuring "zero keys in the front end".
 *
  * Any server-side chain read (relay, offline index, activity aggregation) should take its transport from here,
  * rather than using monadTestnet.rpcUrls.default.http[0] directly.
 *
  * Envio HyperRPC (https://monad-testnet.rpc.hypersync.xyz) is a read-only high-throughput RPC that Envio
  * designed for data-intensive reads; it is enabled only when ENVIO_API_TOKEN is configured, as one link in the fallback chain,
  * and failures auto-degrade to the public RPC.
 */

const PUBLIC_RPC = monadTestnet.rpcUrls.default.http[0];

function alchemyHost(): string {
  return (process.env.ALCHEMY_MONAD_HOST || "https://monad-testnet.g.alchemy.com/v2").replace(/\/+$/, "");
}

export function alchemyApiKey(): string | undefined {
  const k = process.env.ALCHEMY_API_KEY?.trim();
  return k || undefined;
}

/** The resolved Alchemy RPC URL (undefined when there is no Key and no explicit URL). */
export function alchemyRpcUrl(): string | undefined {
  const explicit = process.env.ALCHEMY_RPC_URL?.trim();
  if (explicit) return explicit;
  const key = alchemyApiKey();
  return key ? `${alchemyHost()}/${key}` : undefined;
}

/** Whether Alchemy is configured (server side). */
export function usingAlchemy(): boolean {
  return Boolean(alchemyRpcUrl());
}

/** Whether Envio HyperRPC is configured (server side). */
export function usingHyperRpc(): boolean {
  return Boolean(envioHyperRpcUrl());
}

/** The resolved Envio HyperRPC URL (undefined when there is no token). */
export function envioHyperRpcUrl(): string | undefined {
  const token = process.env.ENVIO_API_TOKEN?.trim();
  if (!token) return undefined;
  const base = (
    process.env.ENVIO_HYPERRPC_URL?.trim() || "https://monad-testnet.rpc.hypersync.xyz"
  ).replace(/\/+$/, "");
  return base;
}

/** The current preferred server RPC (Alchemy if available, otherwise the public RPC). */
export function serverRpcUrl(): string {
  return alchemyRpcUrl() ?? PUBLIC_RPC;
}

/** An RPC label safe to write into logs/API responses (hides the API Key). */
export function safeRpcLabel(): string {
  const url = alchemyRpcUrl();
  if (url) return url.replace(/\/v2\/.+$/, "/v2/***");
  if (usingHyperRpc()) return "envio-hyperrpc (monad-testnet.rpc.hypersync.xyz)";
  return PUBLIC_RPC;
}

/**
  * Server transport: Alchemy first -> Envio HyperRPC -> public RPC; any layer's failure auto-falls back.
  * This way the site does not go down entirely even if a provider does not support the network / is temporarily rate-limited.
 */
export function serverTransport() {
  const transports = [];
  const alch = alchemyRpcUrl();
  if (alch) transports.push(http(alch));
  const hyper = envioHyperRpcUrl();
  if (hyper) {
    transports.push(
      http(hyper, {
        fetchOptions: {
          headers: { Authorization: `Bearer ${process.env.ENVIO_API_TOKEN!.trim()}` }
        }
      })
    );
  }
  transports.push(http(PUBLIC_RPC));
  // Use it directly when there is only one layer (avoids wrapping one extra fallback).
  return transports.length === 1 ? transports[0] : fallback(transports, { rank: false });
}

let _client: PublicClient | undefined;

/** Server-side read-only viem client (Alchemy first + public-RPC fallback). */
export function serverPublicClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({ chain: monadTestnet, transport: serverTransport() });
  }
  return _client;
}
