/**
  * lib/apiLang.ts -- language selection for API route error messages.
 *
  * The server does not share the client React language state, so the client sends lang with the request
  * (query param `?lang=en` or the JSON body's `lang` field), and the route picks the language from it.
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
