"use client";

import Link from "next/link";
import { dreamSchemeAddress, useSchemes, type SchemeSummary } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";
import { useI18n } from "@/lib/i18n";
import { shortAddress } from "@/lib/scheme";

const score = (s: SchemeSummary) => s.remixCount * 2 + s.appliedCount * 3;

export default function BoardPage() {
  const { t, pick } = useI18n();
  const { data, isLoading } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];
  const ranked = [...schemes].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
  const top = ranked[0];

  return (
    <div className="space-y-8">
      <header className="rise">
        <p className="eyebrow">Leaderboard · Track 04 — Trust, Identity & AI Infrastructure</p>
        <h1 className="display mt-3 text-[32px] text-ink sm:text-[46px]">{t("创意排行榜", "Creative Leaderboard")}</h1>
        <div className="dim-line mt-6 max-w-2xl" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          {t("热度 =", "Heat =")}
          <span className="mono text-ink"> Remix × 2 </span>+
          <span className="mono text-ink"> {t("被应用 × 3", "Applied × 3")}</span>
          {t(
            "，由链上事件与合约状态实时聚合。在注意力经济里，被 remix 就是被引用，被应用就是被付费。",
            " — aggregated in real time from on-chain events and contract state. In the attention economy, being remixed is being cited and being applied is being paid."
          )}
        </p>
      </header>

      {isDemo && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">{t("演示数据模式", "Demo data mode")}</span>
          <p className="text-[13px] leading-relaxed text-muted">
            {t(
              "部署合约并完成 seed 后，排行榜会自动读取 Monad 测试网真实数据。",
              "Once the contract is deployed and seeded, the leaderboard will automatically read live data from the Monad testnet."
            )}
          </p>
        </div>
      )}

      {top && (
        <section className="sheet-dark grid-sheet-dark rise flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="eyebrow eyebrow-dark">{t("Top Scheme · 榜首", "Top Scheme")}</p>
            <h2 className="display mt-3 text-2xl text-white sm:text-3xl">{pick(top.name, top.nameEn)}</h2>
            <p className="mono mt-3 text-[11px] uppercase tracking-[0.14em] text-white/50">
              #{top.tokenId.toString()} · {pick(top.theme, top.themeEn)} · {top.furnitureCount}{" "}
              {t("件家具", "items")} ·{" "}
              {shortAddress(top.creator)}
            </p>
          </div>
          <div className="flex items-end gap-8">
            <Metric label="REMIX" value={top.remixCount} />
            <Metric label="APPLIED" value={top.appliedCount} />
            <Metric label="SCORE" value={score(top)} accent />
          </div>
        </section>
      )}

      <section className="sheet overflow-hidden">
        {/* Mobile: card list to avoid horizontal scrolling (table at >=md) */}
        <div className="divide-y divide-hairline md:hidden">
          {isLoading &&
            [0, 1, 2].map((i) => (
              <div key={i} className="px-4 py-4">
                <div className="h-10 animate-pulse rounded bg-paper-2" />
              </div>
            ))}
          {!isLoading && ranked.length === 0 && (
            <div className="px-5 py-14 text-center text-sm text-muted">
              {t("暂无数据。先运行", "No data yet. First run")}{" "}
              <code className="mono text-ink">npm run seed</code>
              {t("铸造示例方案。", " to mint sample schemes.")}
            </div>
          )}
          {ranked.map((s, i) => (
            <div key={s.tokenId.toString()} className="px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className={`mono shrink-0 text-[12px] ${i === 0 ? "text-violet" : "text-muted"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Link
                      href={`/scheme/${s.tokenId.toString()}`}
                      className="truncate font-semibold text-ink transition hover:text-violet-deep"
                    >
                      {pick(s.name, s.nameEn)}
                    </Link>
                  </div>
                  <div className="mono mt-1 text-[10.5px] text-muted">
                    #{s.tokenId.toString()} · {pick(s.theme, s.themeEn)} · {s.furnitureCount}{" "}
                    {t("家具", "items")}
                    {s.parentId !== 0n && ` · ↳ #${s.parentId.toString()}`}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="mono text-base font-semibold text-violet-deep">{score(s)}</div>
                  <div className="mono text-[9px] uppercase tracking-[0.14em] text-muted">score</div>
                </div>
              </div>
              <div className="mono mt-2 flex items-center gap-4 text-[11px] text-muted">
                <span>↻ {s.remixCount} {t("次 remix", "remix")}</span>
                <span>✓ {s.appliedCount} {t("次应用", "applied")}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Rank
                </th>
                <th className="mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Scheme
                </th>
                <th className="mono hidden px-2.5 py-3 sm:px-5 sm:py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted sm:table-cell">
                  Creator
                </th>
                <th className="mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Remix
                </th>
                <th className="mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Applied
                </th>
                <th className="mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="px-2.5 py-3.5 sm:px-5 sm:py-4" colSpan={6}>
                      <div className="h-5 animate-pulse rounded bg-paper-2" />
                    </td>
                  </tr>
                ))}
              {!isLoading && ranked.length === 0 && (
                <tr>
                  <td className="px-4 py-14 text-center text-sm text-muted" colSpan={6}>
                    {t("暂无数据。先运行", "No data yet. First run")}{" "}
                    <code className="mono text-ink">npm run seed</code>
                    {t("铸造示例方案。", " to mint sample schemes.")}
                  </td>
                </tr>
              )}
              {ranked.map((s, i) => (
                <tr
                  key={s.tokenId.toString()}
                  className="border-b border-hairline transition last:border-0 hover:bg-paper-2/60"
                >
                  <td className="px-2.5 py-3.5 sm:px-5 sm:py-4">
                    <span className={`mono text-sm ${i === 0 ? "text-violet" : "text-muted"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="px-2.5 py-3.5 sm:px-5 sm:py-4">
                    <Link
                      href={`/scheme/${s.tokenId.toString()}`}
                      className="font-semibold text-ink transition hover:text-violet-deep"
                    >
                      {pick(s.name, s.nameEn)}
                    </Link>
                    <div className="mono mt-1 text-[10.5px] text-muted">
                      #{s.tokenId.toString()} · {pick(s.theme, s.themeEn)} · {s.furnitureCount}{" "}
                      {t("家具", "items")}
                      {s.parentId !== 0n && ` · ↳ #${s.parentId.toString()}`}
                    </div>
                  </td>
                  <td className="mono hidden px-2.5 py-3.5 sm:px-5 sm:py-4 text-[11px] text-muted sm:table-cell">
                    {shortAddress(s.creator)}
                  </td>
                  <td className="mono px-2.5 py-3.5 sm:px-5 sm:py-4 text-center text-ink">{s.remixCount}</td>
                  <td className="mono px-2.5 py-3.5 sm:px-5 sm:py-4 text-center text-ink">{s.appliedCount}</td>
                  <td className="px-2.5 py-3.5 sm:px-5 sm:py-4 text-right">
                    <span className="mono text-base font-semibold text-violet-deep">{score(s)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mono text-[11px] leading-relaxed text-muted">
        {t(
          "归属规则 · 创作者地址在铸造时上链，NFT 转手不影响作者归因；「应用到我家」按创作者定价支付，原创 90% / 衍生 85%（+5% 祖先谱系）即时转给作者，10% 给平台。",
          "Attribution rules · Creator addresses are recorded on-chain at mint, and reselling the NFT does not change authorship. Applying a scheme to your home is paid at the creator’s price and split instantly — originals pay 90% to the author and 10% to the platform, while remixes pay 85% to the author, 10% to the platform, and 5% to the ancestor lineage."
        )}
      </p>
    </div>
  );
}

function Metric({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
  return (
    <div className="text-right">
      <p className="mono text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</p>
      <p className={`display mt-1.5 text-3xl ${accent ? "text-violet" : "text-white"}`}>{value}</p>
    </div>
  );
}
