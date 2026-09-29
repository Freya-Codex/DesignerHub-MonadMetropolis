/**
 * 链上事件聚合：SchemeMinted（铸造）与 SchemeApplied（应用/付费）流水。
 * 供 /mint（铸造中心）与 /trades（交易记录）复用。
 *
 * 数据来源（两路合并、按 txHash+logIndex 去重）：
 *  1) 离线索引 web/data/activity.json —— scripts/index-activity.ts 生成，经 /api/activity 读取。
 *     因为 Monad 公共 RPC 的 eth_getLogs 上限 100 区块，浏览器无法扫完
 *     部署块 → 最新块（百万级区块）的全部历史，故由脚本离线扫描落盘。
 *  2) 浏览器端「尾部窗口」实时扫描 —— 只扫最近 N 个区块，用于展示刚刚发生的活动。
 */
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { schemeAppliedEvent, schemeMintedEvent } from "./abis";
import { virtuHomeSchemeAddress, publicClientFor, schemeMarketAddress } from "./contracts";

export interface MintRecord {
  tokenId: bigint;
  creator: Address;
  parentId: bigint;
  contentHash: Hex;
  blockNumber: bigint;
}

export interface TradeRecord {
  tokenId: bigint;
  applier: Address;
  creator: Address;
  value: bigint;
  creatorShare: bigint;
  platformShare: bigint;
  blockNumber: bigint;
  txHash: Hex;
  logIndex: number;
}

export interface ChainActivity {
  mints: MintRecord[];
  trades: TradeRecord[];
}

export interface ActivityResult extends ChainActivity {
  /** 是否已读到离线索引（false 表示仅有尾部实时扫描，历史可能不完整）。 */
  indexed: boolean;
  generatedAt?: string;
}

/**
 * Monad 测试网公共 RPC 把 eth_getLogs 限制在 100 个区块内（超出返回 -32614），
 * 因此所有日志查询都要按 100 区块分片。
 */
const LOG_CHUNK = 100n;

/** 尾部实时扫描的区块跨度（默认 2000，约 20 个请求），仅用于捕获刚发生的活动。 */
const TAIL_SCAN_BLOCKS = BigInt(process.env.NEXT_PUBLIC_TAIL_SCAN_BLOCKS || "2000");

/** 每次并发请求数，避免打爆公共 RPC。 */
const CONCURRENCY = 8;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** 把 [from, to] 切成 100 区块的分片并按批并发请求（含指数退避重试）。 */
async function getLogsChunked(
  client: PublicClient,
  address: Address,
  event: any,
  from: bigint,
  to: bigint
): Promise<any[]> {
  const ranges: Array<[bigint, bigint]> = [];
  let start = from;
  while (start <= to) {
    const end = start + LOG_CHUNK - 1n > to ? to : start + LOG_CHUNK - 1n;
    ranges.push([start, end]);
    start = end + 1n;
  }

  const one = async ([f, t]: [bigint, bigint]): Promise<any[]> => {
    for (let attempt = 0; attempt < 5; attempt++) {
      try {
        return await client.getLogs({ address, event, fromBlock: f, toBlock: t });
      } catch {
        await sleep(Math.min(1500, 120 * 2 ** attempt));
      }
    }
    return [];
  };

  const out: any[] = [];
  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = ranges.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(batch.map(one));
    for (const logs of settled) out.push(...logs);
  }
  return out;
}

/** 尾部窗口实时扫描：只覆盖最近 TAIL_SCAN_BLOCKS 个区块，快速且不会超限。 */
export async function fetchTailActivity(client: PublicClient): Promise<ChainActivity> {
  const dream = virtuHomeSchemeAddress();
  const market = schemeMarketAddress();
  if (!dream && !market) return { mints: [], trades: [] };

  const latest = await client.getBlockNumber();
  const from = latest > TAIL_SCAN_BLOCKS ? latest - TAIL_SCAN_BLOCKS : 0n;

  const [mints, trades] = await Promise.all([
    dream
      ? getLogsChunked(client, dream, schemeMintedEvent, from, latest)
          .then((logs) =>
            logs.map((l) => ({
              tokenId: l.args.tokenId as bigint,
              creator: l.args.creator as Address,
              parentId: l.args.parentId as bigint,
              contentHash: l.args.contentHash as Hex,
              blockNumber: l.blockNumber ?? 0n
            }))
          )
          .catch(() => [] as MintRecord[])
      : Promise.resolve([] as MintRecord[]),
    market
      ? getLogsChunked(client, market, schemeAppliedEvent, from, latest)
          .then((logs) =>
            logs.map((l) => ({
              tokenId: l.args.tokenId as bigint,
              applier: l.args.applier as Address,
              creator: l.args.creator as Address,
              value: l.args.value as bigint,
              creatorShare: l.args.creatorShare as bigint,
              platformShare: l.args.platformShare as bigint,
              blockNumber: l.blockNumber ?? 0n,
              txHash: l.transactionHash as Hex,
              logIndex: l.logIndex
            }))
          )
          .catch(() => [] as TradeRecord[])
      : Promise.resolve([] as TradeRecord[])
  ]);

  return { mints, trades };
}

