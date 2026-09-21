export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FurnitureItem {
  modelId: string;
  name?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface DesignScheme {
  version: string;
  name: string;
  description: string;
  room: {
    type: string;
    dimensions: { width: number; length: number; height: number; unit: string };
  };
  style: {
    theme: string;
    palette: string[];
    mood?: string;
  };
  furniture: FurnitureItem[];
  previewImage?: string;
  parentId?: number;
  license?: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  palette: string[];
  mood: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "nordic", label: "北欧风", palette: ["#F5F1E8", "#BEC9B3", "#D9C7A7", "#4A4A44", "#FFFFFF"], mood: "明亮通透 · 自然木色" },
  { id: "japanese", label: "日式原木", palette: ["#F2EEE6", "#D9C9A3", "#A67C52", "#5C5346", "#FFFFFF"], mood: "静谧侘寂 · 原木质感" },
  { id: "industrial", label: "工业风", palette: ["#2B2B2B", "#4D4D4D", "#B0B0B0", "#C77B3F", "#1A1A1A"], mood: "粗粝硬朗 · 金属水泥" },
  { id: "cream", label: "奶油风", palette: ["#FBF6EC", "#F3E3D3", "#E7C8A8", "#B98A68", "#FFFFFF"], mood: "温柔治愈 · 奶油色系" },
  { id: "newchinese", label: "新中式", palette: ["#F7F3EA", "#C2452B", "#8C7A5B", "#2F2B26", "#E4DBC9"], mood: "雅致东方 · 留白意境" },
  { id: "wabi", label: "极简侘寂", palette: ["#EDEAE3", "#D8D2C5", "#A69C8C", "#57534E", "#FAFAF7"], mood: "克制留白 · 时间感" }
];

export function themePresetByLabel(label: string | undefined): ThemePreset | undefined {
  if (!label) return undefined;
  return THEME_PRESETS.find((t) => t.label === label || t.id === label);
}

export function validateScheme(value: unknown): string | null {
  if (!value || typeof value !== "object") return "方案必须是 JSON 对象";
  const s = value as DesignScheme;
  if (typeof s.name !== "string" || s.name.trim().length < 1 || s.name.trim().length > 60) {
    return "name 需要是 1-60 字符的字符串";
  }
  if (!s.room || typeof s.room.type !== "string" || !s.room.type.trim()) {
    return "room.type（房间类型）不能为空";
  }
  const dim = s.room?.dimensions;
  if (
    !dim ||
    typeof dim.width !== "number" ||
    typeof dim.length !== "number" ||
    typeof dim.height !== "number" ||
    dim.width <= 0 ||
    dim.length <= 0 ||
    dim.height <= 0
  ) {
    return "room.dimensions 需要包含正数 width/length/height";
  }
  if (!s.style || typeof s.style.theme !== "string" || !Array.isArray(s.style.palette) || s.style.palette.length === 0) {
    return "style.theme 与 style.palette（调色板数组）不能为空";
  }
  if (!Array.isArray(s.furniture) || s.furniture.length < 1 || s.furniture.length > 50) {
    return "furniture 需要是包含 1-50 件家具的数组";
  }
  for (let i = 0; i < s.furniture.length; i++) {
    const f = s.furniture[i];
    if (!f || typeof f !== "object") return `furniture[${i}] 需要是对象`;
    if (typeof f.modelId !== "string" || !f.modelId.trim()) return `furniture[${i}].modelId 不能为空`;
    for (const axis of ["position", "rotation", "scale"] as const) {
      const v = f[axis];
      if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.z !== "number") {
        return `furniture[${i}].${axis} 需要包含数字 x/y/z`;
      }
    }
  }
  return null;
}

export interface RemixOptions {
  themeId?: string;
  palette?: string[];
  furnitureCount?: number;
  note?: string;
}

