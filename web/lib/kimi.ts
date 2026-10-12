export interface AdviceRequest {
  roomType?: string;
  dimensions?: { width: number; length: number; height: number; unit?: string };
  style?: string;
  palette?: string[];
  furniture?: Array<{ name?: string; nameEn?: string; modelId?: string }>;
  question?: string;
  /** 输出语言（默认 zh）。服务端路由会根据请求里的 lang 传入。 */
  lang?: "zh" | "en";
}

export function buildLocalAdvice(req: AdviceRequest): string {
  const en = req.lang === "en";
  const dim = req.dimensions;
  const size = dim ? `${dim.width}m × ${dim.length}m × ${dim.height}m` : en ? "unspecified" : "未指定";
  const furniture = (req.furniture ?? [])
    .slice(0, 12)
    .map((f, i) => `${i + 1}. ${(en ? f.nameEn ?? f.name : f.name) ?? f.modelId ?? (en ? "Unnamed furniture" : "未命名家具")}`)
    .join("\n");

  if (en) {
    return `[Local rules-engine advice (KIMI_API_KEY not configured)]

For your ${req.roomType ?? "room"} (${size}, style: ${req.style ?? "unspecified"}), here are some suggestions:

1. Circulation: keep at least 80cm between large furniture (sofa/bed) and the main walkway; place a desk to the side of the window to reduce glare.
2. Color: let the primary color ${req.palette?.[0] ?? "—"} take 60%, the secondary ${req.palette?.[1] ?? "—"} take 30%, and the accent ${req.palette?.[2] ?? "—"} take 10% for a softer, layered look.
3. Lighting: use a three-layer scheme — ambient + mood + task lighting. Use 4000K in reading/work areas and 2700K in rest areas.
4. Current furniture list:
${furniture}
5. Safety: anchor tall cabinets against tipping, add anti-slip pads under rugs, and keep outlets away from damp areas.

For more detailed AI advice, configure KIMI_API_KEY in web/.env.`;
  }

  return `【本地规则引擎建议（未配置 KIMI_API_KEY）】

针对您的${req.roomType ?? "房间"}（${size}，风格：${req.style ?? "未指定"}），给出以下建议：

1. 动线：沙发/床等大件家具与主通道保持 ≥ 80cm 间距；书桌朝向窗户侧方摆放可减少眩光。
2. 配色：主色 ${req.palette?.[0] ?? "—"} 占 60%，辅色 ${req.palette?.[1] ?? "—"} 占 30%，点缀色 ${req.palette?.[2] ?? "—"} 占 10%，层次更柔和。
3. 灯光：建议「主照明 + 氛围光 + 重点光」三层布光，阅读/办公区域色温 4000K，休息区 2700K。
4. 现有家具清单：
${furniture}
5. 安全：高柜固定防倾倒，地毯四角防滑，插座避开潮湿区。

要获得更精细的 AI 建议，请在 web/.env 中配置 KIMI_API_KEY。`;
}

export function buildKimiPrompt(req: AdviceRequest): string {
  const en = req.lang === "en";
  const dim = req.dimensions;
  const none = en ? "unspecified" : "未指定";
  if (en) {
    return [
      `Room type: ${req.roomType ?? none}`,
      `Dimensions: ${dim ? `${dim.width} x ${dim.length} x ${dim.height} m` : none}`,
      `Style: ${req.style ?? none}`,
      `Palette: ${(req.palette ?? []).join(", ") || none}`,
      `Furniture: ${(req.furniture ?? []).map((f) => f.nameEn ?? f.name ?? f.modelId).join(", ") || none}`,
      `User question: ${req.question ?? "Please give overall interior design advice"}`,
      "Reply in English with practical advice within 300 words (circulation, color, lighting, storage, cost-saving tips)."
    ].join("\n");
  }
  return [
    `房间类型：${req.roomType ?? "未指定"}`,
    `尺寸：${dim ? `${dim.width} x ${dim.length} x ${dim.height} m` : "未指定"}`,
    `风格：${req.style ?? "未指定"}`,
    `调色板：${(req.palette ?? []).join("、") || "未指定"}`,
    `家具：${(req.furniture ?? []).map((f) => f.name ?? f.modelId).join("、") || "未指定"}`,
    `用户问题：${req.question ?? "请给出整体装修建议"}`,
    "请用简体中文给出 300 字内的可落地建议（动线、配色、灯光、收纳、省钱点）。"
  ].join("\n");
}

/** Kimi system prompt by language. */
export function kimiSystemPrompt(lang: "zh" | "en" = "zh"): string {
  return lang === "en"
    ? "You are a senior interior designer, skilled in circulation planning, color, lighting and storage design. Answer in English, clearly and practically, within 300 words total."
    : "你是资深室内设计师，擅长动线规划、配色、灯光与收纳设计。回答使用简体中文，条理清晰、可落地，总字数不超过 300 字。";
}
