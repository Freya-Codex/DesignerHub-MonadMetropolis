"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { useQueryClient } from "@tanstack/react-query";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { encodeFunctionData, type Address } from "viem";
import { dreamSchemeAddress, schemeMarketAddress, useSchemeDetail, useSchemes } from "@/lib/contracts";
import { schemeMarketAbi } from "@/lib/abis";
import {
  ensurePasskeyAccount,
  executeViaPasskey,
  loadStoredPasskey,
  onPasskeyChange,
  passkeyAccountAddress,
  type StoredPasskey
} from "@/lib/passkeyAccount";
import { demoSchemes } from "@/lib/demo";
import LineageTree from "@/components/LineageTree";
import PreviewImage from "@/components/PreviewImage";
import VersionTimeline from "@/components/VersionTimeline";
import CommentsSection from "@/components/CommentsSection";
import { monadTestnet } from "@/lib/chains";
import { generatorLabel, shortAddress } from "@/lib/scheme";
import { agentNameForId } from "@/lib/agents";
import { useI18n } from "@/lib/i18n";

export default function SchemeDetailPage() {
  const { t, pick } = useI18n();
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

  // Passkey signer (wallet-free): for setPrice; paid purchases still use a wallet
  const [pk, setPk] = useState<StoredPasskey | null>(null);
  const [passkeyAddr, setPasskeyAddr] = useState<Address | null>(null);
  const [busySetPrice, setBusySetPrice] = useState(false);
  const [busyPayout, setBusyPayout] = useState(false);
  useEffect(() => {
    const load = () => {
      const cred = loadStoredPasskey();
      setPk(cred);
      if (cred) {
        passkeyAccountAddress(cred)
          .then((a) => setPasskeyAddr(a ?? null))
          .catch(() => setPasskeyAddr(null));
      } else {
        setPasskeyAddr(null);
      }
    };
    load();
    return onPasskeyChange(load);
  }, []);

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
      setTxNote(t("未配置 SchemeMarket 合约地址", "SchemeMarket contract address not configured"));
      return;
    }
    if (switchChainAsync) {
      await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
    }
    const price = (detail?.price ?? 0n) as bigint;
    if (price <= 0n) {
      setTxNote(t("创作者尚未上架该方案（价格未设置）", "The creator has not listed this scheme yet (no price set)"));
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
      setTxNote(t("交易已提交：{hash}", "Transaction submitted: {hash}", { hash }));
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : t("交易失败", "Transaction failed"));
    }
  };

  const onSetPrice = async (priceWei: bigint) => {
    setTxNote("");
    const market = schemeMarketAddress();
    if (!market) {
      setTxNote(t("未配置 SchemeMarket 合约地址", "SchemeMarket contract address not configured"));
      return;
    }
    const cred = pk;
    const passkeyMode = !isConnected && Boolean(cred);
    if (passkeyMode && cred) {
      setBusySetPrice(true);
      try {
        const data = encodeFunctionData({
          abi: schemeMarketAbi,
          functionName: "setPrice",
          args: [tokenId ?? 0n, priceWei]
        });
        const account = await ensurePasskeyAccount(cred);
        const hash = await executeViaPasskey({ account, cred, to: market, data });
        setTxNote(t("定价交易已提交：{hash}", "Price transaction submitted: {hash}", { hash }));
        await refreshDetail();
      } catch (e) {
        setTxNote(e instanceof Error ? e.message : t("定价失败", "Pricing failed"));
      } finally {
        setBusySetPrice(false);
      }
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
      setTxNote(t("定价交易已提交：{hash}", "Price transaction submitted: {hash}", { hash }));
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : t("定价失败", "Pricing failed"));
    }
  };

  // Set the payout address (passkey wallet-free / MetaMask both fine). 0x0 = restore default (pay the creator address).
  const onSetPayout = async (payoutAddr: Address) => {
    setTxNote("");
    const market = schemeMarketAddress();
    if (!market) {
      setTxNote(t("未配置 SchemeMarket 合约地址", "SchemeMarket contract address not configured"));
      return;
    }
    const cred = pk;
    const passkeyMode = !isConnected && Boolean(cred);
    if (passkeyMode && cred) {
      setBusyPayout(true);
      try {
        const data = encodeFunctionData({
          abi: schemeMarketAbi,
          functionName: "setPayout",
          args: [tokenId ?? 0n, payoutAddr]
        });
        const account = await ensurePasskeyAccount(cred);
        const hash = await executeViaPasskey({ account, cred, to: market, data });
        setTxNote(t("收款地址已更新：{hash}", "Payout address updated: {hash}", { hash }));
        await refreshDetail();
      } catch (e) {
        setTxNote(e instanceof Error ? e.message : t("设置收款地址失败", "Failed to set payout address"));
      } finally {
        setBusyPayout(false);
      }
      return;
    }
    if (switchChainAsync) {
      await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
    }
    try {
      const hash = await setPriceAsync({
        address: market,
        abi: schemeMarketAbi,
        functionName: "setPayout",
        args: [tokenId ?? 0n, payoutAddr]
      });
      setTxNote(t("收款地址已更新：{hash}", "Payout address updated: {hash}", { hash }));
      await refreshDetail();
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : t("设置收款地址失败", "Failed to set payout address"));
    }
  };

  if (!tokenId) {
    return <div className="sheet p-8 text-sm text-muted">{t("无效的方案 ID。", "Invalid scheme ID.")}</div>;
  }

  if (isDemo) {
    if (!demo) {
      return (
        <div className="sheet p-8 text-sm text-muted">
          {t(
            "演示模式没有 #{id} 这个方案（可用 1-3）。部署合约后可查看链上数据。",
            "Demo mode has no scheme #{id} (available: 1-3). Deploy the contract to view on-chain data.",
            { id: tokenId.toString() }
          )}
        </div>
      );
    }
    return (
      <DetailFrame
        title={pick(demo.name, demo.nameEn)}
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
        {t("读取失败：", "Failed to load: ")}
        {error instanceof Error ? error.message : t("无数据", "no data")}
        {t(
          "。请确认已部署合约并配置 web/.env.local。",
          ". Please make sure the contract is deployed and web/.env.local is configured."
        )}
      </div>
    );
  }

  return (
    <DetailFrame
      title={pick(detail.name, detail.nameEn)}
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
      passkeyAddr={passkeyAddr ?? undefined}
      hasPasskey={Boolean(pk)}
      onSetPrice={onSetPrice}
      isSetPricePending={isSetPricePending || isPriceConfirming || busySetPrice}
      onSetPayout={onSetPayout}
      isSetPayoutPending={busyPayout}
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
  passkeyAddr?: Address;
  hasPasskey?: boolean;
  onSetPrice?: (priceWei: bigint) => void;
  isSetPricePending?: boolean;
  onSetPayout?: (payout: Address) => void;
  isSetPayoutPending?: boolean;
  setPriceError?: string | null;
  onApplied?: () => void;
}

