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
import { dreamSchemeAbi, dreamSchemeDupAbi, schemeMarketAbi } from "./abis";
import { monadTestnet } from "./chains";
import { fetchUriJson } from "./ipfs";
import { L } from "./langStore";

export function dreamSchemeAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_DREAM_SCHEME_ADDRESS;
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

/** 单次「应用到我家」的默认展示价（wei）。真实价格以链上 priceOf(tokenId) 为准。 */
export const APPLY_PRICE: bigint = parseEther(
  process.env.NEXT_PUBLIC_APPLY_PRICE_ETH || "0.01"
);

/**
 * 内容唯一性守卫：查询某内容哈希是否已被铸造。
 * 返回首个铸造该内容的 tokenId（0n = 尚未铸造）。链上读取失败时容错返回 0n。
 * 仅用于原创路径（parentId = 0）的去重；remix 允许内容重复。
 */
export async function mintedTokenForContentHash(contentHash: Hex): Promise<bigint> {
  const addr = dreamSchemeAddress();
  if (!addr) return 0n;
  const client = publicClientFor();
  if (!client) return 0n;
  try {
    return await client.readContract({
      address: addr,
      abi: dreamSchemeDupAbi,
      functionName: "hashToTokenId",
      args: [contentHash]
    });
  } catch {
    return 0n;
  }
}

/** AgentRegistry 地址（可选，用于 AI 署名展示）。 */
export function agentRegistryAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS;
  return raw ? maybeAddress(raw) : undefined;
}

/** ProvenanceRegistry 地址（可选，生成过程存证）。 */
export function provenanceRegistryAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS;
  return raw ? maybeAddress(raw) : undefined;
}

/** PasskeyAccountFactory 地址（可选，无助记词账户）。 */
export function passkeyFactoryAddress(): Address | undefined {
  const raw = process.env.NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS;
  return raw ? maybeAddress(raw) : undefined;
}

function maybeAddress(raw: string): Address | undefined {
  try {
    return getAddress(raw);
  } catch {
    return undefined;
  }
}

export interface SchemeSummary {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  agentId: bigint;
  remixCount: number;
  appliedCount: number;
  price: bigint;
  payout: Address;
  tokenUri: string;
  schemeUri: string;
  name: string;
  description: string;
  image: string;
  theme: string;
  roomType: string;
  furnitureCount: number;
  createdAt: number;
  /** 方案的 AI 生成器（provider + 模型名），随方案 JSON 导入；旧数据可能为空。 */
  generator?: { provider?: string; model?: string; at?: string };
  // 双语展示用（仅站点自带示例数据提供；链上/IPFS 内容仍以原语言为准）
  nameEn?: string;
  descriptionEn?: string;
  themeEn?: string;
  roomTypeEn?: string;
}

interface SchemeOnChain {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  agentId: bigint;
  remixCount: number;
  appliedCount: number;
  price: bigint; // 0 = 未上架（创作者尚未 setPrice）
  payout: Address; // 0x0 = 默认（收益付给 creator）
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
  const [uri, createdAt, remixCount, creator, parentId, contentHash, agentId] = await client.multicall({
    contracts: [
      { address: addr, abi: dreamSchemeAbi, functionName: "tokenURI", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "createdAtOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "remixCount", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "creatorOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "parentOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "contentHashOf", args: [tokenId] },
      { address: addr, abi: dreamSchemeAbi, functionName: "agentIdOf", args: [tokenId] }
    ]
  });

  if (
    uri.error ||
    createdAt.error ||
    remixCount.error ||
    creator.error ||
    parentId.error ||
    contentHash.error ||
    agentId.error
  ) {
    throw new Error(L(`链上读取失败：tokenId=${tokenId.toString()}`, `On-chain read failed: tokenId=${tokenId.toString()}`));
  }

  let appliedCount = 0;
  let price = 0n;
  let payout: Address = "0x0000000000000000000000000000000000000000";
  if (marketAddr) {
    try {
      const [count, p, po] = await client.multicall({
        contracts: [
          { address: marketAddr, abi: schemeMarketAbi, functionName: "appliedCount", args: [tokenId] },
          { address: marketAddr, abi: schemeMarketAbi, functionName: "priceOf", args: [tokenId] },
          { address: marketAddr, abi: schemeMarketAbi, functionName: "payoutOf", args: [tokenId] }
        ]
      });
      appliedCount = Number(count.result ?? 0);
      price = (p.result as bigint) ?? 0n;
      payout = (po.result as Address) ?? payout;
    } catch {
      appliedCount = 0;
      price = 0n;
    }
  }

  return {
    tokenId,
    creator: creator.result as Address,
    parentId: parentId.result as bigint,
    contentHash: contentHash.result as Hex,
    agentId: agentId.result as bigint,
    remixCount: Number(remixCount.result ?? 0),
    appliedCount,
    price,
    payout,
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
    name: meta?.name || L(`方案 #${state.tokenId}`, `Scheme #${state.tokenId}`),
    nameEn: (meta as any)?.nameEn || (scheme as any)?.nameEn || undefined,
    description: meta?.description || "",
    descriptionEn: (meta as any)?.descriptionEn || (scheme as any)?.descriptionEn || undefined,
    image: meta?.image || "",
    schemeUri: meta?.properties?.schemeUri || "",
    theme:
      scheme?.style?.theme ||
      attrs.find((a) => a.trait_type === "主题")?.value ||
      L("未知风格", "Unknown style"),
    themeEn: (scheme as any)?.style?.themeEn || undefined,
    roomType:
      scheme?.room?.type || attrs.find((a) => a.trait_type === "房间")?.value || L("房间", "Room"),
    roomTypeEn: (scheme as any)?.room?.typeEn || undefined,
    furnitureCount: Array.isArray(scheme?.furniture) ? scheme.furniture.length : Number(attrs.find((a) => a.trait_type === "家具数量")?.value ?? 0),
    generator: (scheme as any)?.generator ?? (meta as any)?.properties?.generator ?? undefined
  };
}

/**
 * 读取全部方案（链上状态 + IPFS 元数据）。
 *
 * 注意：Monad 测试网公共 RPC 把 eth_getLogs 限制在 100 个区块内，
 * 无法用它扫描「从 0 到 latest」的全部铸造事件。由于 DreamScheme 的
 * tokenId 由 `++_nextTokenId` 连续自增、`totalSupply()` 即当前最大 id，
 * 这里改为按 totalSupply() 枚举 tokenId 逐个读取状态，既不受区块范围限制，
 * 也避免了海量日志扫描。
 */
export async function fetchAllSchemes(client: PublicClient): Promise<SchemeSummary[]> {
  const addr = dreamSchemeAddress();
  if (!addr) return [];
  const marketAddr = schemeMarketAddress();

  const total = await client.readContract({
    address: addr,
    abi: dreamSchemeAbi,
    functionName: "totalSupply"
  });
  const count = Number(total);
  if (!Number.isFinite(count) || count <= 0) return [];

  const ids = Array.from({ length: Math.min(count, 200) }, (_, i) => BigInt(i + 1));
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
  if (!addr) throw new Error(L("未配置 DreamScheme 合约地址", "DreamScheme contract address is not configured"));
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
