import type { Metadata, Viewport } from "next";
import "./globals.css";
import Providers from "./providers";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Designer Hub · Monad 创作资产",
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
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
