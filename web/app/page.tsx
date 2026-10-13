"use client";

import Link from "next/link";
import { useMemo } from "react";
import SchemeCard from "@/components/SchemeCard";
import { dreamSchemeAddress, useSchemes, type SchemeSummary } from "@/lib/contracts";
import { demoSchemes } from "@/lib/demo";
import { useI18n } from "@/lib/i18n";

const score = (s: SchemeSummary) => s.remixCount * 2 + s.appliedCount * 3;

export default function HomePage() {
  const { t, pick } = useI18n();
  const { data } = useSchemes();
  const isDemo = !dreamSchemeAddress();
  const schemes = data && data.length > 0 ? data : isDemo ? demoSchemes : [];

  const totalRemix = schemes.reduce((sum, s) => sum + s.remixCount, 0);
  const totalApplied = schemes.reduce((sum, s) => sum + s.appliedCount, 0);
  const totalFurniture = schemes.reduce((sum, s) => sum + s.furnitureCount, 0);

  const featured = useMemo(
    () => [...schemes].sort((a, b) => score(b) - score(a) || a.createdAt - b.createdAt).slice(0, 3),
    [schemes]
  );

  return (
    <div className="space-y-14">
      {/* -- HERO: brand positioning ------------------------- */}
      <section className="sheet-dark grid-sheet-dark rise relative overflow-hidden px-5 py-10 sm:px-10 sm:py-16">
        <span
          aria-hidden
          className="pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-violet/30 blur-[100px]"
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-violet-deep/25 blur-[100px]"
        />
        <div className="relative">
          <p className="eyebrow eyebrow-dark">
            Monad Testnet · Chain ID 10143 · Track 04 — Trust, Identity &amp; AI Infrastructure
          </p>

          <h1 className="display mt-5 max-w-3xl text-[36px] text-white sm:text-[64px]">
            {t("家居设计界的", "The ")}
            <span className="text-violet">"GitHub"</span>
            {t("", " for Interior Design")}
          </h1>

          <p className="mt-6 max-w-2xl text-[15px] leading-relaxed text-white/70">
            {t(
              "把装修设计方案变成链上可 remix、可归因、可分账的创作资产。由 AI 生成方案，在这里发布上链，任何人都能在你的设计上继续创作；",
              "Turn interior design schemes into on-chain creative assets that are remixable, attributable, and revenue-sharing. Generate with AI, publish on-chain, and let anyone build on your design;"
            )}
            <span className="mono text-white/90"> parentId </span>
            {t(
              "记录完整谱系，收益按创作者定价自动分账。",
              "records the full lineage on-chain, and revenue splits automatically at the creator’s price."
            )}
          </p>

          {/* Signature element: blueprint annotation lines */}
          <div className="mt-7 flex max-w-xl items-center gap-3">
            <span className="dim-tick !top-0 !bg-white/50" />
            <span className="dim-line dim-line-dark flex-1" />
            <span className="mono text-[10.5px] uppercase tracking-[0.18em] text-white/50">
              ERC-721 · ERC-2981 · IPFS
            </span>
            <span className="dim-line dim-line-dark flex-1" />
            <span className="dim-tick !top-0 !bg-white/50" />
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/demo" className="btn-primary">
              {t("进入画廊", "Enter Gallery")}
            </Link>
            <Link href="/mint/create" className="btn-outline-light">
              {t("创建我的方案", "Create My Scheme")}
            </Link>
            <a
              href="https://faucet.monad.xyz"
              target="_blank"
              rel="noreferrer"
              className="btn-ghost-light"
            >
              {t("领取测试 MON ↗", "Get Testnet MON ↗")}
            </a>
          </div>

          <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-6 border-t border-white/10 pt-7 sm:grid-cols-4">
            <Stat label={t("SCHEMES / 方案", "SCHEMES")} value={schemes.length} />
            <Stat label={t("REMIX / 衍生", "REMIX")} value={totalRemix} />
            <Stat label={t("APPLIED / 应用", "APPLIED")} value={totalApplied} />
            <Stat label={t("FURNITURE / 家具", "FURNITURE")} value={totalFurniture} />
          </dl>
        </div>
      </section>

      {/* -- Three core capabilities -------------------------- */}
      <section className="rise">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{t("Capabilities · 核心能力", "Capabilities")}</p>
            <h2 className="display-sm mt-2 text-2xl text-ink sm:text-3xl">
              {t("一套可组合的链上创作协议", "A Composable On-Chain Creation Protocol")}
            </h2>
          </div>
        </div>
        <div className="dim-line mt-5" />

        <div className="mt-7 grid gap-5 md:grid-cols-3">
          {[
            {
              n: "01",
              title: t("方案即资产", "Scheme as an Asset"),
              body: t(
                "每一份设计方案铸造成 ERC-721，元数据与户型数据存于 IPFS，AI 署名随方案一同上链，创作者身份透明可查。",
                "Every design scheme is minted as an ERC-721 with metadata and layout data on IPFS. The AI credit is recorded on-chain alongside the scheme, so authorship is transparent."
              )
            },
            {
              n: "02",
              title: t("谱系与归因", "Lineage & Attribution"),
              body: t(
                "通过 parentId 记录每一次 Remix 的来源，形成可追溯的创作谱系；原始创作者持续获得 ERC-2981 版税，引用关系永久留痕。",
                "The parentId field records where every remix came from, forming a traceable lineage. Original creators keep earning ERC-2981 royalties — citations leave a permanent trace."
              )
            },
            {
              n: "03",
              title: t("创作者定价 · 自动分账", "Creator Pricing · Auto Split"),
              body: t(
                "创作者自行设价；他人「应用到我家」时按定价支付，合约即时分账：原创 90/10，衍生 85/10/5（创作者 / 平台 / 祖先谱系池）。",
                "Creators set their own price. When someone applies a scheme to their home, payment splits instantly on-chain: 90/10 for originals and 85/10/5 for derivatives (creator / platform / ancestor pool)."
              )
            }
          ].map((f) => (
            <article key={f.n} className="sheet flex flex-col p-6 transition hover:border-violet/40">
              <span className="mono text-[11px] font-semibold tracking-[0.2em] text-violet">
                {f.n}
              </span>
              <h3 className="display-sm mt-4 text-lg text-ink">{f.title}</h3>
              <p className="mt-3 text-[13px] leading-relaxed text-muted">{f.body}</p>
            </article>
          ))}
        </div>
      </section>

      {/* -- Featured schemes --------------------------------- */}
      {featured.length > 0 && (
        <section className="rise">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{t("Featured · 精选方案", "Featured")}</p>
              <h2 className="display-sm mt-2 text-2xl text-ink sm:text-3xl">
                {t("最受引用的设计", "Most-Cited Designs")}
              </h2>
            </div>
            <Link href="/demo" className="link mono text-[12px]">
              {t("查看全部 →", "View all →")}
            </Link>
          </div>
          <div className="dim-line mt-5" />
          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((scheme, i) => (
              <SchemeCard key={scheme.tokenId.toString()} scheme={scheme} rank={i} />
            ))}
          </div>
        </section>
      )}

      {/* -- Workflow ----------------------------------------- */}
      <section className="rise">
        <p className="eyebrow">{t("How it works · 使用流程", "How it works")}</p>
        <h2 className="display-sm mt-2 text-2xl text-ink sm:text-3xl">
          {t("从灵感到回报，四步走完", "From Idea to Reward in Four Steps")}
        </h2>
        <div className="dim-line mt-5" />

        <ol className="mt-7 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { n: "1", zh: "生成方案", en: "Generate", d: t("用 AI 对话生成装修方案", "Generate a design with AI chat") },
            { n: "2", zh: "发布上链", en: "Publish", d: t("铸造成 NFT，署名与谱系上链", "Mint as an NFT — credit & lineage on-chain") },
            { n: "3", zh: "被 Remix", en: "Get Remixed", d: t("他人在你的设计上继续创作", "Others build on your design") },
            { n: "4", zh: "自动分账", en: "Get Paid", d: t("被应用时按定价即时分账", "Instant split when applied at your price") }
          ].map((s) => (
            <li key={s.n} className="sheet p-5">
              <span className="grid h-9 w-9 place-items-center rounded-lg bg-violet/10 font-mono text-[13px] font-bold text-violet-deep">
                {s.n}
              </span>
              <h3 className="display-sm mt-4 text-[15px] text-ink">{pick(s.zh, s.en)}</h3>
              <p className="mt-2 text-[12.5px] leading-relaxed text-muted">{s.d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* -- Closing CTA -------------------------------------- */}
      <section className="sheet-dark grid-sheet-dark rise flex flex-wrap items-center justify-between gap-6 px-6 py-9 sm:px-10">
        <div>
          <h2 className="display text-2xl text-white sm:text-3xl">
            {t("开始你的第一个链上设计", "Start Your First On-Chain Design")}
          </h2>
          <p className="mt-3 max-w-xl text-[13.5px] leading-relaxed text-white/65">
            {t(
              "无需钱包也可用 Passkey 一键铸造，gas 由中继代付。先逛逛画廊，找一份喜欢的设计继续创作。",
              "No wallet needed — mint in one tap with a Passkey and let the relayer cover gas. Browse the gallery first and build on a design you like."
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link href="/mint/create" className="btn-primary">
            {t("创建我的方案", "Create My Scheme")}
          </Link>
          <Link href="/demo" className="btn-outline-light">
            {t("浏览画廊", "Browse Gallery")}
          </Link>
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
