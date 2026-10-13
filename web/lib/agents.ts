/**
  * AI generator (agent) registry -- the single source of truth for "assign a different agentId per provider".
 *
  * Background: AgentRegistry's agentId auto-increments from 1 (0 is reserved for "no AI attribution").
  * The deployment script pre-registers Kimi as the first agent (agentId = 1) and Custom as the last (id 12).
  * This file maps common LLM providers to fixed agentIds so the front end, when minting / remixing /
  * attesting / displaying, can pick the matching id from the scheme's `generator.provider`, letting on-chain attribution
  * distinguish Kimi / Qwen / DeepSeek and others instead of hardcoding 1.
  * When a scheme declares no provider (or an unknown one), it falls back to Custom (id 12).
 *
  * Invariant (must hold): the order of `AGENTS` = the on-chain registration order, and `id` matches the registered
  * agentId one-to-one. When adding a provider, append it to the end and register it on-chain once
  * (see scripts/register-agents.ts); otherwise attest reverts because the agent is unregistered.
 */
import type { GeneratorInfo } from "./scheme";

export interface AgentDef {
  /** On-chain agentId (matches the AgentRegistry registration order). */
  id: bigint;
  /** Display name (e.g. "Kimi", "Qwen"). */
  name: string;
  /** Metadata URI used for on-chain registration. */
  metadataURI: string;
  /** Normalized (lowercase) provider keywords; multiple aliases may point to the same agent. */
  providers: string[];
}

const SITE = "https://designerhub.xyz/agents";

/** Canonical agent list. Order = on-chain registration order; Kimi is fixed at 1 (pre-registered by the deploy script). */
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

/** Kimi's agentId (kept under the old constant name for backward-compatible imports). */
export const KIMI_AGENT_ID = 1n;

/** Fallback agentId for an undeclared / unknown provider -- recorded as "Custom" (id 12). */
export const DEFAULT_AGENT_ID = 12n;

/** Provider keyword -> display name (consistent with VirtuHome's provider presets).
  *  One-to-one with the key set of AGENTS[*].providers; generatorLabel takes the display name from here. */
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

/** Provider keyword -> agentId (undeclared / unknown -> fallback Custom, id 12). */
export function agentIdForProvider(provider: string | undefined | null): bigint {
  if (!provider) return DEFAULT_AGENT_ID;
  return PROVIDER_TO_ID.get(provider.trim().toLowerCase()) ?? DEFAULT_AGENT_ID;
}

/** Scheme (with optional generator) -> agentId. Used for mint / remix / attest. */
export function agentIdForScheme(scheme: { generator?: GeneratorInfo } | null | undefined): bigint {
  return agentIdForProvider(scheme?.generator?.provider);
}

/** agentId -> display name (0 or unknown -> "" / "Agent #N"). */
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

/** agentId -> full definition (with metadataURI); returns undefined when unregistered. */
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
