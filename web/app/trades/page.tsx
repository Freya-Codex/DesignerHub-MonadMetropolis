"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain } from "wagmi";
import { dreamSchemeAddress, schemeMarketAddress, useSchemes } from "@/lib/contracts";
import { demoActivity, useActivity, type TradeRecord } from "@/lib/events";
import { demoSchemes } from "@/lib/demo";
import { monadTestnet } from "@/lib/chains";
import { shortAddress } from "@/lib/scheme";
import { useI18n } from "@/lib/i18n";

const EXPLORER = "https://testnet.monadexplorer.com";

type Filter = "all" | "bought" | "sold";

export default function TradesPage() {
  const { t, pick } = useI18n();
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const isDemo = !dreamSchemeAddress();
  const market = schemeMarketAddress();

  const { data: schemesData } = useSchemes();
  const { data: activityData, isLoading } = useActivity();
  const [filter, setFilter] = useState<Filter>("all");

  const schemes = schemesData && schemesData.length > 0 ? schemesData : isDemo ? demoSchemes : [];
  const activity = isDemo ? demoActivity : activityData ?? { mints: [], trades: [], indexed: false };
  const me = address?.toLowerCase();

  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schemes) map[s.tokenId.toString()] = pick(s.name, s.nameEn);
    return map;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [schemes, pick]);

  const totals = useMemo(() => {
    let volume = 0n;
    let creatorPaid = 0n;
    let platformPaid = 0n;
    let spent = 0n;
    let earned = 0n;
    for (const t of activity.trades) {
      volume += t.price;
      creatorPaid += t.creatorCut;
      platformPaid += t.platformCut;
      if (me && t.applier.toLowerCase() === me) spent += t.price;
      if (me && t.creator.toLowerCase() === me) earned += t.creatorCut;
    }
    return { volume, creatorPaid, platformPaid, spent, earned, count: activity.trades.length };
  }, [activity.trades, me]);

  const rows = useMemo(() => {
    if (!me || filter === "all") return activity.trades;
    return activity.trades.filter((t) =>
      filter === "bought" ? t.applier.toLowerCase() === me : t.creator.toLowerCase() === me
    );
  }, [activity.trades, filter, me]);

  const wrongNetwork = isConnected && chainId !== monadTestnet.id;

  return (
    <div className="space-y-10">
      <header className="rise">
        <p className="eyebrow">{t("Trades · 链上交易账本", "Trades · On-chain Ledger")}</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">{t("交易记录", "Trade History")}</h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          {t("每一次「应用到我家」都会触发 ", "Every “Apply to My Home” triggers a ")}
          <span className="mono text-ink">SchemeApplied</span>
          {t(
            " 事件：按创作者自主定价支付，原创 ",
            " event: paid at the creator’s own pricing, originals "
          )}
          <span className="mono text-ink">90/10</span>
          {t("、衍生 ", ", derivatives ")}
          <span className="mono text-ink">85/10/5</span>
          {t(
            "（创作者/平台/祖先谱系）即时分账到账，无需提取。这里是完整、不可篡改的流水。",
            " (creator / platform / ancestor lineage) — split and settled instantly, no claim needed. This is the complete, tamper-proof ledger."
          )}
        </p>
      </header>

      {isDemo && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">{t("演示数据模式", "Demo data mode")}</span>
          <p className="text-[13px] leading-relaxed text-muted">
            {t(
              "尚未配置市场合约地址，以下为示例流水。部署并在 ",
              "No market contract address is configured yet; the flow below is sample data. Deploy and, in "
            )}
            <code className="mono text-ink">web/.env.local</code>
            {t(" 填入 ", " fill in ")}
            <code className="mono text-ink">NEXT_PUBLIC_SCHEME_MARKET_ADDRESS</code>
            {t(" 后会切换为链上真实事件。", " to switch to real on-chain events.")}
          </p>
        </div>
      )}

      {!isDemo && activityData && !activityData.indexed && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip shrink-0 self-start">{t("索引待生成", "Index pending")}</span>
          <p className="text-[13px] leading-relaxed text-muted">
            {t(
              "尚未生成链上活动索引，当前仅显示最近若干区块的实时扫描结果。运行 ",
              "The on-chain activity index hasn’t been generated yet; only a live scan of the most recent blocks is shown. Run "
            )}
            <code className="mono text-ink">npm run index</code>
            {t(
              " 可补齐完整历史流水（配置 ENVIO_API_TOKEN 时经 Envio HyperSync 一次拉全）。",
              " to backfill the full history (with ENVIO_API_TOKEN set it pulls the whole history from Envio HyperSync in one pass)."
            )}
          </p>
        </div>
      )}

      {wrongNetwork && (
        <div className="sheet flex flex-col gap-3 border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-[#a53f52]">
            {t(
              "当前钱包不在 Monad 测试网（Chain ID 10143）。",
              "Your wallet is not on the Monad Testnet (Chain ID 10143)."
            )}
          </p>
          <button
            className="btn-primary shrink-0"
            onClick={() => void switchChainAsync?.({ chainId: monadTestnet.id }).catch(() => undefined)}
          >
            {t("切换网络", "Switch network")}
          </button>
        </div>
      )}

      {/* ── 总览 ───────────────────────────────────── */}
      <section className="sheet-dark grid-sheet-dark rise px-5 py-8 sm:px-9 sm:py-10">
        <p className="eyebrow eyebrow-dark">{t("Ledger Overview · 账本总览", "Ledger Overview")}</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-6 sm:grid-cols-4">
          <Stat label={t("APPLIES / 累计应用", "APPLIES")} value={String(totals.count)} />
          <Stat label={t("VOLUME / 累计成交", "VOLUME")} value={`${fmtMon(totals.volume)} MON`} />
          <Stat label={t("TO CREATORS / 创作者所得", "TO CREATORS")} value={`${fmtMon(totals.creatorPaid)} MON`} accent />
          <Stat label={t("TO PLATFORM / 平台所得", "TO PLATFORM")} value={`${fmtMon(totals.platformPaid)} MON`} />
        </dl>
      </section>

      {/* ── 我的分账 ───────────────────────────────── */}
      {isConnected && (
        <section className="sheet p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">{t("My Earnings · 我的分账", "My Earnings")}</p>
              <h2 className="display-sm mt-2 text-xl text-ink">{t("我的支出与收入", "My Spending & Income")}</h2>
            </div>
            <span className="mono text-[11px] text-muted">{shortAddress(address, 6)}</span>
          </div>
          <div className="dim-line mt-4" />
          <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
            <Row label={t("SPENT / 我支付的费用", "SPENT")}>
              <span className="mono font-semibold text-ink">{fmtMon(totals.spent)} MON</span>
            </Row>
            <Row label={t("EARNED / 我作为创作者收到", "EARNED")}>
              <span className="mono font-semibold text-violet-deep">{fmtMon(totals.earned)} MON</span>
            </Row>
            <Row label={t("SETTLEMENT / 结算方式", "SETTLEMENT")}>
              <span className="mono text-muted">{t("即时分账，无需提取", "settled instantly, no claim needed")}</span>
            </Row>
          </dl>

          {market && (
            <a
              className="link mono mt-5 inline-block text-[11px]"
              href={`${EXPLORER}/address/${market}`}
              target="_blank"
              rel="noreferrer"
            >
              {t("在浏览器中查看 SchemeMarket ↗", "View SchemeMarket on explorer ↗")}
            </a>
          )}
        </section>
      )}

      {/* ── 流水表 ─────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">{t("Flow · 交易流水", "Flow")}</p>
            <h2 className="display-sm mt-2 text-2xl text-ink">{t("全部应用记录", "All applications")}</h2>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-hairline bg-white p-1">
            {(
              [
                ["all", t("全部", "All")],
                ["bought", t("我买到的", "Bought")],
                ["sold", t("我卖出的", "Sold")]
              ] as Array<[Filter, string]>
            ).map(([key, label]) => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                disabled={key !== "all" && !isConnected}
                className={`rounded-lg px-3 py-1.5 text-[12px] font-medium transition disabled:opacity-40 ${
                  filter === key ? "bg-violet text-white" : "text-muted hover:text-ink"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="dim-line mt-5" />

        <div className="sheet mt-6 overflow-hidden">
          {/* 手机端：卡片列表，避免横向滚动条（≥md 用表格） */}
          <div className="divide-y divide-hairline md:hidden">
            {isLoading && !isDemo &&
              [0, 1, 2].map((i) => (
                <div key={i} className="px-4 py-4">
                  <div className="h-14 animate-pulse rounded bg-paper-2" />
                </div>
              ))}
            {!isLoading && rows.length === 0 && (
              <div className="px-5 py-14 text-center text-sm text-muted">
                {filter === "all"
                  ? t(
                      "还没有任何交易 —— 去画廊挑一套方案应用到我家吧。",
                      "No trades yet — head to the gallery and apply a scheme to your home."
                    )
                  : t("这个筛选下暂无记录。", "No records under this filter.")}
                {filter === "all" && (
                  <div className="mt-4">
                    <Link href="/demo" className="btn-secondary">
                      {t("去画廊", "Go to gallery")}
                    </Link>
                  </div>
                )}
              </div>
            )}
            {rows.map((tr) => {
              const nm = nameOf[tr.tokenId.toString()];
              const isMine = (addr: string) => Boolean(me && addr.toLowerCase() === me);
              return (
                <div key={`${tr.txHash}-${tr.logIndex}`} className="px-4 py-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <Link
                        href={`/scheme/${tr.tokenId.toString()}`}
                        className="font-semibold text-ink transition hover:text-violet-deep"
                      >
                        {nm ?? t("方案 #{id}", "Scheme #{id}", { id: tr.tokenId.toString() })}
                      </Link>
                      <div className="mono mt-1 text-[10.5px] text-muted">
                        TOKEN #{tr.tokenId.toString()}
                        {isMine(tr.creator) && (
                          <span className="ml-2 text-violet-deep">{t("· 你是创作者", "· you are the creator")}</span>
                        )}
                      </div>
                    </div>
                    <span className="mono shrink-0 text-[11px] text-muted">#{tr.blockNumber.toString()}</span>
                  </div>
                  <dl className="mt-2.5 grid grid-cols-3 gap-2">
                    <div>
                      <dt className="mono text-[9px] uppercase tracking-[0.12em] text-muted">Value</dt>
                      <dd className="mono mt-0.5 text-[12px] text-ink">{fmtMon(tr.price)}</dd>
                    </div>
                    <div>
                      <dt className="mono text-[9px] uppercase tracking-[0.12em] text-muted">Creator</dt>
                      <dd className="mono mt-0.5 text-[12px] font-semibold text-violet-deep">{fmtMon(tr.creatorCut)}</dd>
                    </div>
                    <div>
                      <dt className="mono text-[9px] uppercase tracking-[0.12em] text-muted">Platform</dt>
                      <dd className="mono mt-0.5 text-[12px] text-muted">{fmtMon(tr.platformCut)}</dd>
                    </div>
                  </dl>
                  <div className="mt-2.5 flex items-center justify-between gap-2">
                    <span className="mono text-[11px] text-ink">
                      {shortAddress(tr.applier)}
                      {isMine(tr.applier) && <span className="mono ml-2 text-[10px] text-violet-deep">{t("你", "you")}</span>}
                    </span>
                    <a
                      href={`${EXPLORER}/tx/${tr.txHash}`}
                      target="_blank"
                      rel="noreferrer"
                      className="link mono text-[11px]"
                    >
                      {tr.txHash.slice(0, 10)}… ↗
                    </a>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[560px] text-left text-sm md:min-w-0">
              <thead>
                <tr className="border-b border-hairline">
                  <Th>Block</Th>
                  <Th>Scheme</Th>
                  <Th>Applier</Th>
                  <Th right>Value</Th>
                  <Th right>Creator Cut</Th>
                  <Th right>Platform Cut</Th>
                  <Th right>Tx</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !isDemo &&
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-hairline">
                      <td className="px-2.5 py-3.5 sm:px-5 sm:py-4" colSpan={7}>
                        <div className="h-5 animate-pulse rounded bg-paper-2" />
                      </td>
                    </tr>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-14 text-center text-sm text-muted" colSpan={7}>
                      {filter === "all"
                        ? t(
                            "还没有任何交易 —— 去画廊挑一套方案应用到我家吧。",
                            "No trades yet — head to the gallery and apply a scheme to your home."
                          )
                        : t("这个筛选下暂无记录。", "No records under this filter.")}
                      {filter === "all" && (
                        <div className="mt-4">
                          <Link href="/demo" className="btn-secondary">
                            {t("去画廊", "Go to gallery")}
                          </Link>
                        </div>
                      )}
                    </td>
                  </tr>
                )}

                {rows.map((t) => (
                  <TradeRow
                    key={`${t.txHash}-${t.logIndex}`}
                    trade={t}
                    name={nameOf[t.tokenId.toString()]}
                    me={me}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mono mt-5 text-[11px] leading-relaxed text-muted">
          {t(
            "数据来源 · SchemeApplied 链上事件：全量历史索引（Envio HyperSync）+ 事件驱动增量（Alchemy Webhook，缺失时回退最近若干区块 RPC 扫描）。市场合约 ",
            "Source · SchemeApplied on-chain events: full-history index (Envio HyperSync) + event-driven increments (Alchemy webhooks; falls back to a recent-block RPC scan when absent). Market contract "
          )}
          {market ? shortAddress(market, 6) : t("未配置", "not configured")}
          {t("，收入在购买交易中即时分账。", "; revenue is split instantly within the purchase transaction.")}
        </p>
      </section>
    </div>
  );
}

function TradeRow({
  trade,
  name,
  me
}: {
  trade: TradeRecord;
  name?: string;
  me?: string;
}) {
  const { t } = useI18n();
  const isMine = (addr: string) => Boolean(me && addr.toLowerCase() === me);
  return (
    <tr className="border-b border-hairline last:border-0 hover:bg-paper-2/60">
      <Td>
        <span className="mono text-[12px] text-muted">#{trade.blockNumber.toString()}</span>
      </Td>
      <Td>
        <Link
          href={`/scheme/${trade.tokenId.toString()}`}
          className="font-semibold text-ink transition hover:text-violet-deep"
        >
          {name ?? t("方案 #{id}", "Scheme #{id}", { id: trade.tokenId.toString() })}
        </Link>
        <div className="mono mt-1 text-[10.5px] text-muted">
          TOKEN #{trade.tokenId.toString()}
          {isMine(trade.creator) && (
            <span className="ml-2 text-violet-deep">{t("· 你是创作者", "· you are the creator")}</span>
          )}
        </div>
      </Td>
      <Td>
        <span className="mono text-[11.5px] text-ink">{shortAddress(trade.applier)}</span>
        {isMine(trade.applier) && <span className="mono ml-2 text-[10px] text-violet-deep">{t("你", "you")}</span>}
      </Td>
      <Td right>
        <span className="mono text-[12.5px]">{fmtMon(trade.price)}</span>
      </Td>
      <Td right>
        <span className="mono text-[12.5px] font-semibold text-violet-deep">{fmtMon(trade.creatorCut)}</span>
      </Td>
      <Td right>
        <span className="mono text-[12.5px] text-muted">{fmtMon(trade.platformCut)}</span>
      </Td>
      <Td right>
        <a
          href={`${EXPLORER}/tx/${trade.txHash}`}
          target="_blank"
          rel="noreferrer"
          className="link mono text-[11px]"
        >
          {trade.txHash.slice(0, 10)}… ↗
        </a>
      </Td>
    </tr>
  );
}

function fmtMon(wei: bigint): string {
  const mon = Number(wei) / 1e18;
  return mon.toFixed(4);
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <dt className="mono text-[10px] uppercase tracking-[0.16em] text-white/45">{label}</dt>
      <dd className={`display mt-2 text-xl sm:text-2xl ${accent ? "text-violet" : "text-white"}`}>{value}</dd>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}

function Th({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <th
      className={`mono px-2.5 py-3 sm:px-5 sm:py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-2.5 py-3.5 sm:px-5 sm:py-4 ${right ? "text-right" : ""}`}>{children}</td>;
}
