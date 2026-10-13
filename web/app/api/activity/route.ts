import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
  * Return the on-chain activity index (the /mint and /trades feed).
 *
  * Two data sources are merged (deduplicated by txHash+logIndex / tokenId; offline index wins):
  *  1) data/activity.json          -- offline index (scripts/index-activity.ts; the server may use Alchemy)
  *  2) data/activity-webhooks.json -- Alchemy Webhook runtime increments (event-driven)
  * When neither exists it returns indexed:false and the front end degrades to browser tail-window scanning.
 */

function readJson(file: string): any | null {
  try {
    if (!fs.existsSync(file)) return null;
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

export async function GET() {
  try {
    const base = path.join(process.cwd(), "data");
    const offline = readJson(path.join(base, "activity.json"));
    const webhooks = readJson(path.join(base, "activity-webhooks.json"));

    const mintsById = new Map<string, any>();
    const tradesById = new Map<string, any>();
    for (const src of [webhooks, offline]) {
      if (!src) continue;
      for (const m of src.mints ?? []) mintsById.set(String(m.tokenId), m);
      for (const t of src.trades ?? []) tradesById.set(`${t.txHash}:${t.logIndex}`, t);
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

    const indexed = Boolean(offline || webhooks);
    return NextResponse.json({
      indexed,
      generatedAt: offline?.generatedAt,
      updatedAt: webhooks?.updatedAt,
      sources: {
        offline: Boolean(offline),
        webhook: Boolean(webhooks)
      },
      mints,
      trades
    });
  } catch (err: any) {
    return NextResponse.json({
      indexed: false,
      mints: [],
      trades: [],
      error: err?.message ?? "read failed"
    });
  }
}
