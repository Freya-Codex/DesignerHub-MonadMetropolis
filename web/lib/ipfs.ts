/**
  * Convert ipfs:// and local:// uniformly into a front-end-loadable URL.
  * - ipfs:// goes through a public gateway
  * - local:// goes through local demo mode (/api/cid, for local dev without a Pinata key)
 */
export function ipfsGateway(): string {
  const g = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://ipfs.io/ipfs/";
  return g.endsWith("/") ? g : `${g}/`;
}

export function toHttpUrl(uri: string): string {
  if (!uri) return "";
  if (uri.startsWith("local://")) {
    return `/api/cid/${encodeURIComponent(uri.slice("local://".length))}`;
  }
  if (uri.startsWith("ipfs://")) {
    return `${ipfsGateway()}${uri.slice("ipfs://".length)}`;
  }
  if (uri.startsWith("data:")) return uri;
  if (uri.startsWith("/") || uri.startsWith("http://") || uri.startsWith("https://")) return uri;
  return `${ipfsGateway()}${uri}`;
}

export async function fetchUriJson(uri: string): Promise<Record<string, any>> {
  const res = await fetch(toHttpUrl(uri), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`fetch metadata failed (${res.status}): ${uri}`);
  }
  return (await res.json()) as Record<string, any>;
}
