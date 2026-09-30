"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { dreamSchemeAddress, schemeMarketAddress, useSchemeDetail, useSchemes } from "@/lib/contracts";
import { schemeMarketAbi } from "@/lib/abis";
import { demoSchemes } from "@/lib/demo";
import LineageTree from "@/components/LineageTree";
import PreviewImage from "@/components/PreviewImage";
import VersionTimeline from "@/components/VersionTimeline";
import CommentsSection from "@/components/CommentsSection";
import { monadTestnet } from "@/lib/chains";
import { shortAddress } from "@/lib/scheme";

export default function SchemeDetailPage() {
  const params = useParams<{ id: string }>();
  const tokenId = useMemo(() => {
    const n = Number(params?.id);
    return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined;
  }, [params?.id]);

  const { address: account, isConnected } = useAccount();
  const { data: walletClient } = useWalletClient();
  const { switchChainAsync } = useSwitchChain();
  const { data: detail, isLoading, error } = useSchemeDetail(tokenId);
  const queryClient = useQueryClient();
  const { data: allSchemes } = useSchemes();
  const [txNote, setTxNote] = useState<string>("");

  const isDemo = !dreamSchemeAddress();
  const demo = useMemo(
    () => (isDemo && tokenId ? demoSchemes.find((d) => d.tokenId === tokenId) : undefined),
    [isDemo, tokenId]
  );

  const {
    writeContractAsync: applyAsync,
    data: applyTxHash,
    isPending: isApplyPending,
    error: applyError
  } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isApplied } = useWaitForTransactionReceipt({
    hash: applyTxHash,
    confirmations: 1
  });

  const {
    writeContractAsync: setPriceAsync,
    data: priceTxHash,
    isPending: isSetPricePending,
    error: setPriceError
  } = useWriteContract();
  const { isLoading: isPriceConfirming, isSuccess: isPriceDone } = useWaitForTransactionReceipt({
    hash: priceTxHash,
    confirmations: 1
  });
  useEffect(() => {
    if (isPriceDone) refreshDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isPriceDone]);
  const refreshDetail = () =>
    queryClient.invalidateQueries({ queryKey: ["scheme-detail"] }).then(() =>
      queryClient.invalidateQueries({ queryKey: ["schemes"] })
    );

  const names = useMemo(() => {
    const map: Record<string, string> = {};
    for (const s of allSchemes ?? []) map[s.tokenId.toString()] = s.name;
    return map;
  }, [allSchemes]);

  const onApply = async () => {
    setTxNote("");
    const market = schemeMarketAddress();
    if (!market) {
      setTxNote("未配置 SchemeMarket 合约地址");
      return;
    }
    if (switchChainAsync) {
      await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
    }
    const price = (detail?.price ?? 0n) as bigint;
    if (price <= 0n) {
      setTxNote("创作者尚未上架该方案（价格未设置）");
      return;
    }
    try {
      const hash = await applyAsync({
        address: market,
        abi: schemeMarketAbi,
        functionName: "applyScheme",
        args: [tokenId ?? 0n],
        value: price
      });
      setTxNote(`交易已提交：${hash}`);
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : "交易失败");
    }
  };

  const onSetPrice = async (priceWei: bigint) => {
    setTxNote("");
    const market = schemeMarketAddress();
    if (!market) {
      setTxNote("未配置 SchemeMarket 合约地址");
      return;
    }
    if (switchChainAsync) {
      await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
    }
    try {
      const hash = await setPriceAsync({
        address: market,
        abi: schemeMarketAbi,
        functionName: "setPrice",
        args: [tokenId ?? 0n, priceWei]
      });
      setTxNote(`定价交易已提交：${hash}`);
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : "定价失败");
    }
  };

  if (!tokenId) {
    return <div className="sheet p-8 text-sm text-muted">无效的方案 ID。</div>;
  }

  if (isDemo) {
    if (!demo) {
      return (
        <div className="sheet p-8 text-sm text-muted">
          演示模式没有 #{tokenId.toString()} 这个方案（可用 1-3）。部署合约后可查看链上数据。
        </div>
      );
    }
    return (
      <DetailFrame
        title={demo.name}
        detail={{ ...demo, lineage: [demo.tokenId], versionLine: [demo.tokenId], children: [] as bigint[] }}
        allSchemes={allSchemes ?? demoSchemes}
      />
    );
  }

  if (isLoading) {
    return (
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="sheet aspect-[16/10] animate-pulse bg-paper-2 lg:col-span-3" />
        <div className="sheet h-72 animate-pulse bg-paper-2 lg:col-span-2" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="sheet border-coral/40 bg-coral/10 p-8 text-sm text-[#a53f52]">
        读取失败：{error instanceof Error ? error.message : "无数据"}。请确认已部署合约并配置
        web/.env.local。
      </div>
    );
  }

  return (
    <DetailFrame
      title={detail.name}
      detail={detail}
      allSchemes={allSchemes ?? []}
      account={account}
      onApply={onApply}
      isApplyPending={isApplyPending || isConfirming}
      isApplied={isApplied}
      applyTxHash={applyTxHash}
      applyError={applyError ? String(applyError) : undefined}
      txNote={txNote}
      isConnected={isConnected}
      onSetPrice={onSetPrice}
      isSetPricePending={isSetPricePending || isPriceConfirming}
      setPriceError={setPriceError ? String(setPriceError) : undefined}
      onApplied={refreshDetail}
    />
  );
}

