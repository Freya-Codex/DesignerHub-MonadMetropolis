import { keccak256, toBytes, type Hex } from "viem";

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export interface FurnitureItem {
  modelId: string;
  name?: string;
  /** 英文名（可选，双语展示用） */
  nameEn?: string;
  position: Vec3;
  rotation: Vec3;
  scale: Vec3;
}

export interface DesignScheme {
  version: string;
  name: string;
  /** 英文名（可选，双语展示用） */
  nameEn?: string;
  description: string;
  /** 英文描述（可选，双语展示用） */
  descriptionEn?: string;
  room: {
    type: string;
    /** 英文房间类型（可选） */
    typeEn?: string;
    dimensions: { width: number; length: number; height: number; unit: string };
  };
  style: {
    theme: string;
    /** 英文风格名（可选） */
    themeEn?: string;
    palette: string[];
    mood?: string;
    /** 英文氛围描述（可选） */
    moodEn?: string;
  };
  furniture: FurnitureItem[];
  previewImage?: string;
  parentId?: number;
  license?: string;
  /** 方案由哪个 AI 生成（随 JSON / 方案码导入）——provider + 模型名。 */
  generator?: GeneratorInfo;
}

/** 方案的 AI 生成器信息（provider 为 providerId，不记录 baseUrl / apiKey）。 */
export interface GeneratorInfo {
  provider?: string;
  model?: string;
  /** 生成时间（ISO 字符串）。 */
  at?: string;
}

export interface ThemePreset {
  id: string;
  label: string;
  labelEn: string;
  palette: string[];
  mood: string;
  moodEn: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: "nordic", label: "北欧风", labelEn: "Nordic", palette: ["#F5F1E8", "#BEC9B3", "#D9C7A7", "#4A4A44", "#FFFFFF"], mood: "明亮通透 · 自然木色", moodEn: "Bright & airy · natural wood tones" },
  { id: "japanese", label: "日式原木", labelEn: "Japanese Wood", palette: ["#F2EEE6", "#D9C9A3", "#A67C52", "#5C5346", "#FFFFFF"], mood: "静谧侘寂 · 原木质感", moodEn: "Quiet wabi-sabi · raw wood texture" },
  { id: "industrial", label: "工业风", labelEn: "Industrial", palette: ["#2B2B2B", "#4D4D4D", "#B0B0B0", "#C77B3F", "#1A1A1A"], mood: "粗粝硬朗 · 金属水泥", moodEn: "Rugged & bold · metal and concrete" },
  { id: "cream", label: "奶油风", labelEn: "Cream", palette: ["#FBF6EC", "#F3E3D3", "#E7C8A8", "#B98A68", "#FFFFFF"], mood: "温柔治愈 · 奶油色系", moodEn: "Soft & soothing · cream palette" },
  { id: "newchinese", label: "新中式", labelEn: "New Chinese", palette: ["#F7F3EA", "#C2452B", "#8C7A5B", "#2F2B26", "#E4DBC9"], mood: "雅致东方 · 留白意境", moodEn: "Elegant Eastern · mindful negative space" },
  { id: "wabi", label: "极简侘寂", labelEn: "Minimal Wabi-Sabi", palette: ["#EDEAE3", "#D8D2C5", "#A69C8C", "#57534E", "#FAFAF7"], mood: "克制留白 · 时间感", moodEn: "Restrained, spacious · sense of time" }
];

export function themePresetByLabel(label: string | undefined): ThemePreset | undefined {
  if (!label) return undefined;
  return THEME_PRESETS.find((t) => t.label === label || t.id === label);
}

