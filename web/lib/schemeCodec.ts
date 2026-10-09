"use client";

/**
 * lib/schemeCodec.ts —— 方案码（base64url）编解码。
 *
 * 与「云筑家 VirtuHome Web MVP」保持一致：JSON → deflate-raw 压缩 → base64url。
 * 使用浏览器原生 CompressionStream / DecompressionStream，无需第三方库。
 *
 * 解码时兼容两种来源：
 *   1) 本站方案（DesignScheme）；
 *   2) VirtuHome 的 HomePlan —— 自动转换为 DesignScheme（best-effort）。
 */

import { validateScheme, type DesignScheme, type FurnitureItem } from "@/lib/scheme";

const te = new TextEncoder();
const td = new TextDecoder();

async function through(bytes: Uint8Array, ts: unknown): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(ts as TransformStream<Uint8Array, Uint8Array>);
  const buf = await new Response(stream).arrayBuffer();
  return new Uint8Array(buf);
}

function bytesToBase64url(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64urlToBytes(s: string): Uint8Array {
  let t = s.replace(/-/g, "+").replace(/_/g, "/");
  while (t.length % 4) t += "=";
  const bin = atob(t);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** DesignScheme → 方案码（压缩 + base64url）。分享时可去掉体积大的 previewImage。 */
export async function encodeSchemeCode(scheme: DesignScheme, opts: { stripPreview?: boolean } = {}): Promise<string> {
  const clone: DesignScheme = JSON.parse(JSON.stringify(scheme));
  if (opts.stripPreview !== false) delete clone.previewImage;
  const bytes = te.encode(JSON.stringify(clone));
  const compressed = await through(bytes, new CompressionStream("deflate-raw"));
  return bytesToBase64url(compressed);
}

export interface DecodedScheme {
  scheme: DesignScheme;
  source: "designscheme" | "homeplan";
  note: string;
}

/** 方案码 → DesignScheme（自动识别本站方案 / VirtuHome HomePlan）。 */
export async function decodeSchemeCode(code: string): Promise<DecodedScheme> {
  const cleaned = String(code || "").trim().replace(/\s+/g, "");
  if (!cleaned) throw new Error("方案码为空");

  let bytes: Uint8Array;
  try {
    bytes = base64urlToBytes(cleaned);
  } catch {
    throw new Error("方案码格式无效（不是合法的 base64url）");
  }

  let json: string;
  try {
    json = td.decode(await through(bytes, new DecompressionStream("deflate-raw")));
  } catch {
    // 兜底：也许码里是未压缩的 base64url JSON
    try {
      json = td.decode(bytes);
    } catch {
      throw new Error("解码失败：内容已损坏或版本不兼容");
    }
  }

  let obj: unknown;
  try {
    obj = JSON.parse(json);
  } catch {
    throw new Error("解码失败：不是合法的方案 JSON");
  }

  const asScheme = validateScheme(obj);
  if (!asScheme) {
    return { scheme: obj as DesignScheme, source: "designscheme", note: "识别为本站方案（DesignScheme）" };
  }

  if (looksLikeHomePlan(obj)) {
    const scheme = homePlanToScheme(obj as Record<string, any>);
    const err2 = validateScheme(scheme);
    if (!err2) {
      const title = (obj as any)?.meta?.title ?? "未命名";
      return { scheme, source: "homeplan", note: `识别为 VirtuHome HomePlan「${title}」，已转换` };
    }
    throw new Error(`方案码疑似 HomePlan，但转换后仍不合法：${err2}`);
  }

  throw new Error(`方案码解出的 JSON 不是有效方案：${asScheme}`);
}

function looksLikeHomePlan(x: any): boolean {
  return Boolean(
    x &&
      typeof x === "object" &&
      x.version === 1 &&
      x.meta &&
      (x.moduleA || x.moduleB || x.moduleC || x.moduleD || x.brief)
  );
}

const round1 = (n: number) => Math.round(n * 10) / 10;

function slug(s: string): string {
  const t = String(s || "item")
    .toLowerCase()
    .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 24);
  return t || "item";
}

const DEFAULT_PALETTE = ["#F5F1E8", "#BEC9B3", "#D9C7A7", "#4A4A44", "#FFFFFF"];

/** VirtuHome HomePlan → 本站 DesignScheme（best-effort，保证可通过 validateScheme）。 */
export function homePlanToScheme(plan: Record<string, any>): DesignScheme {
  const brief = plan.brief ?? {};
  const modA = plan.moduleA ?? {};

  const name = (String(plan.meta?.title || brief.roomType || "导入方案").trim() || "导入方案").slice(0, 60);
  const roomType = String(brief.roomType || "客厅").trim() || "客厅";

  const size = Number(brief.size);
  const dimensions =
    Number.isFinite(size) && size > 0
      ? (() => {
          const side = Math.sqrt(size);
          const width = Math.max(2, round1(side));
          const length = Math.max(2, round1(size / side));
          return { width, length, height: 2.8, unit: "m" };
        })()
      : { width: 4.8, length: 6.2, height: 2.8, unit: "m" };

  const palette: string[] = (Array.isArray(modA.palette) ? modA.palette : [])
    .map((p: any) => p?.hex)
    .filter((h: any) => typeof h === "string" && /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(h));
  const paletteOut = palette.length ? palette.slice(0, 5) : DEFAULT_PALETTE;

  const theme = (String(brief.style || (Array.isArray(modA.keywords) && modA.keywords[0]) || "现代").trim() || "现代").slice(0, 24);
  const mood = String(modA.styleSummary || (Array.isArray(modA.keywords) ? modA.keywords.join(" · ") : "")).slice(0, 24);

  // 拍平 HomePlan 的房间家具清单，补上 DesignScheme 需要的几何占位（position/rotation/scale）
  const flat: Array<{ category?: string; name?: string; brand?: string }> = [];
  const rooms = Array.isArray(plan.moduleB?.rooms) ? plan.moduleB.rooms : [];
  outer: for (const room of rooms) {
    for (const it of Array.isArray(room?.items) ? room.items : []) {
      flat.push(it);
      if (flat.length >= 12) break outer;
    }
  }
  if (!flat.length) {
    flat.push({ category: "沙发" }, { category: "茶几" }, { category: "电视柜" }, { category: "落地灯" });
  }

  const n = flat.length;
  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.5)));
  const furniture: FurnitureItem[] = flat.map((it, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    const cat = String(it.category || it.name || "家具").trim() || "家具";
    return {
      modelId: slug(cat + (it.brand ? "-" + it.brand : "")),
      name: [cat, it.brand].filter(Boolean).join(" ").slice(0, 20),
      position: { x: round1(col * 1.4), y: 0, z: round1(row * 1.4) },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 }
    };
  });

  const description =
    String(modA.styleSummary || (Array.isArray(brief.specialNeeds) ? brief.specialNeeds.join("；") : "") || "由 VirtuHome 方案码导入").slice(0, 200) ||
    "由 VirtuHome 方案码导入";

  return {
    version: "1.0",
    name,
    description,
    room: { type: roomType, dimensions },
    style: { theme, palette: paletteOut, mood },
    furniture
  };
}
