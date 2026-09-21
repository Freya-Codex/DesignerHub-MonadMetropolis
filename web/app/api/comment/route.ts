import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifyMessage } from "viem";
import { appendComment, isValidTokenId, readComments } from "@/lib/comments";

export const runtime = "nodejs";

/** GET /api/comment?tokenId=1 —— 读取某方案的链下评论。 */
export async function GET(req: NextRequest) {
  const tokenId = Number(req.nextUrl.searchParams.get("tokenId"));
  if (!isValidTokenId(tokenId)) {
    return NextResponse.json({ error: "tokenId 无效" }, { status: 400 });
  }
  return NextResponse.json({ tokenId, items: readComments(tokenId) });
}

/**
 * POST /api/comment
 * body: { tokenId, text, address, signature, message }
 * 后端用 viem verifyMessage 校验钱包签名（SIWE 风格），通过后写入本地 JSON，不消耗 gas。
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const tokenId = Number(body.tokenId);
    if (!isValidTokenId(tokenId)) {
      return NextResponse.json({ error: "tokenId 无效" }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: "评论内容不能为空" }, { status: 400 });
    if (text.length > 500) return NextResponse.json({ error: "评论不能超过 500 字" }, { status: 400 });

    if (typeof body.address !== "string" || typeof body.signature !== "string" || typeof body.message !== "string") {
      return NextResponse.json({ error: "缺少 address / signature / message" }, { status: 400 });
    }

    let author: string;
    try {
      author = getAddress(body.address);
    } catch {
      return NextResponse.json({ error: "钱包地址格式不正确" }, { status: 400 });
    }

    if (!body.message.includes(`方案 #${tokenId}`)) {
      return NextResponse.json({ error: "签名内容与方案不匹配" }, { status: 400 });
    }

    let valid = false;
    try {
      valid = await verifyMessage({
        address: author as `0x${string}`,
        message: body.message,
        signature: body.signature as `0x${string}`
      });
    } catch {
      valid = false;
    }
    if (!valid) {
      return NextResponse.json({ error: "钱包签名验证失败" }, { status: 401 });
    }

    const comment = appendComment({
      tokenId,
      author,
      text,
      signature: body.signature
    });

    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: `评论发布失败：${message}` }, { status: 500 });
  }
}
