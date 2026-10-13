import { NextRequest, NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { decodeEventLog, getAddress, type Address, type Hex } from "viem";
import { schemeMintedEvent, schemeAppliedEvent } from "@/lib/abis";
import { usingAlchemy, safeRpcLabel } from "@/lib/serverRpc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Alchemy Webhook 接收端（Address Activity）。
 *
 * 作用：把 Alchemy 推送的「合约地址活动」事件落成链上活动索引，
 * 使 铸造(SchemeMinted) / 应用(SchemeApplied) 的归因与统计变成事件驱动，
 * 而不必依赖浏览器分片扫描或离线全量重扫。
 *
 * 安全：Alchemy 回调带 X-Alchemy-Signature（对原始 body 做 HMAC-SHA256）。
 * 配置了 ALCHEMY_WEBHOOK_SIGNING_KEY 时强制校验；未配置时放行并记录警告（便于先联调）。
 *
 * 落盘：data/activity-webhooks.json（运行时增量，已在 .gitignore 中忽略）。
 */

const SIGNING_KEY = process.env.ALCHEMY_WEBHOOK_SIGNING_KEY?.trim();
const OUT_FILE = path.join(process.cwd(), "data", "activity-webhooks.json");

interface RuntimeIndex {
  generatedAt: string;
  updatedAt?: string;
  source: "alchemy-webhook";
  mints: any[];
  trades: any[];
}

function readIndex(): RuntimeIndex {
  try {
    if (fs.existsSync(OUT_FILE)) {
      const data = JSON.parse(fs.readFileSync(OUT_FILE, "utf8"));
      return {
        generatedAt: data.generatedAt ?? new Date().toISOString(),
        source: "alchemy-webhook",
        mints: Array.isArray(data.mints) ? data.mints : [],
        trades: Array.isArray(data.trades) ? data.trades : []
      };
    }
  } catch {
    /* 忽略损坏文件，重建 */
  }
  return { generatedAt: new Date().toISOString(), source: "alchemy-webhook", mints: [], trades: [] };
}

function writeIndex(idx: RuntimeIndex): void {
  idx.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(idx, null, 2) + "\n");
}

/** 从 Alchemy 回调里尽量提取「像日志」的对象（不同类别字段位置不同）。 */
function collectLogs(payload: any): any[] {
  const out: any[] = [];
  const ev = payload?.event ?? {};
  const activity: any[] = Array.isArray(ev.activity) ? ev.activity : [];

  for (const a of activity) {
    const log = a?.log ?? a?.rawLog ?? a;
    if (log && Array.isArray(log.topics) && log.topics.length > 0) {
      out.push({
        topics: log.topics,
        data: log.data ?? "0x",
        address: log.address ?? a?.rawContract?.address ?? a?.toAddress,
        transactionHash: log.transactionHash ?? a?.hash,
        logIndex: typeof log.logIndex === "number" ? log.logIndex : Number(log.logIndex ?? a?.logIndex ?? 0),
        blockNumber: log.blockNumber ?? a?.blockNum
      });
    }
  }

  // 兜底：某些自定义 Webhook 把日志放在 event.logs
  const logs: any[] = Array.isArray(ev.logs) ? ev.logs : [];
  for (const l of logs) {
    if (Array.isArray(l.topics)) out.push(l);
  }
  return out;
}

/** 用两个事件的 ABI 解码日志；无法匹配则返回 null。 */
function decodeAny(log: any): { name: string; args: any } | null {
  try {
    const decoded = decodeEventLog({
      abi: [schemeMintedEvent, schemeAppliedEvent],
      data: (log.data ?? "0x") as Hex,
      topics: log.topics as any,
      strict: true
    });
    return { name: decoded.eventName, args: decoded.args as any };
  } catch {
    return null;
  }
}

export async function GET() {
  const idx = readIndex();
  return NextResponse.json({
    ok: true,
    configured: usingAlchemy(),
    rpcLabel: safeRpcLabel(),
    signingKeyConfigured: Boolean(SIGNING_KEY),
    mints: idx.mints.length,
    trades: idx.trades.length,
    updatedAt: idx.updatedAt ?? null
  });
}

export async function POST(req: NextRequest) {
  const raw = await req.text();

  // 1) 签名校验（配置了 signing key 时强制）
  if (SIGNING_KEY) {
    const sig = req.headers.get("x-alchemy-signature") ?? "";
    const expected = crypto.createHmac("sha256", SIGNING_KEY).update(raw).digest("hex");
    if (
      sig.length !== expected.length ||
      !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      return NextResponse.json({ ok: false, error: "invalid_signature" }, { status: 401 });
    }
  }

  let payload: any;
  try {
    payload = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: "invalid_json" }, { status: 400 });
  }

  const idx = readIndex();
  const mintSeen = new Set(idx.mints.map((m) => String(m.tokenId)));
  const tradeSeen = new Set(idx.trades.map((t) => `${t.txHash}:${t.logIndex}`));

  let addedMints = 0;
  let addedTrades = 0;

  for (const log of collectLogs(payload)) {
    const decoded = decodeAny(log);
    if (!decoded) continue;

    if (decoded.name === "SchemeMinted") {
      const a = decoded.args;
      const tokenId = String(a.tokenId);
      if (mintSeen.has(tokenId)) continue;
      mintSeen.add(tokenId);
      idx.mints.push({
        tokenId,
        creator: getAddress(a.creator as string) as Address,
        parentId: String(a.parentId),
        contentHash: a.contentHash as Hex,
        agentId: String(a.agentId ?? 0n),
        blockNumber: String(log.blockNumber ?? 0)
      });
      addedMints++;
    } else if (decoded.name === "SchemeApplied") {
      const a = decoded.args;
      const txHash = (log.transactionHash ?? "0x") as Hex;
      const logIndex = Number(log.logIndex ?? 0);
      const key = `${txHash}:${logIndex}`;
      if (tradeSeen.has(key)) continue;
      tradeSeen.add(key);
      idx.trades.push({
        tokenId: String(a.tokenId),
        applier: getAddress(a.applier as string) as Address,
        creator: getAddress(a.creator as string) as Address,
        price: String(a.price),
        creatorCut: String(a.creatorCut),
        platformCut: String(a.platformCut),
        blockNumber: String(log.blockNumber ?? 0),
        txHash,
        logIndex
      });
      addedTrades++;
    }
  }

  if (addedMints || addedTrades) {
    idx.mints.sort((a, b) => (BigInt(a.blockNumber) < BigInt(b.blockNumber) ? -1 : 1));
    idx.trades.sort((a, b) =>
      BigInt(a.blockNumber) === BigInt(b.blockNumber)
        ? (b.logIndex as number) - (a.logIndex as number)
        : BigInt(a.blockNumber) < BigInt(b.blockNumber)
          ? 1
          : -1
    );
    writeIndex(idx);
  }

  return NextResponse.json({ ok: true, addedMints, addedTrades });
}
