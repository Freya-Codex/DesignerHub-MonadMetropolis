"use client";

import Link from "next/link";
import SchemeCard from "@/components/SchemeCard";
import { dreamSchemeAddress, useSchemes } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";

export default function GalleryPage() {
  const { data, isLoading, isError, error } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];

  const totalRemix = schemes.reduce((sum, s) => sum + s.remixCount, 0);
  const totalApplied = schemes.reduce((sum, s) => sum + s.appliedCount, 0);
  const totalFurniture = schemes.reduce((sum, s) => sum + s.furnitureCount, 0);

  return (
    <div className="space-y-12">
      {/* ── HERO：蓝图封面 ───────────────────────────── */}
      <section className="sheet-dark grid-sheet-dark rise relative overflow-hidden px-5 py-9 sm:px-10 sm:py-14">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-violet/30 blur-[90px]"
        />
        <div className="relative">
          <p className="eyebrow eyebrow-dark">
            Monad Testnet · Chain 10143 · Track 04 — Trust, Identity & AI Infrastructure
          </p>

          <h1 className="display mt-5 text-[34px] text-white sm:text-[58px]">
            装修设计方案
            <br />
            是链上<span className="text-violet">可 remix</span>的创作资产
          </h1>

          {/* 签名元素：蓝图标注线 */}
          <div className="mt-6 flex max-w-xl items-center gap-3">
            <span className="dim-tick !top-0 !bg-white/50" />
            <span className="dim-line dim-line-dark flex-1" />
            <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-white/50">
              ERC-721 · ERC-2981 · IPFS
            </span>
            <span className="dim-line dim-line-dark flex-1" />
            <span className="dim-tick !top-0 !bg-white/50" />
          </div>

          <p className="mt-6 max-w-2xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
            由AI生成装修方案 → 在这里发布设计方案 → 任何人都能 Remix 衍生，
            <span className="mono text-white/90"> parentId </span>
            上链归因。他人「应用到我家」时，费用按创作者定价支付。就像家居设计界的 GitHub：谱系可追溯，收益自动分账。
          </p>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/mint/create" className="btn-primary">
              创建我的方案
            </Link>
            <Link href="/board" className="btn-outline-light">
              查看排行榜
            </Link>
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost-light"
            >
              领取测试 MON ↗
            </a>
          </div>

          <dl className="mt-10 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-7 sm:grid-cols-4">
            <Stat label="SCHEMES / 方案" value={schemes.length} />
            <Stat label="REMIX / 衍生" value={totalRemix} />
            <Stat label="APPLIED / 应用" value={totalApplied} />
            <Stat label="FURNITURE / 家具" value={totalFurniture} />
          </dl>
        </div>
      </section>

      {isDemo && (
        <div className="sheet rise flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">演示数据模式</span>
          <p className="text-[13px] leading-relaxed text-muted">
            尚未配置 <code className="mono text-ink">NEXT_PUBLIC_DREAM_SCHEME_ADDRESS</code>，当前展示{" "}
            <code className="mono text-ink">assets/schemes</code> 中的示例方案。部署合约后把地址写入{" "}
            <code className="mono text-ink">web/.env.local</code>（或运行{" "}
            <code className="mono text-ink">npm run seed</code>），画廊会自动切换为链上数据。
          </p>
        </div>
      )}

      {/* ── 画廊 ─────────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Gallery · 方案画廊</p>
            <h2 className="display-sm mt-2 text-2xl text-ink sm:text-3xl">链上创作流</h2>
          </div>
          <span className="mono text-[11px] text-muted">
            数据来源 · 链上状态（tokenId 1…totalSupply） + IPFS 元数据
          </span>
        </div>
        <div className="dim-line mt-5" />

        {isLoading && !isDemo && (
          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="sheet h-72 animate-pulse bg-paper-2" />
            ))}
          </div>
        )}

        {isError && (
          <div className="mt-8 rounded-2xl border border-coral/40 bg-coral/10 p-4 text-sm text-[#a53f52]">
            链上数据读取失败：{error instanceof Error ? error.message : "未知错误"}。请确认 RPC
            （testnet-rpc.monad.xyz）与合约地址是否正确。
          </div>
        )}

        {!isLoading && schemes.length === 0 && (
          <div className="sheet mt-8 p-12 text-center">
            <p className="text-sm text-muted">
              还没有任何方案。运行 <code className="mono text-ink">cd web &amp;&amp; npm run seed</code>{" "}
              铸造示例方案，或直接发布第一份原创设计。
            </p>
            <Link href="/mint/create" className="btn-primary mt-5">
              去创建
            </Link>
          </div>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {schemes.map((scheme) => (
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
      <dt className="mono text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</dt>
      <dd className="display mt-2 text-3xl text-white sm:text-4xl">{value}</dd>
    </div>
  );
}
