/**
  * hypersync.ts -- pull historical on-chain activity (SchemeMinted / SchemeApplied) via Envio HyperSync.
 *
  * Background (why not the public RPC):
  *   the Monad Testnet public RPC caps eth_getLogs at 100 blocks, while the deploy block to latest already spans
  *   tens of millions of blocks; a front-end/offline script using "chunking + exponential backoff" to scan the full history needs tens of thousands of requests -- slow and prone to gaps.
  *   HyperSync is Envio's query service for high-throughput on-chain data; it can pull the full history of logs in one pass,
  *   which is exactly the data the /trades (ledger) and /mint (mint feed) features rely on.
 *
  * Role: server-side data layer (build-time indexing).
  *   - reads ENVIO_API_TOKEN (no NEXT_PUBLIC_ prefix -> not inlined into the front-end bundle);
  *   - when no token is set, usingHyperSync() returns false and the caller falls back to public-RPC chunked scanning;
  *   - read-only, no chain writes; the endpoint is read-only with no funds/write permissions.
 */
import {
  HypersyncClient,
  type Log,
  type Query,
  type LogField
} from "@envio-dev/hypersync-client";
import { decodeEventLog, toEventSelector, type Address, type Hex } from "viem";
import { schemeAppliedEvent, schemeMintedEvent } from "./abis";

/** HyperSync public endpoint (Monad Testnet). Overridable via ENVIO_HYPERSYNC_URL. */
function hypersyncUrl(): string {
  return (
    process.env.ENVIO_HYPERSYNC_URL?.trim().replace(/\/+$/, "") ||
    "https://monad-testnet.hypersync.xyz"
  );
}

/** Envio API token (server side). Returns undefined when unset. */
export function envioApiToken(): string | undefined {
  return process.env.ENVIO_API_TOKEN?.trim() || undefined;
}

/** Whether Envio HyperSync is configured (decides whether indexing uses Envio or falls back to the public RPC). */
export function usingHyperSync(): boolean {
  return Boolean(envioApiToken());
}

/** Fetch only the minimal log fields needed (saves bandwidth, faster). */
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

/** Build the HyperSync client (throws without a token; the caller must check usingHyperSync() first). */
function makeClient(): HypersyncClient {
  const apiToken = envioApiToken();
  if (!apiToken) throw new Error("ENVIO_API_TOKEN 未配置，无法使用 HyperSync");
  return new HypersyncClient({ url: hypersyncUrl(), apiToken });
}

/**
  * Pull the specified event logs of a contract within [fromBlock, toBlock] (query's toBlock is exclusive).
  * collect() auto-paginates until it covers the whole range.
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
  * Pull the full historical activity via HyperSync, returning records in the same on-disk format as index-activity.ts.
  * Returns null when no token is configured (the caller falls back to the public RPC).
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
