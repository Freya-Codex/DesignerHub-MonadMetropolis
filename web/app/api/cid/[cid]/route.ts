import { NextRequest, NextResponse } from "next/server";
import { readLocalRecord } from "@/lib/pinata";

export const runtime = "nodejs";

/** 本地演示模式：按 local:// CID 读取已被固定/存储的内容。 */
export async function GET(_req: NextRequest, { params }: { params: { cid: string } }) {
  const record = readLocalRecord(params.cid);
  if (!record) {
    return new NextResponse("Not found", { status: 404 });
  }
  if (record.type === "json") {
    return NextResponse.json(record.json, {
      headers: { "Cache-Control": "public, max-age=3600" }
    });
  }
  if (record.base64) {
    return new Response(Buffer.from(record.base64, "base64"), {
      headers: {
        "Content-Type": record.mime ?? "application/octet-stream",
        "Cache-Control": "public, max-age=3600"
      }
    });
  }
  return new NextResponse("Empty record", { status: 500 });
}
