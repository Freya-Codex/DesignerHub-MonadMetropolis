import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * 返回链上活动索引（/mint 与 /trades 的流水）。
 *
 * 两路数据合并（按 txHash+logIndex / tokenId 去重，离线索引优先）：
 *  1) data/activity.json          —— 离线索引（scripts/index-activity.ts，服务端可走 Alchemy）
 *  2) data/activity-webhooks.json —— Alchemy Webhook 运行时增量（事件驱动）
 * 两者都不存在时返回 indexed:false，前端将退化为浏览器尾部窗口扫描。
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