function DetailFrame(props: DetailFrameProps) {
  const { t, pick } = useI18n();
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
    passkeyAddr,
    hasPasskey,
    onSetPrice,
    isSetPricePending,
    onSetPayout,
    isSetPayoutPending,
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
  const agentLabel = agentNameForId(agentId);
  // Prefer the scheme's own AI generator info (provider · model); fall back to the on-chain agentId label otherwise
  const genLabel = generatorLabel(d.generator);
  const generatorLine = genLabel || agentLabel;
  const canAct = !isDemoMode && Boolean(isConnected && onApply) && (price > 0n || isDemoMode);

  const versions: bigint[] = d.versionLine ?? [];
  const headId = versions.length > 0 ? versions[versions.length - 1] : (d.tokenId as bigint);
  const isCreator = Boolean(
    (account && d.creator && account.toLowerCase() === String(d.creator).toLowerCase()) ||
      (passkeyAddr && d.creator && passkeyAddr.toLowerCase() === String(d.creator).toLowerCase())
  );
  const isHead = headId === (d.tokenId as bigint);
  const canNewVersion = !isDemoMode && isCreator && isHead && versions.length >= 1;

  return (
    <div className="space-y-8">
      <nav className="eyebrow flex items-center gap-2">
        <Link href="/demo" className="transition hover:text-violet-deep">
          {t("画廊", "Gallery")}
        </Link>
        <span className="text-hairline">/</span>
        <span className="text-ink">{t("方案 #{id}", "Scheme #{id}", { id: d.tokenId.toString() })}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-5">
        {/* Blueprint */}
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
            <span>{t("效果图", "Interior Render")} · #{d.tokenId.toString()}</span>
            <span className="text-violet-deep">ERC-721 · ERC-2981</span>
          </figcaption>
        </figure>

        {/* Info panel */}
        <div className="sheet flex flex-col p-6 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            {d.parentId === 0n ? (
              <span className="chip">{t("ORIGIN · 原创", "ORIGIN")}</span>
            ) : (
              <Link href={`/scheme/${d.parentId.toString()}`} className="chip chip-violet">
                {t("REMIX 自 #{id}", "REMIX of #{id}", { id: d.parentId.toString() })}
              </Link>
            )}
            {versions.length > 1 && <span className="chip">v{versions.length}</span>}
          </div>

          <h1 className="display mt-4 text-[26px] text-ink sm:text-[30px]">{title}</h1>
          <p className="mt-3 text-[13px] leading-relaxed text-muted">
            {pick(d.description, d.descriptionEn)}
          </p>

          <dl className="mt-6 divide-y divide-hairline border-y border-hairline">
            <Row label={t("CREATOR / 创作者", "CREATOR")}>
              <a
                className="mono transition hover:text-violet-deep"
                href={`${explorerBase}/address/${creator}`}
                target="_blank"
                rel="noreferrer"
                title={t("在浏览器中查看", "View in explorer")}
              >
                {shortAddress(creator, 8)}
              </a>
            </Row>
            <Row label={t("PRICE / 使用权", "PRICE")}>
              {price > 0n ? (
                <span className="mono">{fmtMon(price)} MON</span>
              ) : (
                <span className="text-muted">{t("未上架", "Not listed")}</span>
              )}
            </Row>
            {generatorLine && (
              <Row label={t("AI / 生成器", "AI / Generator")}>
                <span className="chip chip-violet !py-0.5 !text-[10px]">
                  {generatorLine}
                  {agentId > 0n ? ` · agentId ${agentId.toString()}` : ""}
                </span>
              </Row>
            )}
            <Row label={t("ROOM / 房间", "ROOM")}>{pick(d.roomType, d.roomTypeEn)}</Row>
            <Row label={t("STYLE / 风格", "STYLE")}>{pick(d.theme, d.themeEn)}</Row>
            <Row label={t("FURNITURE / 家具", "FURNITURE")}>
              <span className="mono">{d.furnitureCount}</span> {t("件", "items")}
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
            <CreatorPricePanel
              price={price}
              pending={Boolean(isSetPricePending)}
              onSubmit={onSetPrice}
              payout={(d.payout as string) ?? ""}
              onSetPayout={onSetPayout}
              payoutPending={Boolean(isSetPayoutPending)}
            />
          )}

          {!isDemoMode && (
            <div className="mt-6 flex flex-col gap-2.5 sm:flex-row">
              <button onClick={onApply} disabled={!canAct || isApplyPending} className="btn-primary flex-1">
                {isApplyPending
                  ? t("交易确认中…", "Confirming…")
                  : isApplied
                    ? t("已应用到我家 ✓", "Applied to My Home ✓")
                    : price > 0n
                      ? t("应用到我家 · {price} MON", "Apply to My Home · {price} MON", {
                          price: fmtMon(price)
                        })
                      : t("未上架（创作者未定价）", "Not listed (no price set)")}
              </button>
              <Link href={`/remix/${d.tokenId.toString()}`} className="btn-secondary flex-1">
                Remix
              </Link>
            </div>
          )}

          {!isDemoMode && !isConnected && (
            <p className="mt-3 text-xs leading-relaxed text-muted">
              {hasPasskey
                ? t(
                    "「应用到我家」为付费操作，需连接钱包（MetaMask）；Passkey 可用于铸造 / Remix / 上架定价。",
                    "\"Apply to My Home\" is a paid action and requires a connected wallet (MetaMask); Passkey can be used for minting / Remix / listing & pricing."
                  )
                : t(
                    "连接 MetaMask 后即可应用或 Remix；也可在「Passkey」页创建通行密钥，免钱包铸造 / Remix。",
                    "Connect MetaMask to apply or Remix; you can also create a passkey on the \"Passkey\" page for wallet-free minting / Remix."
                  )}
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
              {t("查看交易 ↗", "View transaction ↗")} {applyTxHash.slice(0, 20)}…
            </a>
          )}

          <p className="mono mt-auto pt-6 text-[10px] uppercase tracking-[0.14em] text-muted">
            {splitNote}
          </p>
        </div>
      </div>

      <Panel eyebrow={t("Lineage · 可归因创作链", "Lineage · Attributable Creation Chain")} title={t("谱系树", "Lineage Tree")}>
        <LineageTree lineage={d.lineage ?? []} currentId={d.tokenId} names={namesFrom(allSchemes, pick)} />
        {d.children && d.children.length > 0 && (
          <p className="mono mt-4 text-[11px] text-muted">
            {t("直接衍生 · ", "Direct derivatives · ")}
            {d.children.map((id: bigint) => `#${id.toString()}`).join("  ")}
          </p>
        )}
      </Panel>

      <Panel
        eyebrow={t("Versions · 同一作者链", "Versions · Same-Author Chain")}
        title={t("版本时间线", "Version Timeline")}
        action={
          canNewVersion ? (
            <Link href={`/remix/${d.tokenId.toString()}?newVersion=1`} className="btn-primary !px-3.5 !py-1.5 !text-xs">
              {t("发布新版本 v{n}", "Publish New Version v{n}", { n: versions.length + 1 })}
            </Link>
          ) : undefined
        }
      >
        <VersionTimeline line={versions} currentId={d.tokenId} names={namesFrom(allSchemes, pick)} />
        {isCreator && !isHead && versions.length > 1 && (
          <p className="mt-4 text-xs leading-relaxed text-muted">
            {t("你的最新版本是 v", "Your latest version is v")}
            {versions.length}
            {t("（", " (")}
            <Link className="link" href={`/scheme/${headId.toString()}`}>
              #{headId.toString()}
            </Link>
            {t(
              "），在那里发布新版本可保持版本链连续。",
              "); publish a new version there to keep the version chain continuous."
            )}
          </p>
        )}
      </Panel>

      <CommentsSection tokenId={d.tokenId} />

      <div className="sheet p-6">
        <p className="eyebrow">{t("Asset · 资产说明", "Asset · Details")}</p>
        <div className="mt-4 space-y-2.5 break-words text-xs leading-relaxed text-muted">
          <p>
            <span className="mono text-ink">ERC-721 + ERC-2981</span>
            {t(
              "（版税 5%）；创作者在铸造时上链归因，NFT 转手不影响分账对象。",
              " (5% royalty); attribution is recorded on-chain at mint time, and resale does not change the split recipients."
            )}
          </p>
          <p>
            {t("「应用到我家」按创作者", "\"Apply to My Home\" is paid at the creator’s")}{" "}
            <code className="mono text-ink">setPrice</code>
            {t(" 自主定价支付，收入即时分账：", ", with revenue split instantly: ")}
            {splitNote}
            {t("。市场合约", ". Market contract ")}{" "}
            <code className="mono break-all text-ink">{schemeMarketAddress() ?? t("未配置", "Not configured")}</code>
            {t("，款项直达，无需提取。", " — funds are paid out directly, no withdrawal needed.")}
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

