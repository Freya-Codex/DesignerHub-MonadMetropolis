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
  * Alchemy Webhook receiver (Address Activity).
 *
  * Purpose: turn the "contract address activity" events pushed by Alchemy into the on-chain activity index,
  * making the attribution and stats for mint (SchemeMinted) / apply (SchemeApplied) event-driven
  * instead of relying on browser chunked scanning or a full offline rescan.
 *
  * Security: Alchemy callbacks carry X-Alchemy-Signature (HMAC-SHA256 over the raw body).
  * When ALCHEMY_WEBHOOK_SIGNING_KEY is set, verification is enforced; otherwise it is allowed through with a warning (for easier initial integration).
 *
  * Persisted to: data/activity-webhooks.json (runtime increments; already ignored in .gitignore).
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
    /* Ignore the corrupt file and rebuild */
  }
  return { generatedAt: new Date().toISOString(), source: "alchemy-webhook", mints: [], trades: [] };
}

function writeIndex(idx: RuntimeIndex): void {
  idx.updatedAt = new Date().toISOString();
  fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
  fs.writeFileSync(OUT_FILE, JSON.stringify(idx, null, 2) + "\n");
}

/** Extract "log-like" objects from an Alchemy callback as much as possible (fields live in different places per category). */
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

  // Fallback: some custom webhooks put logs under event.logs
  const logs: any[] = Array.isArray(ev.logs) ? ev.logs : [];
  for (const l of logs) {
    if (Array.isArray(l.topics)) out.push(l);
  }
  return out;
}

/** Decode a log using the two events' ABIs; returns null when nothing matches. */
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

  // 1) Signature verification (enforced when a signing key is configured)
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
