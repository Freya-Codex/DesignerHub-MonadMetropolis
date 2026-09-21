import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";
import { DEMO_SCHEME_FILES } from "@/lib/demo";

export const runtime = "nodejs";

/** 读取 assets/schemes 下的示例方案 JSON（演示模式使用，保持单一数据源）。 */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const file = DEMO_SCHEME_FILES[Number(params.id)];
  if (!file) {
    return NextResponse.json({ error: "无效的演示方案 ID（支持 1-3）" }, { status: 404 });
  }
  const filePath = path.join(process.cwd(), "..", "assets", "schemes", file);
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return NextResponse.json(JSON.parse(raw));
  } catch {
    return NextResponse.json({ error: "示例方案文件读取失败" }, { status: 500 });
  }
}
