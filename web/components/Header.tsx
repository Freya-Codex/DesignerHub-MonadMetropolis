"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
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
  const { lang } = useI18n();
  const isActive = (href: string) =>
    href === "/mint" ? pathname === "/mint" : pathname.startsWith(href);

  return (
    <header className="sticky top-0 z-40 bg-ink/95 text-white backdrop-blur">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-2 gap-y-1 px-3 py-2 lg:min-h-[4rem] lg:gap-x-3 lg:px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2.5">
          <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-lg shadow-glow sm:h-9 sm:w-9">
            <svg viewBox="0 0 512 512" className="h-full w-full" aria-hidden>
              <defs>
                <linearGradient id="dh-mark" x1="0" y1="0" x2="0.85" y2="1">
                  <stop offset="0" stopColor="#6E54FF" />
                  <stop offset="1" stopColor="#4F47EB" />
                </linearGradient>
              </defs>
              <rect width="512" height="512" rx="112" fill="url(#dh-mark)" />
              <path
                d="M408 256 L332 124 L180 124 L104 256 L180 388 L332 388 Z"
                fill="none"
                stroke="#FFFFFF"
                strokeWidth="30"
                strokeLinejoin="round"
              />
              <path
                d="M162 274 L256 166 L350 274 L326 274 L326 350 L186 350 L186 274 Z M232 294 H280 V350 H232 Z"
                fill="#FFFFFF"
                fillRule="evenodd"
              />
              <circle cx="104" cy="256" r="22" fill="#C7D2FE" />
              <circle cx="408" cy="256" r="22" fill="#C7D2FE" />
            </svg>
          </span>
          <span className="leading-none">
            <span className="display-sm block text-[15px]">Designer Hub</span>
            <span className="mono mt-1 hidden text-[9px] tracking-[0.2em] text-white/45 sm:block">
              On-chain. Remixable. Attributable · MONAD
            </span>
          </span>
        </Link>

        <nav className="order-last -mx-3 flex w-full flex-wrap items-center gap-0.5 border-t border-white/10 px-3 pt-1 lg:order-none lg:mx-0 lg:w-auto lg:flex-1 lg:flex-nowrap lg:justify-end lg:gap-1 lg:border-t-0 lg:px-0 lg:pt-0">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`relative shrink-0 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition sm:px-3 sm:text-[13px] ${
                isActive(item.href) ? "text-white" : "text-white/55 hover:text-white"
              }`}
            >
              {lang === "en" ? item.en : item.label}
              {isActive(item.href) && (
                <span className="absolute inset-x-2.5 -bottom-0.5 h-0.5 rounded-full bg-violet" />
              )}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex shrink-0 items-center gap-2">
          <LangToggle />
          <PasskeyControl />
        </div>
      </div>
      <div className="h-px bg-gradient-to-r from-transparent via-violet/70 to-transparent" />
    </header>
  );
}

/** 中英切换按钮：显示目标语言标签。 */
function LangToggle() {
  const { lang, toggle } = useI18n();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={lang === "en" ? "切换到中文" : "Switch to English"}
      title={lang === "en" ? "切换到中文" : "Switch to English"}
      className="flex items-center gap-1.5 rounded-lg border border-white/20 bg-white/[0.06] px-2.5 py-2 text-[12.5px] font-medium text-white/90 transition hover:border-white/40 hover:bg-white/10 sm:px-3"
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden>
        <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
        <path d="M3 12h18M12 3c2.5 2.5 2.5 15.5 0 18M12 3c-2.5 2.5-2.5 15.5 0 18" stroke="currentColor" strokeWidth="1.4" />
      </svg>
      <span className="whitespace-nowrap">{lang === "en" ? "中文" : "EN"}</span>
    </button>
  );
}

/**
 * 右上角单一 Passkey 控件：替代原先的「连接钱包」。
 * 未创建 → 引导创建；已创建 → 显示 passkey 账户短地址 + 部署状态，点击进入 /passkey（内含 MetaMask 备选）。
 */
function PasskeyControl() {
  const { lang } = useI18n();
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
      ? `Passkey · ${addr ? short(addr) : lang === "en" ? "ready" : "已创建"}`
      : lang === "en"
        ? "Create passkey"
        : "创建通行密钥";
  const dot = has ? (deployed ? "bg-emerald-400" : "bg-amber-400") : "bg-white/40";

  return (
    <Link
      href="/passkey"
      title={
        has
          ? lang === "en"
            ? `Passkey account ${addr ?? ""}`
            : `Passkey 账户 ${addr ?? ""}`
          : lang === "en"
            ? "Create a passkey"
            : "创建通行密钥（Passkey）"
      }
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