export function validateScheme(value: unknown, lang: "zh" | "en" = "zh"): string | null {
  const en = lang === "en";
  if (!value || typeof value !== "object") return en ? "Scheme must be a JSON object" : "方案必须是 JSON 对象";
  const s = value as DesignScheme;
  if (typeof s.name !== "string" || s.name.trim().length < 1 || s.name.trim().length > 60) {
    return en ? "name must be a string of 1–60 characters" : "name 需要是 1-60 字符的字符串";
  }
  if (!s.room || typeof s.room.type !== "string" || !s.room.type.trim()) {
    return en ? "room.type (room type) cannot be empty" : "room.type（房间类型）不能为空";
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
    return en
      ? "room.dimensions must contain positive width/length/height"
      : "room.dimensions 需要包含正数 width/length/height";
  }
  if (!s.style || typeof s.style.theme !== "string" || !Array.isArray(s.style.palette) || s.style.palette.length === 0) {
    return en
      ? "style.theme and style.palette (palette array) cannot be empty"
      : "style.theme 与 style.palette（调色板数组）不能为空";
  }
  if (!Array.isArray(s.furniture) || s.furniture.length < 1 || s.furniture.length > 50) {
    return en ? "furniture must be an array of 1–50 items" : "furniture 需要是包含 1-50 件家具的数组";
  }
  for (let i = 0; i < s.furniture.length; i++) {
    const f = s.furniture[i];
    if (!f || typeof f !== "object") return en ? `furniture[${i}] must be an object` : `furniture[${i}] 需要是对象`;
    if (typeof f.modelId !== "string" || !f.modelId.trim())
      return en ? `furniture[${i}].modelId cannot be empty` : `furniture[${i}].modelId 不能为空`;
    for (const axis of ["position", "rotation", "scale"] as const) {
      const v = f[axis];
      if (!v || typeof v.x !== "number" || typeof v.y !== "number" || typeof v.z !== "number") {
        return en
          ? `furniture[${i}].${axis} must contain numeric x/y/z`
          : `furniture[${i}].${axis} 需要包含数字 x/y/z`;
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
export function applyRemixStyle(base: DesignScheme, opts: RemixOptions, lang: "zh" | "en" = "zh"): DesignScheme {
  const en = lang === "en";
  const out: DesignScheme = JSON.parse(JSON.stringify(base));
  const theme = THEME_PRESETS.find((t) => t.id === opts.themeId);
  if (theme) {
    out.style.theme = theme.label;
    out.style.themeEn = theme.labelEn;
    out.style.palette = [...theme.palette];
    out.style.mood = theme.mood;
    out.style.moodEn = theme.moodEn;
  } else if (opts.palette && opts.palette.length > 0) {
    out.style.palette = [...opts.palette];
  }

  const target = Math.max(3, Math.min(12, opts.furnitureCount ?? out.furniture.length));
  while (out.furniture.length < target) {
    const last = out.furniture[out.furniture.length - 1];
    const copy: FurnitureItem = {
      ...JSON.parse(JSON.stringify(last)),
      name: `${last.name ?? last.modelId}${en ? " (copy)" : "（副本）"}`,
      nameEn: `${last.nameEn ?? last.name ?? last.modelId} (copy)`,
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
  const themeLabelEn = theme?.labelEn ?? out.style.themeEn ?? out.style.theme;
  out.name = out.name.includes("·Remix") ? out.name : `${out.name}·Remix`;
  out.nameEn = out.nameEn ? out.nameEn : `${base.nameEn ?? base.name} · Remix`;
  out.description = en
    ? `${base.descriptionEn ?? base.description} (this remix: ${themeLabelEn} style / ${target} items${opts.note ? ` / ${opts.note}` : ""})`
    : `${base.description}（本次 remix：${themeLabel}风格 / ${target} 件家具${opts.note ? ` / ${opts.note}` : ""}）`;
  out.descriptionEn = `${base.descriptionEn ?? base.description} (this remix: ${themeLabelEn} style / ${target} items${opts.note ? ` / ${opts.note}` : ""})`;
  out.license = "CC-BY 4.0";
  out.previewImage = undefined;
  return out;
}

function esc(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const SVG_DISPLAY = "Archivo, PingFang SC, Hiragino Sans GB, Microsoft YaHei, sans-serif";
const SVG_MONO = "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace";

/**
 * 自动生成预览图：以「蓝图施工图」语言绘制房间平面。
 * 房间尺寸、家具数量、调色板全部来自方案数据，尺寸线标注真实尺寸。
 */
export function schemeToPreviewSvg(s: DesignScheme, lang: "zh" | "en" = "zh"): string {
  const en = lang === "en";
  const pal = s.style.palette;
  const accent = pal[2] ?? "#6E54FF";
  const ink = "#0F0F12";
  const muted = "#727285";
  const violet = "#6E54FF";

  // 内容字段：按语言优先取英文（缺失时回落中文）
  const nm = en ? s.nameEn ?? s.name : s.name;
  const roomTypeLabel = en ? s.room.typeEn ?? s.room.type : s.room.type;
  const themeLabel = en ? s.style.themeEn ?? s.style.theme : s.style.theme;
  const moodLabel = en ? s.style.moodEn ?? s.style.mood ?? "" : s.style.mood ?? "";

  // 图纸：房间平面范围
  const RX = 176;
  const RY = 252;
  const RW = 672;
  const RH = 336;

  // 家具按网格排布，尺寸受 scale 影响（数据驱动）
  const items = s.furniture.slice(0, 12);
  const n = Math.max(items.length, 1);
  const cols = Math.max(2, Math.ceil(Math.sqrt(n * 1.5)));
  const rows = Math.ceil(n / cols);
  const cellW = RW / cols;
  const cellH = RH / rows;

  const blocks = items
    .map((f, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const sx = Math.min(Math.max(f.scale?.x ?? 1, 0.6), 1.5);
      const sz = Math.min(Math.max(f.scale?.z ?? 1, 0.6), 1.5);
      const w = Math.min(cellW * 0.5 * sx, cellW * 0.72);
      const h = Math.min(cellH * 0.5 * sz, cellH * 0.62);
      const cx = RX + cellW * (col + 0.5);
      const cy = RY + cellH * (row + 0.5);
      const x = Math.round(cx - w / 2);
      const y = Math.round(cy - h / 2);
      const fill = pal[(i % Math.max(pal.length, 1))] ?? accent;
      const label = esc(((en ? f.nameEn ?? f.name : f.name) ?? f.modelId).slice(0, 10));
      return `    <g>
      <rect x="${x}" y="${y}" width="${Math.round(w)}" height="${Math.round(h)}" rx="3" fill="${fill}" fill-opacity="0.5" stroke="${ink}" stroke-opacity="0.55" stroke-width="1.4"/>
      <text x="${Math.round(cx)}" y="${Math.min(Math.round(cy + h / 2 + 15), RY + RH - 10)}" text-anchor="middle" font-family="${SVG_MONO}" font-size="10.5" fill="${muted}">${label}</text>
    </g>`;
    })
    .join("\n");

  const dim = s.room.dimensions;
  const swatches = pal
    .slice(0, 5)
    .map(
      (c, i) =>
        `<rect x="${64 + i * 26}" y="668" width="20" height="20" fill="${c}" stroke="${ink}" stroke-opacity="0.25"/>`
    )
    .join("");

  const grid = Array.from({ length: 24 }, (_, i) => {
    const x = i * 44;
    return `<line x1="${x}" y1="0" x2="${x}" y2="768" stroke="${violet}" stroke-opacity="0.05" stroke-width="1"/>`;
  }).join("");
  const gridH = Array.from({ length: 18 }, (_, i) => {
    const y = i * 44;
    return `<line x1="0" y1="${y}" x2="1024" y2="${y}" stroke="${violet}" stroke-opacity="0.05" stroke-width="1"/>`;
  }).join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 768" width="1024" height="768" role="img" aria-label="${esc(nm)} ${en ? "floor plan preview" : "平面预览图"}">
  <rect width="1024" height="768" fill="#FBFAF9"/>
  <g>${grid}${gridH}</g>
  <rect x="24" y="24" width="976" height="720" fill="none" stroke="${ink}" stroke-opacity="0.5" stroke-width="1.5"/>
  <path d="M24 44 H44 M24 24 V44" stroke="${violet}" stroke-width="2.5" fill="none"/>
  <path d="M1000 724 H980 M1000 744 V724" stroke="${violet}" stroke-width="2.5" fill="none"/>

  <rect x="${RX}" y="${RY}" width="${RW}" height="${RH}" fill="${pal[0] ?? "#FFFFFF"}" fill-opacity="0.45" stroke="${ink}" stroke-width="2"/>

  <g>
${blocks}
  </g>

  <g stroke="${violet}" stroke-width="1.4" fill="none">
    <path d="M${RX} ${RY - 34} H${RX + RW}"/>
    <path d="M${RX} ${RY - 40} V${RY - 28}"/>
    <path d="M${RX + RW} ${RY - 40} V${RY - 28}"/>
    <path d="M${RX - 34} ${RY} V${RY + RH}"/>
    <path d="M${RX - 40} ${RY} H${RX - 28}"/>
    <path d="M${RX - 40} ${RY + RH} H${RX - 28}"/>
  </g>
  <text x="${RX + RW / 2}" y="${RY - 42}" text-anchor="middle" font-family="${SVG_MONO}" font-size="14" fill="${ink}">${dim.width} m</text>
  <text x="${RX - 46}" y="${RY + RH / 2}" text-anchor="middle" font-family="${SVG_MONO}" font-size="14" fill="${ink}" transform="rotate(-90 ${RX - 46} ${RY + RH / 2})">${dim.length} m</text>

  <text x="64" y="90" font-family="${SVG_MONO}" font-size="12" letter-spacing="2.4" fill="${muted}">FLOOR PLAN · ${esc(roomTypeLabel)} · SCALE 1:50</text>
  <text x="64" y="140" font-family="${SVG_DISPLAY}" font-size="40" font-weight="800" letter-spacing="-1.4" fill="${ink}">${esc(nm.slice(0, 22))}</text>
  <text x="64" y="172" font-family="${SVG_MONO}" font-size="13" fill="${muted}">${esc(themeLabel)} · ${s.furniture.length} ${en ? "items" : "件家具"} · ${dim.width}×${dim.length}×${dim.height} m</text>

  ${swatches}
  <text x="216" y="684" font-family="${SVG_MONO}" font-size="11.5" fill="${muted}">${esc(moodLabel.slice(0, 24))}</text>
  <text x="960" y="684" text-anchor="end" font-family="${SVG_MONO}" font-size="11.5" letter-spacing="1.6" fill="${muted}">DESIGNER HUB</text>
</svg>`;
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

/**
 * 方案内容哈希 = keccak256(JSON 字符串)，与 /api/pin 服务端算法完全一致。
 * 用于铸造前检测「同一方案是否已被铸造」（仅原创路径去重；remix 允许重复）。
 */
export function contentHashOfScheme(scheme: DesignScheme): Hex {
  return keccak256(toBytes(JSON.stringify(scheme)));
}

/** providerId → 展示名（与 VirtuHome 的 provider 预设保持一致）。 */
const GENERATOR_PROVIDER_NAMES: Record<string, string> = {
  kimi: "Kimi (Moonshot)",
  moonshot: "Kimi (Moonshot)",
  deepseek: "DeepSeek",
  siliconflow: "SiliconFlow",
  dashscope: "DashScope (Qwen)",
  qwen: "DashScope (Qwen)",
  zhipu: "Zhipu GLM",
  glm: "Zhipu GLM",
  ark: "Volcengine Ark",
  openrouter: "OpenRouter",
  agnes: "Agnes AI",
  openai: "OpenAI",
  anthropic: "Anthropic",
  claude: "Anthropic",
  gemini: "Google Gemini",
  custom: "Custom"
};

/** 生成器展示名：优先 provider 展示名，后缀模型名。全空返回 ""。 */
export function generatorLabel(gen: GeneratorInfo | undefined): string {
  if (!gen) return "";
  const provider = gen.provider ? GENERATOR_PROVIDER_NAMES[gen.provider.toLowerCase()] ?? gen.provider : "";
  const model = gen.model?.trim() ?? "";
  if (provider && model) return `${provider} · ${model}`;
  return provider || model;
}
