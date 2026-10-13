/**
 * hypersync.ts —— 用 Envio HyperSync 拉取历史链上活动（SchemeMinted / SchemeApplied）。
 *
 * 背景（为什么不用公共 RPC）：
 *   Monad 测试网公共 RPC 把 eth_getLogs 限制在 100 个区块内，而部署块到最新块已有
 *   千万级区块；前端/离线脚本用「分片 + 指数退避」扫完全史需要上万次请求，慢且易缺。
 *   HyperSync 是 Envio 为高吞吐链上数据设计的查询服务，可一次拉全量历史日志，
 *   这正是 /trades（交易账本）与 /mint（铸造流水）两个功能依赖的数据。
 *
 * 定位：服务端数据层（构建期索引）。
 *   · 读取 ENVIO_API_TOKEN（无 NEXT_PUBLIC_ 前缀 → 不会内联进前端 bundle）；
 *   · 未配置 token 时 usingHyperSync() 返回 false，调用方回退到公共 RPC 分片扫描；
 *   · 只做读，不写链；端点只读，无资金/写权限。
 */
import {
  HypersyncClient,
  type Log,
  type Query,
  type LogField
} from "@envio-dev/hypersync-client";
import { decodeEventLog, toEventSelector, type Address, type Hex } from "viem";
import { schemeAppliedEvent, schemeMintedEvent } from "./abis";

/** HyperSync 公共端点（Monad Testnet）。可用 ENVIO_HYPERSYNC_URL 覆盖。 */
function hypersyncUrl(): string {
  return (
    process.env.ENVIO_HYPERSYNC_URL?.trim().replace(/\/+$/, "") ||
    "https://monad-testnet.hypersync.xyz"
  );
}

/** Envio API token（服务端）。未配置返回 undefined。 */
export function envioApiToken(): string | undefined {
  return process.env.ENVIO_API_TOKEN?.trim() || undefined;
}

/** 是否已配置 Envio HyperSync（决定索引走 Envio 还是回退公共 RPC）。 */
export function usingHyperSync(): boolean {
  return Boolean(envioApiToken());
}

/** 取链上所需的最小日志字段（省带宽、更快）。 */
const LOG_FIELDS: LogField[] = [
  "BlockNumber",
  "LogIndex",
  "TransactionHash",
  "Address",
  "Data",
  "Topic0",
  "Topic1",
  "Topic2",
  "Topic3"
];

export type HsMint = {
  tokenId: string;
  creator: Address;
  parentId: string;
  contentHash: Hex;
  agentId: string;
  blockNumber: string;
};

export type HsTrade = {
  tokenId: string;
  applier: Address;
  creator: Address;
  price: string;
  creatorCut: string;
  platformCut: string;
  blockNumber: string;
  txHash: Hex;
  logIndex: number;
};

export type HyperSyncActivity = {
  mints: HsMint[];
  trades: HsTrade[];
  archiveHeight: number;
};

/** 构造 HyperSync 客户端（无 token 时抛错，调用方须先判 usingHyperSync()）。 */
function makeClient(): HypersyncClient {
  const apiToken = envioApiToken();
  if (!apiToken) throw new Error("ENVIO_API_TOKEN 未配置，无法使用 HyperSync");
  return new HypersyncClient({ url: hypersyncUrl(), apiToken });
}

/**
 * 拉取 [fromBlock, toBlock] 区间内某合约的指定事件日志（query 的 toBlock 为开区间）。
 * collect() 会自动分页直到覆盖整个区间。
 */
async function collectLogs(
  client: HypersyncClient,
  address: Address,
  topic0: Hex,
  fromBlock: number,
  toBlockExclusive: number | undefined
): Promise<Log[]> {
  const query: Query = {
    fromBlock,
    ...(toBlockExclusive !== undefined ? { toBlock: toBlockExclusive } : {}),
    logs: [{ include: { address: [address], topics: [[topic0]] } }],
    fieldSelection: { log: LOG_FIELDS }
  };
  const res = await client.collect(query, {});
  return res.data.logs ?? [];
}

/**
 * 用 HyperSync 拉取全量历史活动，返回与 index-activity.ts 落盘格式一致的记录。
 * 若未配置 token，返回 null（调用方回退公共 RPC）。
 */
export async function fetchActivityViaHyperSync(opts: {
  scheme: Address;
  market?: Address;
  fromBlock: bigint;
  toBlock?: bigint;
  onProgress?: (msg: string) => void;
}): Promise<HyperSyncActivity | null> {
  if (!usingHyperSync()) return null;
  const client = makeClient();
  const from = Number(opts.fromBlock);
  const to = opts.toBlock !== undefined ? Number(opts.toBlock) + 1 : undefined; // 开区间

  const topicMinted = toEventSelector(schemeMintedEvent) as Hex;
  const topicApplied = toEventSelector(schemeAppliedEvent) as Hex;

  opts.onProgress?.(`HyperSync ${hypersyncUrl()} 拉取 SchemeMinted…`);
  const mintLogs = await collectLogs(client, opts.scheme, topicMinted, from, to);

  const trades: HsTrade[] = [];
  if (opts.market) {
    opts.onProgress?.("HyperSync 拉取 SchemeApplied…");
    const tradeLogs = await collectLogs(client, opts.market, topicApplied, from, to);
    for (const l of tradeLogs) {
      const t = decodeTrade(l);
      if (t) trades.push(t);
    }
  }

  const mints: HsMint[] = [];
  for (const l of mintLogs) {
    const m = decodeMint(l);
    if (m) mints.push(m);
  }

  const height = await client.getHeight().catch(() => 0);
  return { mints, trades, archiveHeight: height };
}

function decodeMint(log: Log): HsMint | undefined {
  try {
    const decoded = decodeEventLog({
      abi: [schemeMintedEvent] as const,
      topics: log.topics as [Hex, ...Hex[]],
      data: (log.data ?? "0x") as Hex
    });
    const a = decoded.args as unknown as {
      tokenId: bigint;
      creator: Address;
      parentId: bigint;
      contentHash: Hex;
      agentId: bigint;
    };
    return {
      tokenId: a.tokenId.toString(),
      creator: a.creator,
      parentId: a.parentId.toString(),
      contentHash: a.contentHash,
      agentId: (a.agentId ?? 0n).toString(),
      blockNumber: String(log.blockNumber ?? 0)
    };
  } catch {
    return undefined;
  }
}

function decodeTrade(log: Log): HsTrade | undefined {
  try {
    const decoded = decodeEventLog({
      abi: [schemeAppliedEvent] as const,
      topics: log.topics as [Hex, ...Hex[]],
      data: (log.data ?? "0x") as Hex
    });
    const a = decoded.args as unknown as {
      tokenId: bigint;
      applier: Address;
      creator: Address;
      price: bigint;
      creatorCut: bigint;
      platformCut: bigint;
    };
    return {
      tokenId: a.tokenId.toString(),
      applier: a.applier,
      creator: a.creator,
      price: a.price.toString(),
      creatorCut: a.creatorCut.toString(),
      platformCut: a.platformCut.toString(),
      blockNumber: String(log.blockNumber ?? 0),
      txHash: (log.transactionHash ?? "0x") as Hex,
      logIndex: log.logIndex ?? 0
    };
  } catch {
    return undefined;
  }
}
