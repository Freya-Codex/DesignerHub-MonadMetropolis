import { NextRequest, NextResponse } from "next/server";
import { buildKimiPrompt, buildLocalAdvice, type AdviceRequest } from "@/lib/kimi";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST /api/kimi：转发装修建议请求到 Kimi API（未配置密钥时使用本地规则引擎）。 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as AdviceRequest;
    const apiKey = process.env.KIMI_API_KEY;

    if (!apiKey) {
      return NextResponse.json({ provider: "local", advice: buildLocalAdvice(body) });
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
            content:
              "你是资深室内设计师，擅长动线规划、配色、灯光与收纳设计。回答使用简体中文，条理清晰、可落地，总字数不超过 300 字。"
          },
          { role: "user", content: buildKimiPrompt(body) }
        ]
      })
    });

    const text = await res.text();
    if (!res.ok) {
      throw new Error(`Kimi API 错误 ${res.status}: ${text}`);
    }
    const json = JSON.parse(text) as { model?: string; choices?: Array<{ message?: { content?: string } }> };
    const advice = json.choices?.[0]?.message?.content ?? "";
    if (!advice) throw new Error("Kimi 返回为空");

    return NextResponse.json({ provider: "kimi", model: json.model ?? "moonshot-v1-8k", advice });
  } catch (e) {
    const message = e instanceof Error ? e.message : "未知错误";
    return NextResponse.json({ error: `装修建议生成失败：${message}` }, { status: 500 });
  }
}
