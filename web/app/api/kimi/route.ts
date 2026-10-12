import { NextRequest, NextResponse } from "next/server";
import { buildKimiPrompt, buildLocalAdvice, kimiSystemPrompt, type AdviceRequest } from "@/lib/kimi";
import { L, pickLang } from "@/lib/apiLang";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/kimi：转发装修建议请求到 Kimi API（未配置密钥时使用本地规则引擎）。 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdviceRequest & { lang?: string };
    const lang = pickLang(req, body as unknown as Record<string, unknown>);
    const req2: AdviceRequest = { ...body, lang };
    const apiKey = process.env.KIMI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ provider: "local", advice: buildLocalAdvice(req2) });
    }

    const res = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        temperature: 0.7,
        messages: [
          {
            role: "system",
            content: kimiSystemPrompt(lang)
          },
          { role: "user", content: buildKimiPrompt(req2) }
        ]
      })
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Kimi API error ${res.status}: ${text}`);
    }
    const json = JSON.parse(text) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const advice = json.choices?.[0]?.message?.content ?? "";
    if (!advice) throw new Error(L(lang, "Kimi 返回为空", "Kimi returned empty content"));

    return NextResponse.json({ provider: "kimi", model: json.model ?? "moonshot-v1-8k", advice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ error: `Failed to generate advice: ${message}` }, { status: 500 });
  }
}
