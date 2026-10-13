/**
 * index-activity.ts —— 链上活动索引器（SchemeMinted / SchemeApplied 全量流水）
 *
 * 数据源（两选一，自动选择）：
 *   1) 首选 Envio HyperSync（配置了 ENVIO_API_TOKEN 时）——一次拉全量历史日志，
 *      直接覆盖部署块 → 最新块，无需分片，这正是 /trades 交易账本与 /mint 铸造流水
 *      依赖的数据。
 *   2) 回退公共 RPC 分片扫描（未配置 token 时）——Monad 公共 RPC 把 eth_getLogs
 *      限制在 100 个区块内，只能分片 + 指数退避。
 *
 * 两者都把结果落盘为 web/data/activity.json；前端通过 /api/activity 读取，
 * 得到一份完整、可核对的交易账本。
 *
 * 用法（在 web/ 目录下）：
 *   npm run index                              # 有 token → HyperSync 全量；否则头部/尾部窗口
 *   INDEX_FULL=1 npm run index                 # 回退路径下：部署块 → 最新块全量扫描（慢）
 *   ENVIO_API_TOKEN=xxx npm run index          # 显式走 HyperSync
 *
 * 脚本可安全重复执行（按 txHash+logIndex 去重，结果稳定）。
 */
import fs from "node:fs";
import path from "node:path";
import { createPublicClient, getAddress, type Address } from "viem";
import { monadTestnet } from "../lib/chains";
import { schemeMintedEvent, schemeAppliedEvent } from "../lib/abis";
import { serverTransport, safeRpcLabel, usingAlchemy } from "../lib/serverRpc";
import { fetchActivityViaHyperSync, usingHyperSync } from "../lib/hypersync";

/** Next.js 会自动加载 .env.local，但 tsx 直接跑脚本不会。 */
function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

const env = process.env;
// Alchemy 允许更大的 eth_getLogs 区间，未开通时回退公共 RPC（100 区块）。
const CHUNK = BigInt(env.INDEX_CHUNK || (usingAlchemy() ? "2000" : "100"));
const CONCURRENCY = Math.max(1, Number(env.INDEX_CONCURRENCY || "6"));
const HEAD = BigInt(env.INDEX_HEAD || "20000");
const TAIL = BigInt(env.INDEX_TAIL || "20000");
const FULL = env.INDEX_FULL === "1";
const OUT_FILE = path.join(process.cwd(), "data", "activity.json");

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function resolveAddress(envKey: string, jsonKey: string): Address | undefined {
  const fromEnv = env[envKey];
  if (fromEnv) {
    try {
      return getAddress(fromEnv);
    } catch {
      console.warn(`⚠️  忽略无效 ${envKey}：${fromEnv}`);
    }
  }
  const deployFile = path.join(process.cwd(), "..", "contracts", "deployments", "monad-testnet.json");
  if (fs.existsSync(deployFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(deployFile, "utf8")) as Record<string, string>;
      const addr = data[jsonKey];
      if (addr && addr.startsWith("0x")) return getAddress(addr);
    } catch {
      /* 忽略 */
    }
  }
  return undefined;
}

const client = createPublicClient({ chain: monadTestnet, transport: serverTransport() });

/** 单个 100 区块分片的查询，遇到限流（429 / -32614）指数退避重试。 */
async function getLogsWithRetry(
  address: Address,
  event: any,
  from: bigint,
  to: bigint,
  attempt = 0
): Promise<any[]> {
  try {
    return await client.getLogs({ address, event, fromBlock: from, toBlock: to });
  } catch (err) {
    if (attempt >= 7) {
      console.warn(`\n⚠️  跳过分片 [${from}, ${to}]（多次重试失败）`);
      return [];
    }
    const delay = Math.min(3000, 120 * 2 ** attempt) + Math.random() * 120;
    await sleep(delay);
    return getLogsWithRetry(address, event, from, to, attempt + 1);
  }
}

async function scanWindow(
  label: string,
  address: Address,
  event: any,
  from: bigint,
  to: bigint
): Promise<any[]> {
  const ranges: Array<[bigint, bigint]> = [];
  for (let s = from; s <= to; s += CHUNK) {
    ranges.push([s, s + CHUNK - 1n > to ? to : s + CHUNK - 1n]);
  }
  const out: any[] = [];
  for (let i = 0; i < ranges.length; i += CONCURRENCY) {
    const batch = ranges.slice(i, i + CONCURRENCY);
    const settled = await Promise.all(
      batch.map(([f, t]) => getLogsWithRetry(address, event, f, t))
    );
    for (const logs of settled) out.push(...logs);
    process.stdout.write(
      `\r  ${label} ${Math.min(i + CONCURRENCY, ranges.length)}/${ranges.length} 分片（命中 ${out.length}）…`
    );
  }
  process.stdout.write("\n");
  return out;
}