/** 基于原方案生成 remix 版本（不会修改原对象）。 */
export function applyRemixStyle(base: DesignScheme, opts: RemixOptions): DesignScheme {
  const out: DesignScheme = JSON.parse(JSON.stringify(base));
  const theme = THEME_PRESETS.find((t) => t.id === opts.themeId);
  if (theme) {
    out.style.theme = theme.label;
    out.style.palette = [...theme.palette];
    out.style.mood = theme.mood;
  } else if (opts.palette && opts.palette.length > 0) {
    out.style.palette = [...opts.palette];
  }

  const target = Math.max(3, Math.min(12, opts.furnitureCount ?? out.furniture.length));
  while (out.furniture.length < target) {
    const last = out.furniture[out.furniture.length - 1];
    const copy: FurnitureItem = {
      ...JSON.parse(JSON.stringify(last)),
      name: `${last.name ?? last.modelId}（副本）`,
      position: {
        x: Math.round((last.position.x + 1.2) * 10) / 10,
        y: last.position.y,
        z: last.position.z
      }
    };
    out.furniture.push(copy);
  }
  if (out.furniture.length > target) {
    out.furniture = out.furniture.slice(0, target);
  }

  const themeLabel = theme?.label ?? out.style.theme;
  out.name = out.name.includes("·Remix") ? out.name : `${out.name}·Remix`;
  out.description = `${base.description}（本次 remix：${themeLabel}风格 / ${target} 件家具${opts.note ? ` / ${opts.note}` : ""}）`;
  out.license = "CC-BY 4.0";
  out.previewImage = undefined;
  return out;
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

/** 根据方案数据生成一张 SVG 预览占位图。 */
export function schemeToPreviewSvg(s: DesignScheme): string {
  const pal = s.style.palette;
  const wall = pal[0] ?? "#F2EFE9";
  const floor = pal[1] ?? "#D9CDB8";
  const accent = pal[2] ?? "#8FA98F";
  const dark = pal[3] ?? "#4A4A44";

  const n = Math.max(1, Math.min(s.furniture.length <= 0 ? 5 : s.furniture.length, 12));
  const rects: string[] = [];
  const colors = [accent, dark, pal[2] ?? accent, pal[4] ?? "#FFFFFF"];
  for (let i = 0; i < n; i++) {
    const col = i % 4;
    const fill = col === 3 ? "#E8E4DA" : colors[col];
    const x = 110 + (i * 740) / Math.max(n - 1, 1);
    const y = 230 + (i % 3) * 120;
    const w = 96 + ((i * 53) % 90);
    const h = 56 + ((i * 37) % 52);
    const rx = Math.min(16, Math.floor(h / 3));
    rects.push(
      `<rect x="${Math.round(x)}" y="${Math.round(y)}" width="${Math.round(w)}" height="${Math.round(h)}" rx="${rx}" fill="${fill}" stroke="${dark}" stroke-opacity="0.25" stroke-width="3"/>`
    );
    if (n > 6) {
      rects.push(
        `<rect x="${Math.round(x + w / 2 - 20)}" y="${Math.round(y + h / 2 - 6)}" width="40" height="10" rx="5" fill="#FFFFFF" opacity="0.55"/>`
      );
    }
  }

  const dim = `${s.room.dimensions.width}m × ${s.room.dimensions.length}m`;
  const paletteDots = pal
    .slice(0, 5)
    .map(
      (c, i) =>
        `<circle cx="${96 + i * 40}" cy="700" r="14" fill="${c}" stroke="${dark}" stroke-opacity="0.3" stroke-width="2"/>`
    )
    .join("\n    ");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768">
  <defs>
    <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${wall}"/><stop offset="1" stop-color="${lighten(wall)}"/>
    </linearGradient>
    <linearGradient id="f" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="${floor}"/><stop offset="1" stop-color="${darken(floor)}"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="768" fill="url(#w)"/>
  <rect y="470" width="1024" height="298" fill="url(#f)"/>
  <rect x="60" y="60" width="360" height="78" rx="18" fill="#FFFFFF" opacity="0.88"/>
  <text x="88" y="112" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" font-size="38" font-weight="700" fill="${dark}">${esc(s.name)}</text>
  <text x="900" y="120" text-anchor="end" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" font-size="24" fill="${dark}" opacity="0.75">${esc(dim)}</text>
  <g>
${rects.join("\n")}
  </g>
  <g>
${paletteDots}
    <text x="330" y="708" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" font-size="24" fill="${dark}">${esc(s.style.theme)} · ${s.furniture.length} 件家具 · ${esc(s.style.mood ?? "")}</text>
    <text x="972" y="708" text-anchor="end" font-family="PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif" font-size="22" fill="${dark}" opacity="0.7">云筑家 · DreamHome</text>
  </g>
</svg>`;
}

function lighten(hex: string): string {
  return shade(hex, 0.12);
}
function darken(hex: string): string {
  return shade(hex, -0.12);
}
function shade(hex: string, amount: number): string {
  const m = hex.replace("#", "");
  if (!/^[0-9a-fA-F]{6}$/.test(m)) return hex;
  const num = parseInt(m, 16);
  const r = clamp255((num >> 16) + Math.round(255 * amount));
  const g = clamp255(((num >> 8) & 0xff) + Math.round(255 * amount));
  const b = clamp255((num & 0xff) + Math.round(255 * amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}
function clamp255(v: number): number {
  return Math.max(0, Math.min(255, v));
}

export function svgToDataUri(svg: string): string {
  const bytes = new TextEncoder().encode(svg);
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return `data:image/svg+xml;base64,${btoa(bin)}`;
}

export function shortAddress(addr: string | undefined, size = 6): string {
  if (!addr) return "—";
  if (addr.length <= 2 + size * 2) return addr;
  return `${addr.slice(0, 2 + size)}…${addr.slice(-size)}`;
}

export function formatWeiToMon(wei: bigint): string {
  return (Number(wei) / 1e18).toFixed(2);
}
