"use client";

import { useEffect } from "react";
import { useI18n } from "@/lib/i18n";

/**
 * 页面级错误兜底：任何页面组件抛错时，不再显示 Next.js 默认的
 * “Application error: a client-side exception has occurred”，
 * 而是把**真实错误信息**显示出来（方便截图/复制反馈），并保留顶部导航。
 */
export default function Error({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t } = useI18n();

  useEffect(() => {
    console.error("[app/error] client exception:", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-2xl py-14">
      <p className="eyebrow">{t("Client error · 前端异常", "Client error")}</p>
      <h1 className="display mt-3 text-[26px] text-ink">
        {t("这个页面出错了", "Something went wrong on this page")}
      </h1>
      <p className="mt-3 text-sm leading-relaxed text-muted">
        {t(
          "已捕获错误信息（可直接截图 / 复制反馈给我们）：",
          "The error was captured (screenshot or copy it and send it to us):"
        )}
      </p>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap break-words rounded-xl border border-hairline bg-paper-2 p-4 text-xs text-[#a53f52]">
        {error?.message || "Unknown error"}
        {error?.digest ? `\n\ndigest: ${error.digest}` : ""}
      </pre>
      <div className="mt-5 flex gap-3">
        <button className="btn-primary" onClick={() => reset()}>
          {t("重试", "Retry")}
        </button>
        <button className="btn-secondary" onClick={() => window.location.reload()}>
          {t("刷新页面", "Reload page")}
        </button>
      </div>
    </div>
  );
}
