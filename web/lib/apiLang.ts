/**
 * lib/apiLang.ts —— API 路由错误信息的多语言选择。
 *
 * 服务端不共享客户端 React 的语言状态，因此由客户端在请求里带上 lang
 * （查询参数 `?lang=en` 或 JSON body 的 `lang` 字段），路由据此挑选语言。
 */
import type { NextRequest } from "next/server";

export type ApiLang = "zh" | "en";

export function pickLang(req: NextRequest, body?: Record<string, unknown> | null): ApiLang {
  const fromQuery = req.nextUrl?.searchParams?.get("lang");
  const fromBody = typeof body?.lang === "string" ? body.lang : null;
  return (fromBody ?? fromQuery) === "en" ? "en" : "zh";
}

export function L(lang: ApiLang, zh: string, en: string): string {
  return lang === "en" ? en : zh;
}
