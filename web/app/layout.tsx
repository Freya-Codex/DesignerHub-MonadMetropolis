import type { Metadata, Viewport } from "next";
import Link from "next/link";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";

export const metadata: Metadata = {
  title: "VirtuHome · Monad 创作资产",
  description:
    "把装修设计方案变成 Monad 链上可 remix、可归因、可分账的创作资产 —— 家居设计界的 GitHub",
  icons: { icon: "/favicon.svg" }
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0F0F12"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-paper text-ink antialiased">
        <Providers>
          <Header />
          <main className="mx-auto w-full max-w-6xl px-4 pb-24 pt-8">{children}</main>
          <footer className="hairline-t">
            <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[11px] sm:flex-row sm:items-center sm:justify-between">
              <p className="mono text-muted">
                CHAIN 10143 · MONAD TESTNET · ERC-721 + ERC-2981 · IPFS
              </p>
              <nav className="mono flex flex-wrap items-center gap-4 text-muted">
                <a className="transition hover:text-violet-deep" href="https://testnet-rpc.monad.xyz" target="_blank" rel="noreferrer">
                  RPC
                </a>
                <a className="transition hover:text-violet-deep" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
                  水龙头
                </a>
                <a className="transition hover:text-violet-deep" href="https://testnet.monadexplorer.com" target="_blank" rel="noreferrer">
                  浏览器
                </a>
                <Link className="transition hover:text-violet-deep" href="/docs">
                  玩法文档
                </Link>
              </nav>
            </div>
          </footer>
        </Providers>
      </body>
    </html>
  );
}
