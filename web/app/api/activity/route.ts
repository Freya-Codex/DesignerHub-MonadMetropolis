import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

/**
 * 返回离线索引的链上活动（web/data/activity.json，由 scripts/index-activity.ts 生成）。
 * 该文件随仓库提交，线上部署后也可直接读取，无需浏览器扫描百万级区块。
 */
export async function GET() {
  try {
    const file = path.join(process.cwd(), "data", "activity.json");
    if (!fs.existsSync(file)) {
      return NextResponse.json({ indexed: false, mints: [], trades: [] });
    }
    const data = JSON.parse(fs.readFileSync(file, "utf8"));
    return NextResponse.json({ indexed: true, ...data });
  } catch (err: any) {
    return NextResponse.json({
      indexed: false,
      mints: [],
      trades: [],
      error: err?.message ?? "read failed"
    });
  }
}
