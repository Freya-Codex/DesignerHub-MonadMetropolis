"use client";

import { useEffect } from "react";

/**
 * 全局错误兜底：捕获**根 layout**（含 Providers / Header / 连接钱包按钮）抛出的异常。
 * 生产构建下，若没有这个文件，layout 里抛错会退化成 Next.js 默认的纯白
 * “Application error: a client-side exception has occurred”，看不到任何原因。
 *
 * 注意：global-error 会替换整个 <html>/<body>，不会加载 layout 里的全局 CSS，
 * 所以这里用内联样式，保证在任何情况下都能显示。
 */
export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[app/global-error] root exception:", error);
  }, [error]);

  return (
    <html lang="zh-CN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          background: "#FBFAF7",
          color: "#141319",
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", sans-serif'
        }}
      >
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "56px 20px" }}>
          <p
            style={{
              margin: 0,
              fontSize: 11,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#6E54FF",
              fontWeight: 700
            }}
          >
            Client error · 前端异常
          </p>
          <h1 style={{ margin: "12px 0 0", fontSize: 26, fontWeight: 700 }}>
            Designer Hub 运行出错了
          </h1>
          <p style={{ margin: "14px 0 0", fontSize: 14, color: "#5a5866", lineHeight: 1.6 }}>
            已捕获到真实错误信息，请把下面这段文字（可截图）发给开发者，即可定位：
          </p>
          <pre
            style={{
              marginTop: 12,
              padding: 16,
              borderRadius: 12,
              border: "1px solid #E6E3DD",
              background: "#F3F1EC",
              color: "#A53F52",
              fontSize: 12,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
              overflowX: "auto"
            }}
          >
            {error?.message || "Unknown error"}
            {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
          </pre>
          <div style={{ marginTop: 20, display: "flex", gap: 12 }}>
            <button
              onClick={() => reset()}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "none",
                background: "#6E54FF",
                color: "#fff",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              重试
            </button>
            <button
              onClick={() => window.location.reload()}
              style={{
                padding: "10px 18px",
                borderRadius: 10,
                border: "1px solid #D8D4CC",
                background: "#fff",
                color: "#141319",
                fontSize: 14,
                fontWeight: 600,
                cursor: "pointer"
              }}
            >
              刷新页面
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