function namesFrom(
  allSchemes: any[],
  pick: <T>(zh: T, en: T | undefined) => T
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of allSchemes) map[s.tokenId.toString()] = pick(s.name, s.nameEn);
  return map;
}

/** Creator pricing panel: setPrice to list / reprice / delist (0 = delist); setPayout to direct revenue. */
function CreatorPricePanel({
  price,
  pending,
  onSubmit,
  payout,
  onSetPayout,
  payoutPending
}: {
  price: bigint;
  pending: boolean;
  onSubmit: (priceWei: bigint) => void;
  payout?: string;
  onSetPayout?: (payout: Address) => void;
  payoutPending?: boolean;
}) {
  const { t } = useI18n();
  const [input, setInput] = useState<string>(price > 0n ? fmtMon(price) : "");
  const ZERO = "0x0000000000000000000000000000000000000000";
  const hasPayout = Boolean(payout) && String(payout).toLowerCase() !== ZERO;
  const [payoutInput, setPayoutInput] = useState<string>(hasPayout ? String(payout) : "");
  const trimmed = payoutInput.trim();
  const payoutValid = trimmed === "" || /^0x[0-9a-fA-F]{40}$/.test(trimmed);
  const payoutChanged = trimmed === "" ? hasPayout : trimmed.toLowerCase() !== String(payout ?? "").toLowerCase();

  const parseMon = (v: string): bigint | null => {
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return BigInt(Math.round(n * 1e6)) * 10n ** 12n; // 1e18 精度
  };
  const wei = parseMon(input);
  const changed = wei !== null && wei !== price;

  return (
    <div className="mt-6 rounded-xl border border-violet/30 bg-violet/5 p-3.5">
      <p className="eyebrow mb-2 text-violet-deep">{t("SELLER / 创作者定价", "SELLER")}</p>
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
          {pending ? t("确认中…", "Confirming…") : price > 0n ? t("更新定价", "Update Price") : t("上架", "List")}
        </button>
        {price > 0n && (
          <button
            onClick={() => onSubmit(0n)}
            disabled={pending}
            className="btn-secondary !py-1.5 !text-[12px]"
          >
            {t("下架", "Unlist")}
          </button>
        )}
      </div>
      <p className="mt-2 text-[11px] leading-relaxed text-muted">
        {t(
          "定价后他人「应用到我家」按此价格支付，分账即时到账（原创 90/10，衍生 85/10/5）。",
          "Once priced, others pay this amount to \"apply to their home\", with splits paid out instantly (originals 90/10, derivatives 85/10/5)."
        )}
        {price > 0n
          ? t(" 设为 0 或点「下架」可暂停售卖。", " Set to 0 or click \"Unlist\" to pause sales.")
          : t(" 上架前该方案显示为「未上架」。", " Until listed, the scheme shows as \"Not listed\".")}
      </p>

      {onSetPayout && (
        <div className="mt-3 border-t border-violet/20 pt-3">
          <p className="mb-2 text-[11px] text-muted">
            {t(
              "收款地址（收益去向；留空并保存 = 收给创作者地址）",
              "Payout address (where earnings go; leave blank and save = pay the creator address)"
            )}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              value={payoutInput}
              onChange={(e) => setPayoutInput(e.target.value)}
              placeholder={ZERO}
              disabled={payoutPending}
              data-testid="creator-payout-input"
              className="mono w-full min-w-0 flex-1 rounded-lg border border-hairline bg-white px-2.5 py-1.5 text-[12px] outline-none focus:border-violet sm:w-64"
            />
            <button
              onClick={() => {
                if (trimmed === "") onSetPayout(ZERO as Address);
                else if (/^0x[0-9a-fA-F]{40}$/.test(trimmed)) onSetPayout(trimmed as Address);
              }}
              disabled={payoutPending || !payoutValid || !payoutChanged}
              data-testid="creator-payout-save"
              className="btn-secondary !py-1.5 !text-[12px]"
            >
              {payoutPending ? t("确认中…", "Confirming…") : t("保存收款地址", "Save Payout Address")}
            </button>
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-muted">
            {t("当前收款：", "Current payout: ")}
            <span className="mono">{hasPayout ? String(payout) : t("创作者地址（默认）", "creator address (default)")}</span>
            {t(
              "。Passkey 创作者可填自己的钱包地址，让收益直达钱包、不留在智能账户。",
              ". Passkey creators can enter their own wallet address so earnings go directly to the wallet instead of staying in the smart account."
            )}
          </p>
        </div>
      )}
    </div>
  );
}
