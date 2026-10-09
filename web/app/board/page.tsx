"use client";

import Link from "next/link";
import { dreamSchemeAddress, useSchemes, type SchemeSummary } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";
import { shortAddress } from "@/lib/scheme";

const score = (s: SchemeSummary) => s.remixCount * 2 + s.appliedCount * 3;

export default function BoardPage() {
  const { data, isLoading } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];
  const ranked = [...schemes].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt);
  const top = ranked[0];

  return (
    <div className="space-y-8">
      <header className="rise">
        <p className="eyebrow">Leaderboard · Track 04 — Trust, Identity & AI Infrastructure</p>
        <h1 className="display mt-3 text-[32px] text-ink sm:text-[46px]">创意排行榜</h1>
        <div className="dim-line mt-6 max-w-2xl" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          热度 =
          <span className="mono text-ink"> Remix × 2 </span>+
          <span className="mono text-ink"> 被应用 × 3</span>，由链上事件与合约状态实时聚合。
          在注意力经济里，被 remix 就是被引用，被应用就是被付费。
        </p>
      </header>

      {isDemo && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">演示数据模式</span>
          <p className="text-[13px] leading-relaxed text-muted">
            部署合约并完成 seed 后，排行榜会自动读取 Monad 测试网真实数据。
          </p>
        </div>
      )}

      {top && (
        <section className="sheet-dark grid-sheet-dark rise flex flex-wrap items-end justify-between gap-6 p-6 sm:p-8">
          <div>
            <p className="eyebrow eyebrow-dark">Top Scheme · 榜首</p>
            <h2 className="display mt-3 text-2xl text-white sm:text-3xl">{top.name}</h2>
            <p className="mono mt-3 text-[11px] uppercase tracking-[0.14em] text-white/50">
              #{top.tokenId.toString()} · {top.theme} · {top.furnitureCount} 件家具 ·{" "}
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
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="border-b border-hairline">
                <th className="mono px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Rank
                </th>
                <th className="mono px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Scheme
                </th>
                <th className="mono hidden px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted sm:table-cell">
                  Creator
                </th>
                <th className="mono px-5 py-3.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Remix
                </th>
                <th className="mono px-5 py-3.5 text-center text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Applied
                </th>
                <th className="mono px-5 py-3.5 text-right text-[10px] font-medium uppercase tracking-[0.14em] text-muted">
                  Score
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading &&
                [0, 1, 2].map((i) => (
                  <tr key={i} className="border-b border-hairline">
                    <td className="px-5 py-4" colSpan={6}>
                      <div className="h-5 animate-pulse rounded bg-paper-2" />
                    </td>
                  </tr>
                ))}
              {!isLoading && ranked.length === 0 && (
                <tr>
                  <td className="px-5 py-14 text-center text-sm text-muted" colSpan={6}>
                    暂无数据。先运行 <code className="mono text-ink">npm run seed</code> 铸造示例方案。
                  </td>
                </tr>
              )}
              {ranked.map((s, i) => (
                <tr
                  key={s.tokenId.toString()}
                  className="border-b border-hairline transition last:border-0 hover:bg-paper-2/60"
                >
                  <td className="px-5 py-4">
                    <span className={`mono text-sm ${i === 0 ? "text-violet" : "text-muted"}`}>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <Link
                      href={`/scheme/${s.tokenId.toString()}`}
                      className="font-semibold text-ink transition hover:text-violet-deep"
                    >
                      {s.name}
                    </Link>
                    <div className="mono mt-1 text-[10.5px] text-muted">
                      #{s.tokenId.toString()} · {s.theme} · {s.furnitureCount} 家具
                      {s.parentId !== 0n && ` · ↳ #${s.parentId.toString()}`}
                    </div>
                  </td>
                  <td className="mono hidden px-5 py-4 text-[11px] text-muted sm:table-cell">
                    {shortAddress(s.creator)}
                  </td>
                  <td className="mono px-5 py-4 text-center text-ink">{s.remixCount}</td>
                  <td className="mono px-5 py-4 text-center text-ink">{s.appliedCount}</td>
                  <td className="px-5 py-4 text-right">
                    <span className="mono text-base font-semibold text-violet-deep">{score(s)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <p className="mono text-[11px] leading-relaxed text-muted">
        归属规则 · 创作者地址在铸造时上链，NFT 转手不影响作者归因；「应用到我家」按创作者定价支付，
        原创 90% / 衍生 85%（+5% 祖先谱系）即时转给作者，10% 给平台。
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
