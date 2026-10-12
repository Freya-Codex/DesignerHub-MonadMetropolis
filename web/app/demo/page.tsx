"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import SchemeCard from "@/components/SchemeCard";
import { dreamSchemeAddress, useSchemes } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";
import { useI18n } from "@/lib/i18n";

export default function GalleryPage() {
  const { t, pick } = useI18n();
  const { data, isLoading, isError, error } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];
  const [activeStyle, setActiveStyle] = useState<string | null>(null);

  // 从方案 JSON 的 style.theme 提取风格，作为标签（保持出现顺序、去重）。
  const styles = useMemo(() => {
    const seen = new Set<string>();
    const list: Array<{ key: string; zh: string; en: string; count: number }> = [];
    for (const s of schemes) {
      if (!s.theme || seen.has(s.theme)) continue;
      seen.add(s.theme);
      list.push({
        key: s.theme,
        zh: s.theme,
        en: s.themeEn ?? s.theme,
        count: schemes.filter((x) => x.theme === s.theme).length
      });
    }
    return list;
  }, [schemes]);

  const visible = activeStyle ? schemes.filter((s) => s.theme === activeStyle) : schemes;

  const totalRemix = schemes.reduce((sum, s) => sum + s.remixCount, 0);
  const totalApplied = schemes.reduce((sum, s) => sum + s.appliedCount, 0);
  const totalFurniture = schemes.reduce((sum, s) => sum + s.furnitureCount, 0);

  return (
    <div className="space-y-10">
      {/* ── 画廊页头（紧凑）─────────────────────────── */}
      <header className="rise">
        <p className="eyebrow">Gallery · Track 04 — Trust, Identity &amp; AI Infrastructure</p>
        <div className="mt-3 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="display text-[32px] text-ink sm:text-[46px]">
              {t("方案画廊", "Scheme Gallery")}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-muted">
              {t(
                "浏览链上所有装修设计方案。点开任意一份即可查看详情、沿其谱系继续 Remix，或直接应用到我家。",
                "Browse every on-chain interior design scheme. Open any one to view details, continue its lineage as a remix, or apply it to your home."
              )}
            </p>
          </div>
          <Link href="/mint/create" className="btn-primary shrink-0">
            {t("创建我的方案", "Create My Scheme")}
          </Link>
        </div>
        <div className="dim-line mt-6" />

        <dl className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-4">
          <Stat label={t("SCHEMES / 方案", "SCHEMES")} value={schemes.length} />
          <Stat label={t("REMIX / 衍生", "REMIX")} value={totalRemix} />
          <Stat label={t("APPLIED / 应用", "APPLIED")} value={totalApplied} />
          <Stat label={t("FURNITURE / 家具", "FURNITURE")} value={totalFurniture} />
        </dl>
      </header>

      {isDemo && (
        <div className="sheet rise flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">{t("演示数据模式", "Demo Data Mode")}</span>
          <p className="text-[13px] leading-relaxed text-muted">
            {t("尚未配置", "Not yet configured")}{" "}
            <code className="mono text-ink">NEXT_PUBLIC_DREAM_SCHEME_ADDRESS</code>
            {t("，当前展示", " — currently showing sample schemes from")}{" "}
            <code className="mono text-ink">assets/schemes</code>
            {t(" 中的示例方案。部署合约后把地址写入", ". Once the contract is deployed, write the address into")}{" "}
            <code className="mono text-ink">web/.env.local</code>
            {t("（或运行", " (or run")}{" "}
            <code className="mono text-ink">npm run seed</code>
            {t("），画廊会自动切换为链上数据。", "), and the gallery will switch to on-chain data automatically.")}
          </p>
        </div>
      )}

      {/* ── 画廊 ─────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="display-sm text-xl text-ink sm:text-2xl">
            {t("链上创作流", "On-Chain Creations")}
          </h2>
          <span className="mono text-[11px] text-muted">
            {t(
              "数据来源 · 链上状态（tokenId 1…totalSupply） + IPFS 元数据",
              "Data source · On-chain state (tokenId 1…totalSupply) + IPFS metadata"
            )}
          </span>
        </div>

        {styles.length > 1 && (
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <span className="mono text-[10px] uppercase tracking-[0.16em] text-muted">
              {t("风格筛选", "Filter by style")}
            </span>
            <button
              type="button"
              onClick={() => setActiveStyle(null)}
              className={`chip transition ${activeStyle === null ? "chip-violet" : "hover:border-violet/50 hover:text-violet-deep"}`}
            >
              {t("全部", "All")} · {schemes.length}
            </button>
            {styles.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setActiveStyle(activeStyle === s.key ? null : s.key)}
                className={`chip transition ${activeStyle === s.key ? "chip-violet" : "hover:border-violet/50 hover:text-violet-deep"}`}
              >
                #{pick(s.zh, s.en)} · {s.count}
              </button>
            ))}
          </div>
        )}

        {isLoading && !isDemo && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sheet h-72 animate-pulse bg-paper-2" />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-8 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-[#a53f52]">
            {t("链上数据读取失败：", "Failed to read on-chain data: ")}
            {error instanceof Error ? error.message : t("未知错误", "Unknown error")}
            {t(
              "。请确认 RPC（testnet-rpc.monad.xyz）与合约地址是否正确。",
              ". Please verify the RPC (testnet-rpc.monad.xyz) and contract address."
            )}
          </div>
        )}

        {!isLoading && schemes.length === 0 && (
          <div className="sheet mt-8 p-12 text-center">
            <p className="text-sm text-muted">
              {t("还没有任何方案。运行", "No schemes yet. Run")}{" "}
              <code className="mono text-ink">cd web &amp;&amp; npm run seed</code>{" "}
              {t("铸造示例方案，或直接发布第一份原创设计。", " to mint sample schemes, or publish the first original design yourself.")}
            </p>
            <Link href="/mint/create" className="btn-primary mt-5">
              {t("去创建", "Create One")}
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((scheme) => (
            <SchemeCard key={scheme.tokenId.toString()} scheme={scheme} />
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <dt className="mono text-[10px] uppercase tracking-[0.16em] text-muted">{label}</dt>
      <dd className="display mt-1.5 text-2xl text-ink sm:text-3xl">{value}</dd>
    </div>
  );
}