interface DetailFrameProps {
  title: string;
  detail: any;
  allSchemes: any[];
  account?: `0x${string}`;
  onApply?: () => void;
  isApplyPending?: boolean;
  isApplied?: boolean;
  applyTxHash?: `0x${string}` | undefined;
  applyError?: string | null;
  txNote?: string;
  isConnected?: boolean;
  onSetPrice?: (priceWei: bigint) => void;
  isSetPricePending?: boolean;
  setPriceError?: string | null;
  onApplied?: () => void;
}

function DetailFrame(props: DetailFrameProps) {
  const {
    title,
    detail: d,
    allSchemes,
    account,
    onApply,
    isApplyPending,
    isApplied,
    applyTxHash,
    applyError,
    txNote,
    isConnected,
    onSetPrice,
    isSetPricePending,
    setPriceError,
    onApplied
  } = props;

  useEffect(() => {
    if (isApplied) onApplied?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isApplied]);

  const creator = d.creator as string;
  const explorerBase = "https://testnet.monadexplorer.com";
  const isDemoMode = !dreamSchemeAddress();
  const price: bigint = d.price ?? 0n;
  const isRemix = d.parentId !== undefined && d.parentId > 0n;
  const splitNote = isRemix ? "85% creator · 10% treasury · 5% lineage" : "90% creator · 10% treasury";
  const agentId: bigint = d.agentId ?? 0n;
  const agentLabel = agentId === 1n ? "Kimi" : agentId > 0n ? `Agent #${agentId.toString()}` : "";
  const canAct = !isDemoMode && Boolean(isConnected && onApply) && (price > 0n || isDemoMode);

  const versions: bigint[] = d.versionLine ?? [];
  const headId = versions.length > 0 ? versions[versions.length - 1] : (d.tokenId as bigint);
  const isCreator = Boolean(
    account && d.creator && account.toLowerCase() === String(d.creator).toLowerCase()
  );
  const isHead = headId === (d.tokenId as bigint);
  const canNewVersion = !isDemoMode && isCreator && isHead && versions.length >= 1;

  return (
    <div className="space-y-8">
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/demo" className="transition hover:text-violet-deep">
          画廊
        </Link>
        <span className="text-hairline">/</span>
        <span className="text-ink">方案 #{d.tokenId.toString()}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* 图纸 */}
        <figure className="sheet grid-sheet relative overflow-hidden lg:col-span-3">
          <span
            aria-hidden
            className="absolute left-3 top-3 z-10 h-5 w-5 border-l-2 border-t-2 border-violet"
          />
          <span
            aria-hidden
            className="absolute right-3 top-3 z-10 h-5 w-5 border-r-2 border-t-2 border-violet"
          />
          <PreviewImage uri={d.image} alt={title} className="aspect-[4/3] w-full object-cover" lazy={false} />
          <figcaption className="mono flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-t border-hairline bg-paper px-4 py-2.5 text-[10px] uppercase tracking-[0.16em] text-muted">
            <span>Floor Plan · #{d.tokenId.toString()} · Scale 1:50</span>
            <span className="text-violet-deep">ERC-721 · ERC-2981</span>
          </figcaption>
        </figure>

        {/* 信息面板 */}
        <div className="sheet flex flex-col p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {d.parentId === 0n ? (
              <span className="chip">ORIGIN · 原创</span>
            ) : (
              <Link href={`/scheme/${d.parentId.toString()}`} className="chip chip-violet">
                REMIX 自 #{d.parentId.toString()}
              </Link>
            )}
            {versions.length > 1 && <span className="chip">v{versions.length}</span>}
          </div>

          <h1 className="display mt-4 text-[26px] text-ink sm:text-[30px]">{title}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">{d.description}</p>

          <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
            <Row label="CREATOR / 创作者">
              <a
                className="mono transition hover:text-violet-deep"
                href={`${explorerBase}/address/${creator}`}
                target="_blank"
                rel="noreferrer"
                title="在浏览器中查看"
              >
                {shortAddress(creator, 8)}
              </a>
            </Row>
            <Row label="PRICE / 使用权">
              {price > 0n ? (
                <span className="mono">{fmtMon(price)} MON</span>
              ) : (
                <span className="text-muted">未上架</span>
              )}
            </Row>
            {agentLabel && (
              <Row label="AI / 生成器">
                <span className="chip chip-violet !py-0.5 !text-[10px]">{agentLabel} · agentId {agentId.toString()}</span>
              </Row>
            )}
            <Row label="ROOM / 房间">{d.roomType}</Row>
            <Row label="STYLE / 风格">{d.theme}</Row>
            <Row label="FURNITURE / 家具">
              <span className="mono">{d.furnitureCount}</span> 件
            </Row>
            <Row label="REMIX / APPLIED">
              <span className="mono">{d.remixCount}</span>
              <span className="mx-1.5 text-hairline">/</span>
              <span className="mono">{d.appliedCount}</span>
            </Row>
            <Row label="CONTENT HASH">
              <span className="mono text-[11px]" title={d.contentHash}>
                {String(d.contentHash).slice(0, 18)}…
              </span>
            </Row>
          </dl>

          {!isDemoMode && isCreator && onSetPrice && (
            <CreatorPricePanel price={price} pending={Boolean(isSetPricePending)} onSubmit={onSetPrice} />
          )}

          {!isDemoMode && (
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button onClick={onApply} disabled={!canAct || isApplyPending} className="btn-primary flex-1">
                {isApplyPending
                  ? "交易确认中…"
                  : isApplied
                    ? "已应用到我家 ✓"
                    : price > 0n
                      ? `应用到我家 · ${fmtMon(price)} MON`
                      : "未上架（创作者未定价）"}
              </button>
              <Link href={`/remix/${d.tokenId.toString()}`} className="btn-secondary flex-1">
                Remix
              </Link>
            </div>
          )}

          {!isDemoMode && !isConnected && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              连接 MetaMask 后即可应用或 Remix（需切换到 Monad 测试网）。
            </p>
          )}
          {txNote && (
            <p className="mono mt-3 break-all rounded-xl bg-paper-2 p-2.5 text-[11px] text-muted">{txNote}</p>
          )}
          {applyError && (
            <p className="mt-3 rounded-xl border border-coral/40 bg-coral/10 p-2.5 text-[11px] text-[#a53f52]">
              {applyError}
            </p>
          )}
          {setPriceError && (
            <p className="mt-3 rounded-xl border border-coral/40 bg-coral/10 p-2.5 text-[11px] text-[#a53f52]">
              {setPriceError}
            </p>
          )}
          {applyTxHash && (
            <a
              href={`${explorerBase}/tx/${applyTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="mono mt-3 break-all text-[11px] text-violet-deep hover:underline"
            >
              查看交易 ↗ {applyTxHash.slice(0, 20)}…
            </a>
          )}

          <p className="mono mt-auto pt-6 text-[10px] uppercase tracking-[0.14em] text-muted">
            {splitNote}
          </p>
        </div>
      </div>

      <Panel eyebrow="Lineage · 可归因创作链" title="谱系树">
        <LineageTree lineage={d.lineage ?? []} currentId={d.tokenId} names={namesFrom(allSchemes)} />
        {d.children && d.children.length > 0 && (
          <p className="mono mt-4 text-[11px] text-muted">
            直接衍生 · {d.children.map((id: bigint) => `#${id.toString()}`).join("  ")}
          </p>
        )}
      </Panel>

      <Panel
        eyebrow="Versions · 同一作者链"
        title="版本时间线"
        action={
          canNewVersion ? (
            <Link href={`/remix/${d.tokenId.toString()}?newVersion=1`} className="btn-primary !px-3.5 !py-1.5 !text-xs">
              发布新版本 v{versions.length + 1}
            </Link>
          ) : undefined
        }
      >
        <VersionTimeline line={versions} currentId={d.tokenId} names={namesFrom(allSchemes)} />
        {isCreator && !isHead && versions.length > 1 && (
          <p className="mt-4 text-xs leading-relaxed text-muted">
            你的最新版本是 v{versions.length}（
            <Link className="link" href={`/scheme/${headId.toString()}`}>
              #{headId.toString()}
            </Link>
            ），在那里发布新版本可保持版本链连续。
          </p>
        )}
      </Panel>

      <CommentsSection tokenId={d.tokenId} />

      <div className="sheet p-6">
        <p className="eyebrow">Asset · 资产说明</p>
        <div className="mt-4 space-y-2.5 text-xs leading-relaxed text-muted">
          <p>
            <span className="mono text-ink">ERC-721 + ERC-2981</span>（版税 5%）；创作者在铸造时上链归因，
            NFT 转手不影响分账对象。
          </p>
          <p>
            「应用到我家」按创作者 <code className="mono text-ink">setPrice</code> 自主定价支付，
            收入即时分账：{splitNote}。市场合约{" "}
            <code className="mono text-ink">{schemeMarketAddress() ?? "未配置"}</code>，款项直达，无需提取。
          </p>
        </div>
      </div>
    </div>
  );
}

