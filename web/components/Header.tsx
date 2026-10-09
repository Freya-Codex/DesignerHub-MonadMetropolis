"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import {
  isAccountDeployed,
  loadStoredPasskey,
  onPasskeyChange,
  passkeyAccountAddress
} from "@/lib/passkeyAccount";

const NAV = [
  { href: "/demo", label: "画廊", en: "GALLERY" },
  { href: "/mint", label: "铸造", en: "MINT" },
  { href: "/trades", label: "交易", en: "TRADES" },
  { href: "/board", label: "排行榜", en: "BOARD" },
  { href: "/docs", label: "文档", en: "DOCS" }
];

export default function Header() {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/mint" ? pathname === "/mint" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-ink/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 px-3 py-1.5 sm:h-16 sm:flex-nowrap sm:gap-x-3 sm:py-0 sm:px-4">
        <Link href="/demo" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-violet shadow-glow sm:h-9 sm:w-9">
            <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
              <path d="M2.5 15.5V2.5H15.5" stroke="white" strokeWidth="2.2" strokeLinecap="square" />
              <path d="M6.5 15.5V9.5H12.5V15.5" stroke="white" strokeWidth="1.4" opacity="0.72" />
            </svg>
          </span>
          <span className="leading-none">
            <span className="display-sm block text-[15px]">Designer Hub</span>
            <span className="mono mt-1 hidden text-[9px] tracking-[0.2em] text-white/45 sm:block">
              DESIGNER HUB · MONAD
            </span>
          </span>
        </Link>

        <nav className="order-last -mx-3 flex w-full min-w-0 items-center gap-0.5 overflow-x-auto border-t border-white/10 px-3 pt-1 sm:order-none sm:mx-0 sm:w-auto sm:flex-1 sm:justify-end sm:gap-1 sm:border-t-0 sm:px-0 sm:pt-0">
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

        <div className="ml-auto shrink-0 sm:ml-0">
          <PasskeyControl />
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-violet/70 to-transparent" />
    </header>
  );
}

/**
 * 右上角单一 Passkey 控件：替代原先的「连接钱包」。
 * 未创建 → 引导创建；已创建 → 显示 passkey 账户短地址 + 部署状态，点击进入 /passkey（内含 MetaMask 备选）。
 */
function PasskeyControl() {
  const [state, setState] = useState<{
    loading: boolean;
    has: boolean;
    addr?: string;
    deployed?: boolean;
  }>({ loading: true, has: false });

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const cred = loadStoredPasskey();
      if (!cred) {
        if (!cancelled) setState({ loading: false, has: false });
        return;
      }
      try {
        const addr = await passkeyAccountAddress(cred);
        const deployed = addr ? await isAccountDeployed(addr) : false;
        if (!cancelled) setState({ loading: false, has: true, addr: addr ?? undefined, deployed });
      } catch {
        if (!cancelled) setState({ loading: false, has: true });
      }
    };
    void load();
    const off = onPasskeyChange(() => void load());
    return () => {
      cancelled = true;
      off();
    };
  }, []);

  const { loading, has, addr, deployed } = state;
  const label = loading
    ? "Passkey…"
    : has
      ? `Passkey · ${addr ? short(addr) : "已创建"}`
      : "创建通行密钥";
  const dot = has ? (deployed ? "bg-emerald-400" : "bg-amber-400") : "bg-white/40";

  return (
    <Link
      href="/passkey"
      title={has ? `Passkey 账户 ${addr ?? ""}` : "创建通行密钥（Passkey）"}
      className="flex items-center gap-2 rounded-lg border border-white/20 bg-white/[0.06] px-2.5 py-2 text-[12.5px] font-medium text-white/90 transition hover:border-white/40 hover:bg-white/10 sm:px-3"
    >
      <span aria-hidden className={`h-1.5 w-1.5 shrink-0 rounded-full ${dot}`} />
      <span className="whitespace-nowrap">{label}</span>
    </Link>
  );
}

function short(a: string): string {
  return a.length > 12 ? `${a.slice(0, 6)}…${a.slice(-4)}` : a;
}
