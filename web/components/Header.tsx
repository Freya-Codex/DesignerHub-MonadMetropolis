"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";

export default function Header() {
  return (
    <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 text-white backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-indigo-500 to-purple-600 text-base">
            🛋
          </span>
          <span className="truncate text-sm font-bold">云筑家 · DreamHome</span>
          <span className="hidden rounded bg-emerald-400/10 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-300 sm:inline">
            Monad
          </span>
        </Link>
        <nav className="flex items-center gap-0.5 text-xs sm:gap-1 sm:text-sm">
          <Link href="/" className="rounded-lg px-2 py-1.5 font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
            画廊
          </Link>
          <Link href="/create" className="rounded-lg px-2 py-1.5 font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
            创建
          </Link>
          <Link href="/board" className="rounded-lg px-2 py-1.5 font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
            排行榜
          </Link>
          <Link href="/docs" className="rounded-lg px-2 py-1.5 font-medium text-zinc-300 hover:bg-white/10 hover:text-white">
            文档
          </Link>
          <div className="ml-1 [&>div]:!h-fit [&>div]:!bg-zinc-800">
            <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
          </div>
        </nav>
      </div>
    </header>
  );
}
