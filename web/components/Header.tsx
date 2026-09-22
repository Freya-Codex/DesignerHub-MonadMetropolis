"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ConnectButton } from "@rainbow-me/rainbowkit";

const NAV = [
  { href: "/", label: "画廊", en: "GALLERY" },
  { href: "/create", label: "创建", en: "CREATE" },
  { href: "/mint", label: "铸造", en: "MINT" },
  { href: "/trades", label: "交易", en: "TRADES" },
  { href: "/board", label: "排行榜", en: "BOARD" },
  { href: "/docs", label: "文档", en: "DOCS" }
];

export default function Header() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-ink/95 text-white backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-2 px-3 sm:gap-3 sm:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet shadow-glow">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2.5 15.5V2.5H15.5" stroke="white" strokeWidth="2.2" strokeLinecap="square" />
              <path d="M6.5 15.5V9.5H12.5V15.5" stroke="white" strokeWidth="1.4" opacity="0.72" />
            </svg>
          </span>
          <span className="hidden leading-none sm:block">
            <span className="display-sm block text-[15px]">云筑家</span>
            <span className="mono mt-1 block text-[9px] tracking-[0.2em] text-white/45">
              DREAMHOME · MONAD
            </span>
          </span>
        </Link>

        <nav className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:justify-end sm:gap-1">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative shrink-0 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition sm:px-3 sm:text-[13px] ${
                isActive(item.href) ? "text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-violet" />
              )}
            </Link>
          ))}
        </nav>

        <div className="shrink-0 [&_button]:!px-2.5 [&_button]:!text-[12px] sm:[&_button]:!px-4 sm:[&_button]:!text-[13.5px]">
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-violet/70 to-transparent" />
    </header>
  );
}
