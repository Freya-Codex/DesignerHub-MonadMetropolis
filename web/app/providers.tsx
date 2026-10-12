"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { RainbowKitProvider, lightTheme } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { useEffect, useState } from "react";
import { config } from "@/lib/wagmi";
import { I18nProvider, useI18n } from "@/lib/i18n";

/** Monad 风格的钱包主题：紫罗兰主色 + 直角感 + 系统字体栈 */
const monadTheme = lightTheme({
  accentColor: "#6E54FF",
  accentColorForeground: "#FFFFFF",
  borderRadius: "medium",
  fontStack: "system",
  overlayBlur: "small"
});

/**
 * 根据语言切换 document.title / meta description。
 * （layout.tsx 是 Server Component，无法直接读取客户端语言，故在此同步。）
 */
function DocumentMeta() {
  const { lang } = useI18n();
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.title =
      lang === "en"
        ? "Designer Hub · Monad Creative Assets"
        : "Designer Hub · Monad 创作资产";
    const desc = document.querySelector('meta[name="description"]');
    if (desc) {
      desc.setAttribute(
        "content",
        lang === "en"
          ? "Turn interior design schemes into on-chain, remixable, attributable, revenue-sharing creative assets on Monad — the GitHub for home design."
          : "把装修设计方案变成 Monad 链上可 remix、可归因、可分账的创作资产 —— 家居设计界的 GitHub"
      );
    }
  }, [lang]);
  return null;
}

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());
  return (
    <I18nProvider>
      <WagmiProvider config={config}>
        <QueryClientProvider client={queryClient}>
          <RainbowKitProvider theme={monadTheme}>
            <DocumentMeta />
            {children}
          </RainbowKitProvider>
        </QueryClientProvider>
      </WagmiProvider>
    </I18nProvider>
  );
}