/** 读取离线索引（/api/activity）。索引不存在时返回空集合。 */
export async function fetchIndexedActivity(): Promise<ActivityResult> {
  try {
    const res = await fetch("/api/activity", { cache: "no-store" });
    if (!res.ok) return { indexed: false, mints: [], trades: [] };
    const data = (await res.json()) as any;
    const mints: MintRecord[] = (data.mints ?? []).map((m: any) => ({
      tokenId: BigInt(m.tokenId),
      creator: m.creator as Address,
      parentId: BigInt(m.parentId),
      contentHash: m.contentHash as Hex,
      blockNumber: BigInt(m.blockNumber)
    }));
    const trades: TradeRecord[] = (data.trades ?? []).map((t: any) => ({
      tokenId: BigInt(t.tokenId),
      applier: t.applier as Address,
      creator: t.creator as Address,
      value: BigInt(t.value),
      creatorShare: BigInt(t.creatorShare),
      platformShare: BigInt(t.platformShare),
      blockNumber: BigInt(t.blockNumber),
      txHash: t.txHash as Hex,
      logIndex: Number(t.logIndex)
    }));
    return { indexed: Boolean(data.indexed), generatedAt: data.generatedAt, mints, trades };
  } catch {
    return { indexed: false, mints: [], trades: [] };
  }
}

const tradeKey = (t: TradeRecord) => `${t.txHash}:${t.logIndex}`;

/** 合并离线索引与尾部实时扫描结果（去重，索引优先）。 */
function mergeActivity(indexed: ActivityResult, tail: ChainActivity): ActivityResult {
  const tradeMap = new Map<string, TradeRecord>();
  for (const t of [...indexed.trades, ...tail.trades]) tradeMap.set(tradeKey(t), t);
  const mintMap = new Map<string, MintRecord>();
  for (const m of [...indexed.mints, ...tail.mints]) mintMap.set(m.tokenId.toString(), m);

  const trades = [...tradeMap.values()].sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber < b.blockNumber ? 1 : -1
  );
  const mints = [...mintMap.values()].sort((a, b) => (a.tokenId < b.tokenId ? -1 : 1));
  return { indexed: indexed.indexed, generatedAt: indexed.generatedAt, mints, trades };
}

export function useActivity() {
  const client = usePublicClient();
  const dream = virtuHomeSchemeAddress();
  return useQuery<ActivityResult>({
    queryKey: ["activity", dream ?? "none", schemeMarketAddress() ?? "none", TAIL_SCAN_BLOCKS.toString()],
    queryFn: async () => {
      const c = client ?? publicClientFor();
      const indexed = await fetchIndexedActivity();
      if (!c || !dream) return indexed;
      const tail = await fetchTailActivity(c).catch(() => ({ mints: [], trades: [] }));
      return mergeActivity(indexed, tail);
    },
    enabled: Boolean(dream),
    staleTime: 15_000,
    refetchInterval: 20_000,
    retry: 1
  });
}

/* ------------------------------------------------------------------ */
/* 演示数据：未配置合约地址时，让 /mint 与 /trades 依然有内容可展示     */
/* ------------------------------------------------------------------ */

import { demoSchemes } from "./demo";

const DEMO_CREATOR: Address = "0x8Ba1f2D3A4B5c6D7E8f90123456789aBcDEf0123";

export const demoActivity: ChainActivity = {
  mints: demoSchemes.map((s, i) => ({
    tokenId: s.tokenId,
    creator: DEMO_CREATOR,
    parentId: s.parentId,
    contentHash: s.contentHash,
    blockNumber: BigInt(1_000_000 + i * 37)
  })),
  trades: [
    { tokenId: 1n, applier: "0x3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d", blockNumber: 1_000_820, logIndex: 3 },
    { tokenId: 3n, applier: "0x5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4f", blockNumber: 1_000_764, logIndex: 1 },
    { tokenId: 1n, applier: "0x7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4f5A6b", blockNumber: 1_000_690, logIndex: 0 },
    { tokenId: 2n, applier: "0x9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4f5A6b7C8d", blockNumber: 1_000_512, logIndex: 2 },
    { tokenId: 3n, applier: "0x3C4d5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d", blockNumber: 1_000_455, logIndex: 0 },
    { tokenId: 2n, applier: "0x5E6f7A8b9C0d1E2f3A4b5C6d7E8f9A0b1C2d3E4f", blockNumber: 1_000_301, logIndex: 1 }
  ].map((t): TradeRecord => {
    const value = 10_000_000_000_000_000n; // 0.01 MON
    const creatorShare = (value * 9n) / 10n;
    return {
      tokenId: t.tokenId,
      applier: t.applier as Address,
      creator: DEMO_CREATOR,
      value,
      creatorShare,
      platformShare: value - creatorShare,
      blockNumber: BigInt(t.blockNumber),
      txHash: demoTxHash(t.blockNumber),
      logIndex: t.logIndex
    };
  })
};

/** 演示用的确定性伪随机交易哈希（保证每行不同，便于辨认）。 */
function demoTxHash(seed: number): Hex {
  const MASK = (1n << 64n) - 1n;
  let acc = BigInt(seed) & MASK;
  let out = "";
  for (let i = 0; i < 64; i++) {
    acc = (acc * 6364136223846793005n + 1442695040888963407n) & MASK;
    out += Number((acc >> 60n) & 0xfn).toString(16);
  }
  return `0x${out}` as Hex;
}
