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
  const medias = ["🥇", "🥈", "🥉"];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-black text-zinc-900">创意排行榜</h1>
        <p className="mt-1 text-sm text-zinc-500">
          热度 = Remix 数 × 2 + 被应用次数 × 3。数据由链上事件与合约状态实时聚合，注意力即资产。
        </p>
      </header>

      {isDemo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          当前为演示数据。部署合约并完成 seed 后，排行榜会自动读取 Monad 测试网真实数据。
        </div>
      )}

      <div className="card overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
            <tr>
              <th className="px-4 py-3">排名</th>
              <th className="px-4 py-3">方案</th>
              <th className="hidden px-4 py-3 sm:table-cell">创作者</th>
              <th className="px-4 py-3 text-center">Remix</th>
              <th className="px-4 py-3 text-center">被应用</th>
              <th className="px-4 py-3 text-right">热度</th>
            </tr>
          </thead>
          <tbody>
            {isLoading &&
              [0, 1, 2].map((i) => (
                <tr key={i} className="border-t border-zinc-100">
                  <td className="px-4 py-4" colSpan={6}>
                    <div className="h-5 animate-pulse rounded bg-zinc-100" />
                  </td>
                </tr>
              ))}
            {!isLoading && ranked.length === 0 && (
              <tr>
                <td className="px-4 py-10 text-center text-zinc-500" colSpan={6}>
                  暂无数据。先运行 <code className="rounded bg-zinc-100 px-1">npm run seed</code> 铸造示例方案。
                </td>
              </tr>
            )}
            {ranked.map((s, i) => (
              <tr key={s.tokenId.toString()} className="border-t border-zinc-100 hover:bg-zinc-50/70">
                <td className="px-4 py-3 font-semibold text-zinc-500">
                  {medias[i] ?? `#${i + 1}`}
                </td>
                <td className="px-4 py-3">
                  <Link href={`/scheme/${s.tokenId.toString()}`} className="font-semibold text-zinc-900 hover:text-indigo-600">
                    {s.name}
                  </Link>
                  <div className="text-xs text-zinc-500">
                    #{s.tokenId.toString()} · {s.theme} · {s.furnitureCount} 件家具
                    {s.parentId !== 0n && ` · 衍生自 #${s.parentId.toString()}`}
                  </div>
                </td>
                <td className="hidden px-4 py-3 font-mono text-xs text-zinc-500 sm:table-cell">
                  {shortAddress(s.creator)}
                </td>
                <td className="px-4 py-3 text-center font-semibold text-zinc-700">{s.remixCount}</td>
                <td className="px-4 py-3 text-center font-semibold text-zinc-700">{s.appliedCount}</td>
                <td className="px-4 py-3 text-right text-base font-black text-indigo-600">{score(s)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="text-xs text-zinc-500">
        归属规则：创作者地址在铸造时上链，NFT 转手不影响作者归因；每次「应用到我家」支付 0.01 MON，
        90% 即时转给作者、10% 累积到平台金库。
      </p>
    </div>
  );
}
