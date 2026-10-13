import { createPublicClient, fallback, http, type PublicClient } from "viem";
import { monadTestnet } from "./chains";

/**
 * 服务端 RPC 提供方（Alchemy 优先，Envio HyperRPC 次之，公共 RPC 自动兜底）。
 *
 * ⚠️ 仅服务端使用：
 *   · 读取的 ALCHEMY_API_KEY / ENVIO_API_TOKEN 不带 NEXT_PUBLIC_ 前缀，
 *     Next.js 不会把它们内联进前端 bundle；
 *   · 前端（wagmi / publicClientFor / events.ts 尾部扫描）继续走公共 RPC，保证「前端零密钥」。
 *
 * 任何服务端读链的地方（relay、离线索引、活动聚合）都应从这里取 transport，
 * 而不是直接用 monadTestnet.rpcUrls.default.http[0]。
 *
 * Envio HyperRPC（https://monad-testnet.rpc.hypersync.xyz）是 Envio 为数据密集读
 * 设计的只读高吞吐 RPC；仅在配置了 ENVIO_API_TOKEN 时启用，且作为 fallback 链的一环，
 * 失败会自动降级到公共 RPC。
 */

const PUBLIC_RPC = monadTestnet.rpcUrls.default.http[0];

function alchemyHost(): string {
  return (process.env.ALCHEMY_MONAD_HOST || "https://monad-testnet.g.alchemy.com/v2").replace(/\/+$/, "");
}

export function alchemyApiKey(): string | undefined {
  const k = process.env.ALCHEMY_API_KEY?.trim();
  return k || undefined;
}

/** 解析出的 Alchemy RPC URL（无 Key 且无显式 URL 时返回 undefined）。 */
export function alchemyRpcUrl(): string | undefined {
  const explicit = process.env.ALCHEMY_RPC_URL?.trim();
  if (explicit) return explicit;
  const key = alchemyApiKey();
  return key ? `${alchemyHost()}/${key}` : undefined;
}

/** 是否已配置 Alchemy（服务端）。 */
export function usingAlchemy(): boolean {
  return Boolean(alchemyRpcUrl());
}

/** 是否已配置 Envio HyperRPC（服务端）。 */
export function usingHyperRpc(): boolean {
  return Boolean(envioHyperRpcUrl());
}

/** 解析出的 Envio HyperRPC URL（无 token 时返回 undefined）。 */
export function envioHyperRpcUrl(): string | undefined {
  const token = process.env.ENVIO_API_TOKEN?.trim();
  if (!token) return undefined;
  const base = (
    process.env.ENVIO_HYPERRPC_URL?.trim() || "https://monad-testnet.rpc.hypersync.xyz"
  ).replace(/\/+$/, "");
  return base;
}

/** 当前服务端首选 RPC（Alchemy 有则用，否则公共 RPC）。 */
export function serverRpcUrl(): string {
  return alchemyRpcUrl() ?? PUBLIC_RPC;
}

/** 可安全写进日志/接口响应的 RPC 标签（隐藏 API Key）。 */
export function safeRpcLabel(): string {
  const url = alchemyRpcUrl();
  if (url) return url.replace(/\/v2\/.+$/, "/v2/***");
  if (usingHyperRpc()) return "envio-hyperrpc (monad-testnet.rpc.hypersync.xyz)";
  return PUBLIC_RPC;
}

/**
 * 服务端 transport：Alchemy 优先 → Envio HyperRPC → 公共 RPC，任一层失败自动回退。
 * 这样即使某家未开通该网络 / 临时限流，站点也不会整体挂掉。
 */
export function serverTransport() {
  const transports = [];
  const alch = alchemyRpcUrl();
  if (alch) transports.push(http(alch));
  const hyper = envioHyperRpcUrl();
  if (hyper) {
    transports.push(
      http(hyper, {
        fetchOptions: {
          headers: { Authorization: `Bearer ${process.env.ENVIO_API_TOKEN!.trim()}` }
        }
      })
    );
  }
  transports.push(http(PUBLIC_RPC));
  // 只有一层时直接用它（避免多一层 fallback 包装）。
  return transports.length === 1 ? transports[0] : fallback(transports, { rank: false });
}

let _client: PublicClient | undefined;

/** 服务端只读 viem 客户端（Alchemy 优先 + 公共 RPC 兜底）。 */
export function serverPublicClient(): PublicClient {
  if (!_client) {
    _client = createPublicClient({ chain: monadTestnet, transport: serverTransport() });
  }
  return _client;
}
