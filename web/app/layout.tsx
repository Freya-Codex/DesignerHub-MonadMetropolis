import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "云筑家 · DreamHome on Monad",
  description:
    "把装修设计方案变成 Monad 链上可 remix、可归因、可分账的创作资产 —— 家居设计界的 GitHub",
  icons: { icon: "/favicon.svg" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-6">{children}</main>
          <footer className="mx-auto max-w-6xl border-t border-zinc-200 px-4 py-6 text-center text-xs text-zinc-400">
            云筑家 · DreamHome——Monad 黑客松 Social / Attention / Culture 赛道 · 装修方案即创作资产
          </footer>
        </Providers>
      </body>
    </html>
  );
}
