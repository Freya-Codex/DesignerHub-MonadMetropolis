"use client";

import Link from "next/link";
import SchemeCard from "@/components/SchemeCard";
import { dreamSchemeAddress, schemeMarketAddress, useSchemes } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";

export default function GalleryPage() {
  const { data, isLoading, isError, error } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];

  const totalRemix = schemes.reduce((sum, s) => sum + s.remixCount, 0);
  const totalApplied = schemes.reduce((sum, s) => sum + s.appliedCount, 0);

  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-zinc-900 bg-gradient-to-br from-zinc-950 via-indigo-950 to-zinc-900 p-6 text-white sm:p-10">
        <span className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-[11px] font-medium text-emerald-300">
          Monad 测试网 · Chain ID 10143 · Social / Attention / Culture
        </span>
        <h1 className="mt-4 text-2xl font-black leading-tight sm:text-4xl">
          装修设计方案，是链上可 remix 的创作资产
        </h1>
        <p className="mt-3 max-w-2xl text-sm text-zinc-300 sm:text-base">
          手机扫描房间生成 3D 模型 → 在这里发布设计方案 → 任何人都能 Remix 衍生（parentId 上链归因），
          其他人「应用到我家」时费用 90% 直达原创作者、10% 进入平台金库。
          这就像家居设计界的 GitHub：谱系可追溯，收益自动分账。
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link href="/create" className="btn-primary">
            ✨ 创建我的方案
          </Link>
          <Link href="/board" className="btn-secondary !border-white/20 !bg-white/10 !text-white hover:!bg-white/20">
            🏆 查看排行榜
          </Link>
          <a
            href="https://faucet.monad.xyz"
            target="_blank"
            rel="noreferrer"
            className="btn-ghost !text-emerald-300 hover:!bg-white/10"
          >
            💧 领取测试 MON
          </a>
        </div>
        <dl className="mt-8 grid grid-cols-3 gap-3 text-center sm:max-w-md">
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[11px] text-zinc-400">方案总数</dt>
            <dd className="text-xl font-bold">{schemes.length}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[11px] text-zinc-400">累计 Remix</dt>
            <dd className="text-xl font-bold">{totalRemix}</dd>
          </div>
          <div className="rounded-2xl bg-white/5 p-3">
            <dt className="text-[11px] text-zinc-400">累计应用</dt>
            <dd className="text-xl font-bold">{totalApplied}</dd>
          </div>
        </dl>
      </section>

      {isDemo && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
          <b>演示数据模式</b>：尚未配置{" "}
          <code className="rounded bg-amber-100 px-1">NEXT_PUBLIC_DREAMSCHEME_ADDRESS</code>，当前展示{" "}
          <code className="rounded bg-amber-100 px-1">assets/schemes</code> 中的示例方案。
          完成合约部署并把地址写入 <code className="rounded bg-amber-100 px-1">web/.env.local</code>
          （或运行 <code className="rounded bg-amber-100 px-1">npm run seed</code>）后，画廊会自动切换为链上数据。
        </div>
      )}

      {!isDemo && (
        <p className="text-xs text-zinc-500">
          DreamScheme：<code>{dreamSchemeAddress()}</code> · SchemeMarket：
          <code>{schemeMarketAddress() ?? "未配置（仅画廊可读）"}</code>
        </p>
      )}

      <section>
        <div className="mb-4 flex items-end justify-between">
          <h2 className="text-lg font-bold text-zinc-900">方案画廊</h2>
          <span className="text-xs text-zinc-500">数据来源：SchemeMinted 事件 + IPFS 元数据</span>
        </div>

        {isLoading && !isDemo && (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="card h-64 animate-pulse bg-zinc-100" />
            ))}
          </div>
        )}

        {isError && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
            链上数据读取失败：{error instanceof Error ? error.message : "未知错误"}。请确认 RPC
            （https://testnet-rpc.monad.xyz）与合约地址是否正确。
          </div>
        )}

        {!isLoading && schemes.length === 0 && (
          <div className="card p-10 text-center">
            <p className="text-sm text-zinc-600">
              还没有任何方案。运行 <code className="rounded bg-zinc-100 px-1">cd web &amp;&amp; npm run seed</code>{" "}
              铸造示例方案，或直接去创建页发布第一份原创设计。
            </p>
            <Link href="/create" className="btn-primary mt-4">
              去创建
            </Link>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => (
            <SchemeCard key={scheme.tokenId.toString()} scheme={scheme} />
          ))}
        </div>
      </section>
    </div>
  );
}
