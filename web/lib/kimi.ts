export interface AdviceRequest {
  roomType?: string;
  dimensions?: { width: number; length: number; height: number; unit?: string };
  style?: string;
  palette?: string[];
  furniture?: Array<{ name?: string; modelId?: string }>;
  question?: string;
}

export function buildLocalAdvice(req: AdviceRequest): string {
  const dim = req.dimensions;
  const size = dim ? `${dim.width}m × ${dim.length}m × ${dim.height}m` : "未指定";
  const furniture = (req.furniture ?? [])
    .slice(0, 12)
    .map((f, i) => `${i + 1}. ${f.name ?? f.modelId ?? "未命名家具"}`)
    .join("\n");
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
  const dim = req.dimensions;
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
