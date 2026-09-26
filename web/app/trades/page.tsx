"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useAccount, useChainId, useSwitchChain, useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { virtuHomeSchemeAddress, schemeMarketAddress, useSchemes } from "@/lib/contracts";
import { demoActivity, useActivity, type TradeRecord } from "@/lib/events";
import { demoSchemes } from "@/lib/demo";
import { schemeMarketAbi } from "@/lib/abis";
import { monadTestnet } from "@/lib/chains";
import { shortAddress } from "@/lib/scheme";

const EXPLORER = "https://testnet.monadexplorer.com";

type Filter = "all" | "bought" | "sold";

export default function TradesPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const isDemo = !virtuHomeSchemeAddress();
  const market = schemeMarketAddress();

  const { data: schemesData } = useSchemes();
  const { data: activityData, isLoading } = useActivity();
  const [filter, setFilter] = useState<Filter>("all");

  const schemes = schemesData && schemesData.length > 0 ? schemesData : isDemo ? demoSchemes : [];
  const activity = activityData && activityData.trades.length > 0 ? activityData : demoActivity;
  const me = address?.toLowerCase();

  const nameOf = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of schemes) map[s.tokenId.toString()] = s.name;
    return map;
  }, [schemes]);

  const totals = useMemo(() => {
    let volume = 0n;
    let creatorPaid = 0n;
    let platformPaid = 0n;
    let spent = 0n;
    let earned = 0n;
    for (const t of activity.trades) {
      volume += t.value;
      creatorPaid += t.creatorShare;
      platformPaid += t.platformShare;
      if (me && t.applier.toLowerCase() === me) spent += t.value;
      if (me && t.creator.toLowerCase() === me) earned += t.creatorShare;
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

  const {
    writeContractAsync: withdrawAsync,
    data: withdrawHash,
    isPending: isWithdrawing,
    error: withdrawError
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isWithdrawn } = useWaitForTransactionReceipt({
    hash: withdrawHash,
    confirmations: 1
  });

  const onWithdraw = async () => {
    if (!market) return;
    if (switchChainAsync) await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
    try {
      await withdrawAsync({ address: market, abi: schemeMarketAbi, functionName: "withdraw" });
    } catch {
      /* 错误由 withdrawError 呈现 */
    }
  };

  return (
    <div className="space-y-10">
      <header className="rise">
        <p className="eyebrow">Trades · 链上交易账本</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">交易记录</h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          每一次「应用到我家」都会触发 <span className="mono text-ink">SchemeApplied</span> 事件：
          费用按 <span className="mono text-ink">90%</span> 即时转给创作者、
          <span className="mono text-ink"> 10% </span>累积到平台金库。这里是完整、不可篡改的流水。
        </p>
      </header>

      {isDemo && (
        <div className="sheet flex flex-col gap-2 p-5 sm:flex-row sm:items-center sm:gap-5">
          <span className="chip chip-violet shrink-0 self-start">演示数据模式</span>
          <p className="text-[13px] leading-relaxed text-muted">
            尚未配置市场合约地址，以下为示例流水。部署并在 <code className="mono text-ink">web/.env.local</code>{" "}
            填入 <code className="mono text-ink">NEXT_PUBLIC_SCHEME_MARKET_ADDRESS</code> 后会切换为链上真实事件。
          </p>
        </div>
      )}

      {wrongNetwork && (
        <div className="sheet flex flex-col gap-3 border-coral/40 bg-coral/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[13px] leading-relaxed text-[#a53f52]">
            当前钱包不在 Monad 测试网（Chain ID 10143）。
          </p>
          <button
            className="btn-primary shrink-0"
            onClick={() => void switchChainAsync?.({ chainId: monadTestnet.id }).catch(() => undefined)}
          >
            切换网络
          </button>
        </div>
      )}

      {/* ── 总览 ───────────────────────────────────── */}
      <section className="sheet-dark grid-sheet-dark rise px-5 py-8 sm:px-9 sm:py-10">
        <p className="eyebrow eyebrow-dark">Ledger Overview · 账本总览</p>
        <dl className="mt-6 grid grid-cols-2 gap-x-8 gap-y-6 border-t border-white/10 pt-6 sm:grid-cols-4">
          <Stat label="APPLIES / 累计应用" value={String(totals.count)} />
          <Stat label="VOLUME / 累计成交" value={`${fmtMon(totals.volume)} MON`} />
          <Stat label="TO CREATORS / 创作者所得" value={`${fmtMon(totals.creatorPaid)} MON`} accent />
          <Stat label="TO TREASURY / 平台所得" value={`${fmtMon(totals.platformPaid)} MON`} />
        </dl>
      </section>

      {/* ── 我的分账 ───────────────────────────────── */}
      {isConnected && (
        <section className="sheet p-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="eyebrow">My Earnings · 我的分账</p>
              <h2 className="display-sm mt-2 text-xl text-ink">我的支出与收入</h2>
            </div>
            <span className="mono text-[11px] text-muted">{shortAddress(address, 6)}</span>
          </div>
          <div className="dim-line mt-4" />
          <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
            <Row label="SPENT / 我支付的费用">
              <span className="mono font-semibold text-ink">{fmtMon(totals.spent)} MON</span>
            </Row>
            <Row label="EARNED / 我作为创作者收到">
              <span className="mono font-semibold text-violet-deep">{fmtMon(totals.earned)} MON</span>
            </Row>
            <Row label="PENDING / 待提取（合约内）">
              <span className="mono text-muted">
                {market ? "在下方提取，或到浏览器查看 pendingWithdrawals" : "未配置市场合约"}
              </span>
            </Row>
          </dl>

          {market && (
            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center">
              <button
                onClick={() => void onWithdraw()}
                disabled={isWithdrawing || isConfirming || !market}
                className="btn-primary"
              >
                {isWithdrawing || isConfirming ? "提取中…" : isWithdrawn ? "已提取 ✓" : "提取待领份额"}
              </button>
              <a
                className="link mono text-[11px]"
                href={`${EXPLORER}/address/${market}#writeContract`}
                target="_blank"
                rel="noreferrer"
              >
                在浏览器中查看金库 ↗
              </a>
            </div>
          )}
          {withdrawError && (
            <p className="mt-3 rounded-xl border border-coral/40 bg-coral/10 p-2.5 text-[11px] text-[#a53f52]">
              {withdrawError.message}
            </p>
          )}
          {withdrawHash && (
            <a
              href={`${EXPLORER}/tx/${withdrawHash}`}
              target="_blank"
              rel="noreferrer"
              className="mono mt-3 block break-all text-[11px] text-violet-deep hover:underline"
            >
              提取交易 ↗ {withdrawHash.slice(0, 24)}…
            </a>
          )}
        </section>
      )}

      {/* ── 流水表 ─────────────────────────────────── */}
      <section>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="eyebrow">Flow · 交易流水</p>
            <h2 className="display-sm mt-2 text-2xl text-ink">全部应用记录</h2>
          </div>
          <div className="flex items-center gap-1 rounded-xl border border-hairline bg-white p-1">
            {(
              [
                ["all", "全部"],
                ["bought", "我买到的"],
                ["sold", "我卖出的"]
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
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead>
                <tr className="border-b border-hairline">
                  <Th>Block</Th>
                  <Th>Scheme</Th>
                  <Th>Applier</Th>
                  <Th right>Value</Th>
                  <Th right>Creator 90%</Th>
                  <Th right>Treasury 10%</Th>
                  <Th right>Tx</Th>
                </tr>
              </thead>
              <tbody>
                {isLoading && !isDemo &&
                  [0, 1, 2].map((i) => (
                    <tr key={i} className="border-b border-hairline">
                      <td className="px-5 py-4" colSpan={7}>
                        <div className="h-5 animate-pulse rounded bg-paper-2" />
                      </td>
                    </tr>
                  ))}

                {!isLoading && rows.length === 0 && (
                  <tr>
                    <td className="px-5 py-14 text-center text-sm text-muted" colSpan={7}>
                      {filter === "all"
                        ? "还没有任何交易 —— 去画廊挑一套方案应用到我家吧。"
                        : "这个筛选下暂无记录。"}
                      {filter === "all" && (
                        <div className="mt-4">
                          <Link href="/" className="btn-secondary">
                            去画廊
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
          数据来源 · SchemeApplied 事件（fromBlock 0 → latest）。平台金库地址{" "}
          {market ? shortAddress(market, 6) : "未配置"}，任何账户均可调用 withdraw()。
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
          {name ?? `方案 #${trade.tokenId.toString()}`}
        </Link>
        <div className="mono mt-1 text-[10.5px] text-muted">
          TOKEN #{trade.tokenId.toString()}
          {isMine(trade.creator) && <span className="ml-2 text-violet-deep">· 你是创作者</span>}
        </div>
      </Td>
      <Td>
        <span className="mono text-[11.5px] text-ink">{shortAddress(trade.applier)}</span>
        {isMine(trade.applier) && <span className="mono ml-2 text-[10px] text-violet-deep">你</span>}
      </Td>
      <Td right>
        <span className="mono text-[12.5px]">{fmtMon(trade.value)}</span>
      </Td>
      <Td right>
        <span className="mono text-[12.5px] font-semibold text-violet-deep">{fmtMon(trade.creatorShare)}</span>
      </Td>
      <Td right>
        <span className="mono text-[12.5px] text-muted">{fmtMon(trade.platformShare)}</span>
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
      className={`mono px-5 py-3.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted ${
        right ? "text-right" : ""
      }`}
    >
      {children}
    </th>
  );
}

function Td({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return <td className={`px-5 py-4 ${right ? "text-right" : ""}`}>{children}</td>;
}