async function main(): Promise<void> {
  const scheme = resolveAddress("NEXT_PUBLIC_DREAM_SCHEME_ADDRESS", "DreamScheme");
  const market = resolveAddress("NEXT_PUBLIC_SCHEME_MARKET_ADDRESS", "SchemeMarket");
  if (!scheme) throw new Error("无法确定 DreamScheme 地址（NEXT_PUBLIC_DREAM_SCHEME_ADDRESS）");

  const latest = await client.getBlockNumber();
  const deployBlock = env.NEXT_PUBLIC_DEPLOY_BLOCK ? BigInt(env.NEXT_PUBLIC_DEPLOY_BLOCK) : 0n;

  console.log("🏠 DreamScheme :", scheme);
  console.log("🏪 SchemeMarket   :", market ?? "未配置");
  console.log("⛓️  部署块 / 最新块 :", deployBlock.toString(), "/", latest.toString());

  // ---- 首选：Envio HyperSync 全量历史（一次拉完，无分片）----
  if (usingHyperSync()) {
    console.log("🔌 数据源         : Envio HyperSync（全量历史）");
    const hs = await fetchActivityViaHyperSync({
      scheme,
      market,
      fromBlock: deployBlock,
      toBlock: latest,
      onProgress: (m) => console.log("   " + m)
    });
    if (hs) {
      const mints = [...hs.mints].sort((a, b) => (BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : 1));
      const trades = [...hs.trades].sort((a, b) =>
        BigInt(a.blockNumber) === BigInt(b.blockNumber)
          ? b.logIndex - a.logIndex
          : BigInt(a.blockNumber) < BigInt(b.blockNumber)
            ? 1
            : -1
      );
      const payload = {
        generatedAt: new Date().toISOString(),
        chainId: monadTestnet.id,
        source: "envio-hypersync",
        archiveHeight: hs.archiveHeight,
        scheme,
        market: market ?? null,
        latestBlock: latest.toString(),
        windows: [[deployBlock.toString(), latest.toString()]],
        mints,
        trades
      };
      fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
      fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + "\n");
      console.log(`\n✅ 写入 ${path.relative(process.cwd(), OUT_FILE)}（Envio HyperSync）`);
      console.log(`   铸造记录 ${mints.length} 条 · 应用记录 ${trades.length} 条`);
      return;
    }
    console.warn("⚠️  HyperSync 返回空，回退公共 RPC 分片扫描…");
  }

  // ---- 回退：公共 RPC 分片扫描 ----
  console.log("🔌 数据源         : 公共 RPC 分片扫描");
  console.log("🔌 RPC 提供方     :", usingAlchemy() ? `Alchemy (${safeRpcLabel()})` : "公共 RPC");
  console.log("📦 getLogs 分片    :", CHUNK.toString(), "区块");

  const windows: Array<[bigint, bigint]> = [];
  if (FULL) {
    windows.push([deployBlock, latest]);
  } else {
    const headTo = deployBlock + HEAD > latest ? latest : deployBlock + HEAD;
    windows.push([deployBlock, headTo]);
    if (TAIL > 0n) {
      const tailFrom = latest > TAIL ? latest - TAIL : deployBlock;
      if (tailFrom > headTo + 1n) windows.push([tailFrom, latest]);
    }
  }
  console.log(
    "🪟 扫描窗口       :",
    windows.map(([f, t]) => `[${f}-${t}]`).join(" ")
  );

  const mintsById = new Map<string, any>();
  const tradesById = new Map<string, any>();

  for (const [from, to] of windows) {
    const mints = await scanWindow("SchemeMinted ", scheme, schemeMintedEvent, from, to);
    for (const l of mints) {
      const key = `${l.transactionHash}:${l.logIndex}`;
      mintsById.set(key, {
        tokenId: (l.args.tokenId as bigint).toString(),
        creator: l.args.creator as Address,
        parentId: (l.args.parentId as bigint).toString(),
        contentHash: l.args.contentHash as string,
        agentId: ((l.args.agentId as bigint) ?? 0n).toString(),
        blockNumber: (l.blockNumber ?? 0n).toString()
      });
    }
    if (market) {
      const trades = await scanWindow("SchemeApplied", market, schemeAppliedEvent, from, to);
      for (const l of trades) {
        const key = `${l.transactionHash}:${l.logIndex}`;
        tradesById.set(key, {
          tokenId: (l.args.tokenId as bigint).toString(),
          applier: l.args.applier as Address,
          creator: l.args.creator as Address,
          price: (l.args.price as bigint).toString(),
          creatorCut: (l.args.creatorCut as bigint).toString(),
          platformCut: (l.args.platformCut as bigint).toString(),
          blockNumber: (l.blockNumber ?? 0n).toString(),
          txHash: l.transactionHash as string,
          logIndex: l.logIndex
        });
      }
    }
  }

  const mints = [...mintsById.values()].sort((a, b) =>
    BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : 1
  );
  const trades = [...tradesById.values()].sort((a, b) =>
    BigInt(a.blockNumber) === BigInt(b.blockNumber)
      ? (b.logIndex as number) - (a.logIndex as number)
      : BigInt(a.blockNumber) < BigInt(b.blockNumber)
        ? 1
        : -1
  );

  const payload = {
    generatedAt: new Date().toISOString(),
    chainId: monadTestnet.id,
    source: "public-rpc",
    scheme,
    market: market ?? null,
    latestBlock: latest.toString(),
    windows: windows.map(([f, t]) => [f.toString(), t.toString()]),
    mints,
    trades
  };

  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(payload, null, 2) + "\n");

  console.log(`\n✅ 写入 ${path.relative(process.cwd(), OUT_FILE)}`);
  console.log(`   铸造记录 ${mints.length} 条 · 应用记录 ${trades.length} 条`);
}

main().catch((err) => {
  console.error("\n❌ 索引失败：", err?.message ?? err);
  process.exit(1);
});
