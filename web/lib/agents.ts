/**
 * AI 生成器（agent）注册表 —— 「按 provider 分配不同 agentId」的唯一事实来源。
 *
 * 背景：AgentRegistry 的 agentId 从 1 起自增（0 保留给「无 AI 归因」）。
 * 部署脚本预注册的第一个 agent 是 Kimi（agentId = 1），末尾是 Custom（id 12）。
 * 本文件把「常见的 LLM provider」映射到固定 agentId，前端在 mint / remix /
 * 存证 / 展示时依方案自带的 `generator.provider` 取到对应 id，从而让链上归因
 * 能区分 Kimi / Qwen / DeepSeek 等不同 AI，而不是一律写死 1。
 * 方案未声明 provider（或声明了未知 provider）时，兜底记为 Custom（id 12）。
 *
 * 不变式（务必保持）：`AGENTS` 的顺序 = 链上注册顺序，`id` 与注册得到的
 * agentId 一一对应。新增 provider 时，追加到末尾并到链上注册一次
 * （见 scripts/register-agents.ts），否则 attest 会因未注册而 revert。
 */
import type { GeneratorInfo } from "./scheme";

export interface AgentDef {
  /** 链上 agentId（与 AgentRegistry 注册顺序一致）。 */
  id: bigint;
  /** 展示名（如 "Kimi"、"Qwen"）。 */
  name: string;
  /** 链上注册用的元数据 URI。 */
  metadataURI: string;
  /** 归一化（小写）的 provider 关键词，可多个别名指向同一 agent。 */
  providers: string[];
}

const SITE = "https://designerhub.xyz/agents";

/** 规范 agent 列表。顺序 = 链上注册顺序；Kimi 固定为 1（部署脚本预注册）。 */
export const AGENTS: AgentDef[] = [
  { id: 1n, name: "Kimi", metadataURI: `${SITE}/kimi.json`, providers: ["kimi", "moonshot"] },
  { id: 2n, name: "Qwen", metadataURI: `${SITE}/qwen.json`, providers: ["qwen", "dashscope"] },
  { id: 3n, name: "DeepSeek", metadataURI: `${SITE}/deepseek.json`, providers: ["deepseek"] },
  { id: 4n, name: "Zhipu GLM", metadataURI: `${SITE}/zhipu.json`, providers: ["zhipu", "glm"] },
  { id: 5n, name: "SiliconFlow", metadataURI: `${SITE}/siliconflow.json`, providers: ["siliconflow"] },
  { id: 6n, name: "Volcengine Ark", metadataURI: `${SITE}/ark.json`, providers: ["ark"] },
  { id: 7n, name: "OpenRouter", metadataURI: `${SITE}/openrouter.json`, providers: ["openrouter"] },
  { id: 8n, name: "OpenAI", metadataURI: `${SITE}/openai.json`, providers: ["openai"] },
  { id: 9n, name: "Anthropic", metadataURI: `${SITE}/anthropic.json`, providers: ["anthropic", "claude"] },
  { id: 10n, name: "Google Gemini", metadataURI: `${SITE}/gemini.json`, providers: ["gemini"] },
  { id: 11n, name: "Agnes AI", metadataURI: `${SITE}/agnes.json`, providers: ["agnes"] },
  { id: 12n, name: "Custom", metadataURI: `${SITE}/custom.json`, providers: ["custom"] }
];

/** Kimi 的 agentId（保留旧常量名，兼容既有导入）。 */
export const KIMI_AGENT_ID = 1n;

/** 未声明 / 未知 provider 的兜底 agentId —— 记为“Custom”（id 12）。 */
export const DEFAULT_AGENT_ID = 12n;

/** provider 关键词 → 展示名（与 VirtuHome 的 provider 预设保持一致）。
 *  与 AGENTS[*].providers 的键集合一一对应；generatorLabel 从这里取展示名。 */
export const PROVIDER_LABELS: Record<string, string> = {
  kimi: "Kimi (Moonshot)",
  moonshot: "Kimi (Moonshot)",
  qwen: "DashScope (Qwen)",
  dashscope: "DashScope (Qwen)",
  deepseek: "DeepSeek",
  zhipu: "Zhipu GLM",
  glm: "Zhipu GLM",
  siliconflow: "SiliconFlow",
  ark: "Volcengine Ark",
  openrouter: "OpenRouter",
  openai: "OpenAI",
  anthropic: "Anthropic",
  claude: "Anthropic",
  gemini: "Google Gemini",
  agnes: "Agnes AI",
  custom: "Custom"
};

const PROVIDER_TO_ID = new Map<string, bigint>();
for (const a of AGENTS) {
  for (const p of a.providers) PROVIDER_TO_ID.set(p, a.id);
}

const ID_TO_NAME = new Map<string, string>(AGENTS.map((a) => [a.id.toString(), a.name]));

/** provider 关键词 → agentId（未声明 / 未知 → 兜底 Custom，id 12）。 */
export function agentIdForProvider(provider: string | undefined | null): bigint {
  if (!provider) return DEFAULT_AGENT_ID;
  return PROVIDER_TO_ID.get(provider.trim().toLowerCase()) ?? DEFAULT_AGENT_ID;
}

/** 方案（含可选 generator）→ agentId。用于 mint / remix / 存证。 */
export function agentIdForScheme(scheme: { generator?: GeneratorInfo } | null | undefined): bigint {
  return agentIdForProvider(scheme?.generator?.provider);
}

/** agentId → 展示名（0 或未知 → "" / "Agent #N"）。 */
export function agentNameForId(agentId: bigint | number | string | undefined | null): string {
  if (agentId === undefined || agentId === null) return "";
  let id: bigint;
  try {
    id = typeof agentId === "bigint" ? agentId : BigInt(agentId);
  } catch {
    return "";
  }
  if (id <= 0n) return "";
  return ID_TO_NAME.get(id.toString()) ?? `Agent #${id.toString()}`;
}

/** agentId → 完整定义（含 metadataURI），未登记则返回 undefined。 */
export function agentById(agentId: bigint | number | string | undefined | null): AgentDef | undefined {
  if (agentId === undefined || agentId === null) return undefined;
  let id: bigint;
  try {
    id = typeof agentId === "bigint" ? agentId : BigInt(agentId);
  } catch {
    return undefined;
  }
  return AGENTS.find((a) => a.id === id);
}
