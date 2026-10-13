import { NextRequest, NextResponse } from "next/server";
import { keccak256, toBytes } from "viem";
import { pinFile, pinJson, splitDataUri } from "@/lib/pinata";
import { buildTokenMetadata } from "@/lib/metadata";
import { validateScheme, type DesignScheme } from "@/lib/scheme";
import { L, pickLang } from "@/lib/apiLang";

export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/pin
  * Accept scheme JSON (+ optional preview image), pin it to IPFS, and return tokenUri / contentHash.
  * Supports both a JSON body and multipart/form-data:
 *   JSON:      { scheme: {...}, previewImage?: "data:image/...", name?, description? }
 *   FormData:  scheme=<JSON string>, preview=<File>, name?, description?
 */
export async function POST(req: NextRequest) {
  let lang: "zh" | "en" = pickLang(req);
  try {
    let scheme: unknown;
    let previewImage: string | null = null;
    let name: string | undefined;
    let description: string | undefined;

    const contentType = req.headers.get("content-type") ?? "";
    if (contentType.includes("multipart/form-data")) {
      const form = await req.formData();
      const langField = form.get("lang");
      if (langField === "en") lang = "en";
      const schemeStr = form.get("scheme");
      if (typeof schemeStr !== "string") {
        return NextResponse.json(
          { error: L(lang, "缺少 scheme 字段（JSON 字符串）", "Missing scheme field (JSON string)") },
          { status: 400 }
        );
      }
      scheme = JSON.parse(schemeStr);
      const preview = form.get("preview");
      if (preview instanceof File) {
        previewImage = `data:${preview.type || "image/png"};base64,${Buffer.from(
          await preview.arrayBuffer()
        ).toString("base64")}`;
      } else if (typeof preview === "string" && preview.length > 0) {
        previewImage = preview;
      }
      const n = form.get("name");
      const d = form.get("description");
      if (typeof n === "string") name = n;
      if (typeof d === "string") description = d;
    } else {
      const body = await req.json();
      lang = pickLang(req, body);
      scheme = body.scheme ?? body;
      previewImage = body.previewImage ?? body.preview ?? null;
      name = body.name;
      description = body.description;
    }

    const err = validateScheme(scheme, lang);
    if (err) {
      return NextResponse.json(
        { error: L(lang, `方案校验失败：${err}`, `Scheme validation failed: ${err}`) },
        { status: 400 }
      );
    }
    const design = scheme as DesignScheme;

    // Content hash = keccak256 of the pinned scheme JSON (unique content addressing + on-chain tamper resistance)
    const schemeJson = JSON.stringify(design);
    const contentHash = keccak256(toBytes(schemeJson));

    const schemePin = await pinJson(design, `scheme-${contentHash.slice(2, 12)}`);

    let imageUri = "";
    if (previewImage) {
      if (previewImage.startsWith("data:")) {
        const { mime, base64 } = splitDataUri(previewImage);
        imageUri = (
          await pinFile(Buffer.from(base64, "base64"), `preview-${contentHash.slice(2, 10)}`, mime)
        ).uri;
      } else if (previewImage.startsWith("ipfs://") || previewImage.startsWith("/") || previewImage.startsWith("http")) {
        imageUri = previewImage;
      } else {
        imageUri = (
          await pinFile(Buffer.from(previewImage, "utf8"), `preview-${contentHash.slice(2, 10)}.svg`, "image/svg+xml")
        ).uri;
      }
    }

    const tokenMeta = buildTokenMetadata({
      design,
      name: name?.trim() || design.name,
      description: description?.trim() || design.description || "",
      imageUri,
      schemeUri: schemePin.uri,
      contentHash
    });
    const tokenPin = await pinJson(tokenMeta, `token-${contentHash.slice(2, 12)}`);

    return NextResponse.json({
      ok: true,
      contentHash,
      schemeUri: schemePin.uri,
      tokenUri: tokenPin.uri,
      imageUri: imageUri || null,
      ipfsGateway: process.env.NEXT_PUBLIC_IPFS_GATEWAY || undefined
    });
  } catch (e) {
    console.error("[/api/pin] error:", e);
    const message = e instanceof Error ? e.message : L(lang, "未知错误", "Unknown error");
    return NextResponse.json(
      { error: L(lang, `固定到 IPFS 失败：${message}`, `Failed to pin to IPFS: ${message}`) },
      { status: 500 }
    );
  }
}
