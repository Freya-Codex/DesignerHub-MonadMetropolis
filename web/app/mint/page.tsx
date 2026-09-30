"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { dreamSchemeAddress, schemeMarketAddress, useSchemes, type SchemeSummary } from "@/lib/contracts";
import { demoActivity, useActivity } from "@/lib/events";
import { demoSchemes } from "@/lib/demo";
import { monadTestnet } from "@/lib/chains";
import { shortAddress } from "@/lib/scheme";
import PreviewImage from "@/components/PreviewImage";

type SortKey = "recent" | "remix" | "applied";

export default function MintPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const isDemo = !dreamSchemeAddress();

  const { data: schemesData, isLoading: schemesLoading } = useSchemes();
  const { data: activityData } = useActivity();

  const schemes = schemesData && schemesData.length > 0 ? schemesData : isDemo ? demoSchemes : [];
  const activity = isDemo ? demoActivity : activityData ?? { mints: [], trades: [], indexed: false };

  const wrongNetwork = isConnected && chainId !== monadTestnet.id;
  const me = address?.toLowerCase();

  const mine = useMemo(
    () => (me ? schemes.filter((s) => s.creator.toLowerCase() === me) : []),
    [schemes, me]
  );

  // 我铸造过的方案（含链上事件里出现、但元数据尚未加载的情况）
  const mintedIds = useMemo(() => {
    if (!me) return new Set<string>();
    const ids = new Set<string>();
    for (const s of mine) ids.add(s.tokenId.toString());
    for (const m of activity.mints) {
      if (m.creator.toLowerCase() === me) ids.add(m.tokenId.toString());
    }
    return ids;
  }, [mine, activity.mints, me]);

  const myRemixedParents = useMemo(() => {
    const set = new Set<string>();
    for (const s of mine) {
      if (s.parentId !== 0n) set.add(s.parentId.toString());
    }
    return set;
  }, [mine]);

  // 可 Remix 的机会：他人方案，排除自己已经 Remix 过的
  const opportunities = useMemo(() => {
    return schemes
      .filter((s) => !me || s.creator.toLowerCase() !== me)
      .filter((s) => !myRemixedParents.has(s.tokenId.toString()))
      .sort((a, b) => b.remixCount * 2 + b.appliedCount * 3 - (a.remixCount * 2 + a.appliedCount * 3))
      .slice(0, 6);
  }, [schemes, me, myRemixedParents]);

  const myRemixReceived = useMemo(
    () => mine.reduce((sum, s) => sum + s.remixCount, 0) + (isDemo ? demoActivity.trades.filter((t) => t.creator.toLowerCase() === (me ?? "")).length : 0),
    [mine, isDemo, me]
  );

  const mintTotal = me ? activity.mints.filter((m) => m.creator.toLowerCase() === me).length : 0;

  return (
    <div className="space-y-10">
      <header className="rise">
        <p className="eyebrow">Mint · 铸造中心</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">铸造中心</h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          这里汇总你的铸造入口：发布原创方案、在他人作品上 Remix 衍生、或把自己的作品迭代成新版本。
          每次铸造都会在链上写入 <span className="mono text-ink">creator</span> 与{" "}
          <span className="mono text-ink">parentId</span>，形成可追溯的创作谱系。
        </p>
      </header>

      {isDemo && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">演示数据模式</span>
          <p className="text-[13px] leading-relaxed text-muted">
            尚未配置合约地址，以下为示例数据。部署合约并写入 <code className="mono text-ink">web/.env.local</code>{" "}
            后会自动切换为你的链上铸造记录。
          </p>
        </div>
      )}

      {wrongNetwork && (
        <div className="sheet flex flex-col gap-3 border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-[#a53f52]">
            当前钱包不在 Monad 测试网（Chain ID 10143），铸造会失败。
          </p>
          <button
            className="btn-primary shrink-0"
            onClick={() => void switchChainAsync?.({ chainId: monadTestnet.id }).catch(() => undefined)}
          >
            切换到 Monad 测试网
          </button>
        </div>
      )}

      {/* ── 统计 ───────────────────────────────────── */}
      <section className="sheet-dark grid-sheet-dark rise px-5 py-8 sm:px-9 sm:py-10">
        <p className="eyebrow eyebrow-dark">My Mint · 我的铸造</p>
        {isConnected ? (
          <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-6 sm:grid-cols-4">
            <Stat label="SCHEMES / 我的方案" value={mine.length} />
            <Stat label="MINTS / 链上铸造" value={isDemo ? mine.length : mintTotal} />
            <Stat label="REMIX RECEIVED / 被衍生" value={myRemixReceived} />
            <Stat label="REMIX SENT / 我衍生他人" value={myRemixedParents.size} />
          </dl>
        ) : (
          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:gap-5">
            <p className="text-sm leading-relaxed text-white/70">
              连接 MetaMask 后即可看到你的铸造记录、被衍生次数与 Remix 机会。
            </p>
            <div className="mono shrink-0 text-[11px] uppercase tracking-[0.14em] text-white/45">
              CONNECT WALLET ↑
            </div>
          </div>
        )}
      </section>

      {/* ── 快捷铸造入口 ───────────────────────────── */}
      <section className="grid gap-5 sm:grid-cols-3">
        <ActionCard
          eyebrow="Origin · 原创"
          title="铸造原创方案"
          body="上传或粘贴方案 JSON，固定到 IPFS 并铸造，parentId = 0，你是该谱系的原作者。"
          href="/create"
          cta="去创建页"
        />
        <ActionCard
          eyebrow="Remix · 衍生"
          title="从他人作品 Remix"
          body="在他人方案上改风格、调配色、增减家具，铸造时 parentId 指向原作，归因自动上链。"
          href="#opportunities"
          cta="看 Remix 机会"
        />
        <ActionCard
          eyebrow="Version · 迭代"
          title="发布新版本"
          body="在自己的最新版本上继续迭代，parentId 指向上一版，形成 v1 / v2 / v3 版本时间线。"
          href="#mine"
          cta="看我的方案"
        />
      </section>

      {/* ── Remix 机会 ─────────────────────────────── */}
      <section id="opportunities" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Remix Opportunities · 可衍生机会</p>
            <h2 className="display-sm mt-2 text-2xl text-ink">在别人的设计上继续创作</h2>
          </div>
          <span className="mono text-[11px] text-muted">
            按热度排序 · 已排除你衍生过的方案
          </span>
        </div>
        <div className="dim-line mt-5" />

        {opportunities.length === 0 ? (
          <div className="sheet mt-6 p-10 text-center">
            <p className="text-sm text-muted">
              {isConnected ? "暂无可 Remix 的他人方案。" : "连接钱包后会显示为你筛选的 Remix 机会。"}
            </p>
            <Link href="/" className="btn-secondary mt-4">
              先去画廊看看
            </Link>
          </div>
        ) : (
          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {opportunities.map((s) => (
              <OpportunityCard key={s.tokenId.toString()} scheme={s} disabled={!isConnected} />
            ))}
          </div>
        )}
      </section>

      {/* ── 我的方案 ───────────────────────────────── */}
      <section id="mine" className="scroll-mt-24">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">My Schemes · 我的方案</p>
            <h2 className="display-sm mt-2 text-2xl text-ink">我铸造的方案</h2>
          </div>
          {isConnected && mine.length > 1 && (
            <span className="mono text-[11px] text-muted">
              共 {mine.length} 个 · 其中衍生 {myRemixedParents.size} 个
            </span>
          )}
        </div>
        <div className="dim-line mt-5" />

        {schemesLoading && !isDemo ? (
          <div className="sheet mt-6 h-40 animate-pulse bg-paper-2" />
        ) : !isConnected ? (
          <div className="sheet mt-6 p-10 text-center">
            <p className="text-sm text-muted">连接 MetaMask 后这里会列出你铸造的全部方案。</p>
          </div>
        ) : mine.length === 0 ? (
          <div className="sheet mt-6 p-10 text-center">
            <p className="text-sm text-muted">你还没有铸造过方案，从第一份原创设计开始吧。</p>
            <Link href="/create" className="btn-primary mt-4">
              铸造第一份方案
            </Link>
          </div>
        ) : (
          <div className="sheet mt-6 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[680px] text-left text-sm">
                <thead>
                  <tr className="border-b border-hairline">
                    <Th>Token</Th>
                    <Th>Scheme</Th>
                    <Th center>Parent</Th>
                    <Th center>Remix</Th>
                    <Th center>Applied</Th>
                    <Th right>Action</Th>
                  </tr>
                </thead>
                <tbody>
                  {mine.map((s) => {
                    return (
                      <tr key={s.tokenId.toString()} className="border-b border-hairline last:border-0 hover:bg-paper-2/60">
                        <Td>
                          <span className="mono text-[13px] text-violet-deep">#{s.tokenId.toString()}</span>
                        </Td>
                        <Td>
                          <Link
                            href={`/scheme/${s.tokenId.toString()}`}
                            className="font-semibold text-ink transition hover:text-violet-deep"
                          >
                            {s.name}
                          </Link>
                          <div className="mono mt-1 text-[10.5px] text-muted">
                            {s.theme} · {s.furnitureCount} 家具
                          </div>
                        </Td>
                        <Td center>
                          {s.parentId === 0n ? (
                            <span className="chip">原创</span>
                          ) : (
                            <Link href={`/scheme/${s.parentId.toString()}`} className="chip chip-violet">
                              ↳ #{s.parentId.toString()}
                            </Link>
                          )}
                        </Td>
                        <Td center>
                          <span className="mono">{s.remixCount}</span>
                        </Td>
                        <Td center>
                          <span className="mono">{s.appliedCount}</span>
                        </Td>
                        <Td right>
                          <div className="flex justify-end gap-2">
                            <Link href={`/scheme/${s.tokenId.toString()}`} className="btn-secondary !px-3 !py-1.5 !text-xs">
                              查看
                            </Link>
                            <Link
                              href={`/remix/${s.tokenId.toString()}?newVersion=1`}
                              className="btn-primary !px-3 !py-1.5 !text-xs"
                            >
                              新版本
                            </Link>
                          </div>
                        </Td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </section>

      <p className="mono text-[11px] leading-relaxed text-muted">
        铸造只消耗测试网 gas（MON）；创作者地址在铸造时上链固化，NFT 转手不影响归因。
        当前市场合约 {schemeMarketAddress() ? shortAddress(schemeMarketAddress(), 6) : "未配置"}。
      </p>
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

function ActionCard({
  eyebrow,
  title,
  body,
  href,
  cta
}: {
  eyebrow: string;
  title: string;
  body: string;
  href: string;
  cta: string;
}) {
  return (
    <div className="sheet flex flex-col p-6">
      <p className="eyebrow">{eyebrow}</p>
      <h3 className="display-sm mt-3 text-lg text-ink">{title}</h3>
      <p className="mt-2.5 flex-1 text-xs leading-relaxed text-muted">{body}</p>
      <Link href={href} className="link mono mt-4 text-[11px] uppercase tracking-[0.12em]">
        {cta} →
      </Link>
    </div>
  );
}

function OpportunityCard({ scheme, disabled }: { scheme: SchemeSummary; disabled: boolean }) {
  const href = disabled ? "#" : `/remix/${scheme.tokenId.toString()}`;
  return (
    <div className="sheet flex flex-col overflow-hidden">
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
        <PreviewImage
          uri={scheme.image}
          alt={scheme.name}
          className="h-full w-full object-cover"
        />
        <span className="mono absolute left-3 top-3 rounded-md bg-ink/85 px-2 py-1 text-[10px] tracking-wider text-white">
          #{scheme.tokenId.toString()}
        </span>
        <span className="absolute right-3 top-3 rounded-md border border-white/25 bg-white/85 px-2 py-1 text-[10px] font-semibold text-ink">
          {scheme.theme}
        </span>
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h3 className="display-sm line-clamp-1 text-[15px] text-ink">{scheme.name}</h3>
        <p className="mono mt-1.5 text-[10.5px] text-muted">
          {shortAddress(scheme.creator)} · {scheme.furnitureCount} 家具
        </p>
        <div className="mt-3.5 flex items-center gap-4 border-t border-hairline pt-3">
          <span className="mono text-[11px] text-muted">
            REMIX <span className="text-ink">{scheme.remixCount}</span>
          </span>
          <span className="mono text-[11px] text-muted">
            APPLIED <span className="text-violet-deep">{scheme.appliedCount}</span>
          </span>
        </div>
        <Link
          href={href}
          aria-disabled={disabled}
          className={`mt-4 ${disabled ? "btn-secondary pointer-events-none opacity-45" : "btn-primary"}`}
        >
          {disabled ? "连接钱包后可 Remix" : "去 Remix"}
        </Link>
      </div>
    </div>
  );
}

function Th({
  children,
  center,
  right
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <th
      className={`mono px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted ${
        center ? "text-center" : right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({
  children,
  center,
  right
}: {
  children: React.ReactNode;
  center?: boolean;
  right?: boolean;
}) {
  return (
    <td className={`px-5 py-4 ${center ? "text-center" : right ? "text-right" : ""}`}>{children}</td>
  );
}
