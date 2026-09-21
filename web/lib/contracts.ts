import { useQuery } from "@tanstack/react-query";
import {
  createPublicClient,
  getAddress,
  http,
  parseEther,
  type Address,
  type Hex,
  type PublicClient
} from "viem";
import { usePublicClient } from "wagmi";
import { dreamSchemeAbi, schemeMarketAbi, schemeMintedEvent } from "./abis";
import { monadTestnet } from "./chains";
import { fetchUriJson } from "./ipfs";

export function dreamSchemeAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_DREAMSCHEME_ADDRESS;
  if (!raw) return undefined;
  try {
    return getAddress(raw);
  } catch {
    return undefined;
  }
}

export function schemeMarketAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_SCHEME_MARKET_ADDRESS;
  if (!raw) return undefined;
  try {
    return getAddress(raw);
  } catch {
    return undefined;
  }
}

/** 单次「应用到我家」的价格（wei），默认 0.01 MON。 */
export const APPLY_PRICE: bigint = parseEther(
  process.env.NEXT_PUBLIC_APPLY_PRICE_ETH || "0.01"
);

export interface SchemeSummary {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  remixCount: number;
  appliedCount: number;
  tokenUri: string;
  schemeUri: string;
  name: string;
  description: string;
  image: string;
  theme: string;
  roomType: string;
  furnitureCount: number;
  createdAt: number;
}

interface SchemeOnChain {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  remixCount: number;
  appliedCount: number;
  tokenUri: string;
  createdAt: number;
}

let _publicClient: PublicClient | undefined;

/** 独立的只读 viem 客户端（不依赖 wagmi 配置，供页面与 seed 共用）。 */
export function publicClientFor(): PublicClient | undefined {
  try {
    if (!_publicClient) {
      _publicClient = createPublicClient({
        chain: monadTestnet,
        transport: http(monadTestnet.rpcUrls.default.http[0])
      });
    }
    return _publicClient;
  } catch {
    return undefined;
  }
}

async function readSchemeOnChain(
  client: PublicClient,
  addr: Address,
  marketAddr: Address | undefined,
  tokenId: bigint
): Promise<SchemeOnChain> {
  const [uri, createdAt, remixCount, creator, parentId, contentHash] = await client.multicall({
    contracts: [
      { address: addr, abi: dreamSchemeAbi, functionName: "tokenURI", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "createdAtOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "remixCount", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "creatorOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "parentOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "contentHashOf", args: [tokenId] }
    ]
  });

  if (uri.error || createdAt.error || remixCount.error || creator.error || parentId.error || contentHash.error) {
    throw new Error(`链上读取失败：tokenId=${tokenId.toString()}`);
  }

  let appliedCount = 0;
  if (marketAddr) {
    try {
      const count = await client.readContract({
        address: marketAddr,
        abi: schemeMarketAbi,
        functionName: "appliedCount",
        args: [tokenId]
      });
      appliedCount = Number(count);
    } catch {
      appliedCount = 0;
    }
  }

  return {
    tokenId,
    creator: creator.result as Address,
    parentId: parentId.result as bigint,
    contentHash: contentHash.result as Hex,
    remixCount: Number(remixCount.result ?? 0),
    appliedCount,
    tokenUri: uri.result as string,
    createdAt: Number(createdAt.result ?? 0)
  };
}

async function attachMetadata(state: SchemeOnChain): Promise<SchemeSummary> {
  let meta: Record<string, any> | null = null;
  try {
    meta = await fetchUriJson(state.tokenUri);
  } catch {
    meta = null;
  }
  const scheme = meta?.scheme ?? {};
  const attrs: Array<{ trait_type: string; value: string | number }> = Array.isArray(meta?.attributes)
    ? meta.attributes
    : [];

  return {
    ...state,
    name: meta?.name || `方案 #${state.tokenId}`,
    description: meta?.description || "",
    image: meta?.image || "",
    schemeUri: meta?.properties?.schemeUri || "",
    theme:
      scheme?.style?.theme ||
      attrs.find((a) => a.trait_type === "主题")?.value ||
      "未知风格",
    roomType: scheme?.room?.type || attrs.find((a) => a.trait_type === "房间")?.value || "房间",
    furnitureCount: Array.isArray(scheme?.furniture) ? scheme.furniture.length : Number(attrs.find((a) => a.trait_type === "家具数量")?.value ?? 0)
  };
}

/** 通过 SchemeMinted 事件 + IPFS 元数据读取全部方案。 */
export async function fetchAllSchemes(client: PublicClient): Promise<SchemeSummary[]> {
  const addr = dreamSchemeAddress();
  if (!addr) return [];
  const marketAddr = schemeMarketAddress();

  const logs = await client.getLogs({
    address: addr,
    event: schemeMintedEvent,
    fromBlock: 0n,
    toBlock: "latest"
  });
  const ids = (logs as Array<{ args: { tokenId?: bigint } }>)
    .map((l) => l.args.tokenId)
    .filter((v): v is bigint => v !== undefined)
    .slice(-200);

  const onChain = await Promise.all(ids.map((id) => readSchemeOnChain(client, addr, marketAddr, id)));
  const results = await Promise.allSettled(onChain.map((s) => attachMetadata(s)));
  return results
    .filter((r): r is PromiseFulfilledResult<SchemeSummary> => r.status === "fulfilled")
    .map((r) => r.value)
    .sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1));
}

export function useSchemes() {
  const client = usePublicClient();
  const addr = dreamSchemeAddress();
  return useQuery({
    queryKey: ["schemes", addr ?? "none"],
    queryFn: async () => {
      const c = client ?? publicClientFor();
      if (!c) return [];
      return fetchAllSchemes(c);
    },
    enabled: Boolean(client) && Boolean(addr),
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: 1
  });
}

export interface SchemeDetail extends SchemeSummary {
  lineage: bigint[];
  versionLine: bigint[];
  children: bigint[];
  totalSupply: number;
}

export async function fetchSchemeDetail(client: PublicClient, tokenId: bigint): Promise<SchemeDetail> {
  const addr = dreamSchemeAddress();
  if (!addr) throw new Error("未配置 DREAMSCHEME 合约地址");
  const marketAddr = schemeMarketAddress();

  const base = await readSchemeOnChain(client, addr, marketAddr, tokenId);
  const [lineage, versionLine, children, totalSupply] = await client.multicall({
    contracts: [
      { address: addr, abi: dreamSchemeAbi, functionName: "lineageOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "versionLineOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "childrenOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "totalSupply", args: [] }
    ]
  });
  const summary = await attachMetadata(base);
  return {
    ...summary,
    lineage: (lineage.result as bigint[]) ?? [],
    versionLine: (versionLine.result as bigint[]) ?? [],
    children: (children.result as bigint[]) ?? [],
    totalSupply: Number(totalSupply.result ?? 0)
  };
}

export function useSchemeDetail(tokenId: bigint | undefined) {
  const client = usePublicClient();
  return useQuery({
    queryKey: ["scheme-detail", tokenId?.toString(), dreamSchemeAddress()],
    queryFn: async () => {
      if (!tokenId || !client) throw new Error("no token");
      return fetchSchemeDetail(client, tokenId);
    },
    enabled: Boolean(tokenId) && Boolean(client) && Boolean(dreamSchemeAddress())
  });
}