function fmtMon(wei: bigint): string {
  const mon = Number(wei) / 1e18;
  return mon.toFixed(4);
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2.5">
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="text-right text-[13px] text-ink">{children}</dd>
    </div>
  );
}

function Panel({
  eyebrow,
  title,
  action,
  children
}: {
  eyebrow: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="sheet p-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="eyebrow">{eyebrow}</p>
          <h2 className="display-sm mt-2 text-xl text-ink">{title}</h2>
        </div>
        {action}
      </div>
      <div className="dim-line mt-4" />
      <div className="mt-5">{children}</div>
    </section>
  );
}

function namesFrom(allSchemes: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of allSchemes) map[s.tokenId.toString()] = s.name;
  return map;
}

/** 创作者定价面板：setPrice 上架 / 改价 / 下架（0 = 下架）。 */
function CreatorPricePanel({
  price,
  pending,
  onSubmit
}: {
  price: bigint;
  pending: boolean;
  onSubmit: (priceWei: bigint) => void;
}) {
  const [input, setInput] = useState<string>(price > 0n ? fmtMon(price) : "");

  const parseMon = (v: string): bigint | null => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return BigInt(Math.round(n * 1e6)) * 10n ** 12n; // 1e18 精度
  };
  const wei = parseMon(input);
  const changed = wei !== null && wei !== price;

  return (
    <div className="mt-6 rounded-xl border border-violet/30 bg-violet/5 p-3.5">
      <p className="eyebrow mb-2 text-violet-deep">SELLER / 创作者定价</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          inputMode="decimal"
          placeholder="0.01"
          disabled={pending}
          className="mono w-28 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[13px] outline-none focus:border-violet"
        />
        <span className="text-xs text-muted">MON</span>
        <button
          onClick={() => changed && wei !== null && onSubmit(wei)}
          disabled={pending || !changed || wei === null}
          className="btn-primary !py-1.5 !text-[12px]"
        >
          {pending ? "确认中…" : price > 0n ? "更新定价" : "上架"}
        </button>
        {price > 0n && (
          <button
            onClick={() => onSubmit(0n)}
            disabled={pending}
            className="btn-secondary !py-1.5 !text-[12px]"
          >
            下架
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        定价后他人「应用到我家」按此价格支付，分账即时到账（原创 90/10，衍生 85/10/5）。
        {price > 0n ? " 设为 0 或点「下架」可暂停售卖。" : " 上架前该方案显示为「未上架」。"}
      </p>
    </div>
  );
}
