/**
 * 链上事件聚合：SchemeMinted（铸造）与 SchemeApplied（应用/付费）全量流水。
 * 供 /mint（铸造中心）与 /trades（交易记录）复用。
 */
import { useQuery } from "@tanstack/react-query";
import type { Address, Hex, PublicClient } from "viem";
import { usePublicClient } from "wagmi";
import { schemeAppliedEvent, schemeMintedEvent } from "./abis";
import { dreamSchemeAddress, publicClientFor, schemeMarketAddress } from "./contracts";

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

/** 用 Promise.allSettled 包裹 getLogs，单边失败不影响另一边。 */
async function safeLogs<T>(fn: () => Promise<T[]>): Promise<T[]> {
  try {
    return await fn();
  } catch {
    return [];
  }
}

export async function fetchActivity(client: PublicClient): Promise<ChainActivity> {
  const dream = dreamSchemeAddress();
  const market = schemeMarketAddress();

  const mintPromise = safeLogs(async () => {
    if (!dream) return [];
    const logs = await client.getLogs({
      address: dream,
      event: schemeMintedEvent,
      fromBlock: 0n,
      toBlock: "latest"
    });
    return (logs as Array<{ args: any; blockNumber: bigint | null }>).map((l) => ({
      tokenId: l.args.tokenId as bigint,
      creator: l.args.creator as Address,
      parentId: l.args.parentId as bigint,
      contentHash: l.args.contentHash as Hex,
      blockNumber: l.blockNumber ?? 0n
    }));
  });

  const tradePromise = safeLogs(async () => {
    if (!market) return [];
    const logs = await client.getLogs({
      address: market,
      event: schemeAppliedEvent,
      fromBlock: 0n,
      toBlock: "latest"
    });
    return (logs as Array<{ args: any; blockNumber: bigint | null; transactionHash: Hex; logIndex: number }>).map(
      (l) => ({
        tokenId: l.args.tokenId as bigint,
        applier: l.args.applier as Address,
        creator: l.args.creator as Address,
        value: l.args.value as bigint,
        creatorShare: l.args.creatorShare as bigint,
        platformShare: l.args.platformShare as bigint,
        blockNumber: l.blockNumber ?? 0n,
        txHash: l.transactionHash,
        logIndex: l.logIndex
      })
    );
  });

  const [mints, trades] = await Promise.all([mintPromise, tradePromise]);
  trades.sort((a, b) =>
    a.blockNumber === b.blockNumber ? b.logIndex - a.logIndex : a.blockNumber < b.blockNumber ? 1 : -1
  );
  return { mints, trades };
}

export function useActivity() {
  const client = usePublicClient();
  const dream = dreamSchemeAddress();
  return useQuery({
    queryKey: ["activity", dream ?? "none", schemeMarketAddress() ?? "none"],
    queryFn: async () => {
      const c = client ?? publicClientFor();
      if (!c) return { mints: [], trades: [] } as ChainActivity;
      return fetchActivity(c);
    },
    enabled: Boolean(client) && Boolean(dream),
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
