import { NextRequest, NextResponse } from "next/server";
import { getAddress } from "viem";
import { verifyMessage } from "viem";
import { appendComment, isValidTokenId, readComments } from "@/lib/comments";
import { L, pickLang } from "@/lib/apiLang";

export const runtime = "nodejs";

/** GET /api/comment?tokenId=1 -- read the off-chain comments of a scheme. */
export async function GET(req: NextRequest) {
  const lang = pickLang(req);
  const tokenId = Number(req.nextUrl.searchParams.get("tokenId"));
  if (!isValidTokenId(tokenId)) {
    return NextResponse.json({ error: L(lang, "tokenId 无效", "Invalid tokenId") }, { status: 400 });
  }
  return NextResponse.json({ tokenId, items: readComments(tokenId) });
}

/**
 * POST /api/comment
 * body: { tokenId, text, address, signature, message }
  * The backend verifies the wallet signature (SIWE-style) with viem verifyMessage; on success it writes local JSON and consumes no gas.
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>;
    const lang = pickLang(req, body);
    const tokenId = Number(body.tokenId);
    if (!isValidTokenId(tokenId)) {
      return NextResponse.json({ error: L(lang, "tokenId 无效", "Invalid tokenId") }, { status: 400 });
    }

    const text = typeof body.text === "string" ? body.text.trim() : "";
    if (!text) return NextResponse.json({ error: L(lang, "评论内容不能为空", "Comment text cannot be empty") }, { status: 400 });
    if (text.length > 500)
      return NextResponse.json({ error: L(lang, "评论不能超过 500 字", "Comment must be under 500 characters") }, { status: 400 });

    if (typeof body.address !== "string" || typeof body.signature !== "string" || typeof body.message !== "string") {
      return NextResponse.json({ error: L(lang, "缺少 address / signature / message", "Missing address / signature / message") }, { status: 400 });
    }

    let author: string;
    try {
      author = getAddress(body.address);
    } catch {
      return NextResponse.json({ error: L(lang, "钱包地址格式不正确", "Invalid wallet address format") }, { status: 400 });
    }

    if (!body.message.includes(`方案 #${tokenId}`)) {
      return NextResponse.json({ error: L(lang, "签名内容与方案不匹配", "Signed message does not match this scheme") }, { status: 400 });
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
      return NextResponse.json({ error: L(lang, "钱包签名验证失败", "Wallet signature verification failed") }, { status: 401 });
    }

    const comment = appendComment({
      tokenId,
      author,
      text,
      signature: body.signature
    });

    return NextResponse.json({ ok: true, comment });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to publish comment: ${message}` }, { status: 500 });
  }
}
