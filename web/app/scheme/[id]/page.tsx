"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useSwitchChain, useWalletClient } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { dreamSchemeAddress, schemeMarketAddress, useSchemeDetail, useSchemes, APPLY_PRICE } from "@/lib/contracts";
import { schemeMarketAbi } from "@/lib/abis";
import { demoSchemes } from "@/lib/demo";
import LineageTree from "@/components/LineageTree";
import VersionTimeline from "@/components/VersionTimeline";
import CommentsSection from "@/components/CommentsSection";
import { monadTestnet } from "@/lib/chains";
import { toHttpUrl } from "@/lib/ipfs";
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
    try {
      const hash = await applyAsync({
        address: market,
        abi: schemeMarketAbi,
        functionName: "applyScheme",
        args: [tokenId ?? 0n],
        value: APPLY_PRICE
      });
      setTxNote(`交易已提交：${hash}`);
    } catch (e) {
      setTxNote(e instanceof Error ? e.message : "交易失败");
    }
  };

  if (!tokenId) {
    return <div className="card p-8 text-sm text-zinc-500">无效的方案 ID。</div>;
  }

  if (isDemo) {
    if (!demo) {
      return (
        <div className="card p-8 text-sm text-zinc-500">
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
        <div className="card aspect-[16/10] animate-pulse bg-zinc-100 lg:col-span-3" />
        <div className="card h-64 animate-pulse bg-zinc-100 lg:col-span-2" />
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className="card p-8 text-sm text-red-700">
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
    isConnected
  } = props;

  const img = d.image ? toHttpUrl(d.image) : "/previews/placeholder.svg";
  const creator = d.creator as string;
  const explorerBase = "https://testnet.monadexplorer.com";
  const isDemoMode = !dreamSchemeAddress();
  const canAct = !isDemoMode && Boolean(isConnected && onApply);

  const versions: bigint[] = d.versionLine ?? [];
  const headId = versions.length > 0 ? versions[versions.length - 1] : (d.tokenId as bigint);
  const isCreator = Boolean(
    account && d.creator && account.toLowerCase() === String(d.creator).toLowerCase()
  );
  const isHead = headId === (d.tokenId as bigint);
  const canNewVersion = !isDemoMode && isCreator && isHead && versions.length >= 1;

  return (
    <div className="space-y-6">
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href="/" className="hover:text-zinc-900">画廊</Link>
        <span>/</span>
        <span className="text-zinc-900">方案 #{d.tokenId.toString()}</span>
      </nav>

      <div className="grid gap-6 lg:grid-cols-5">
        <div className="card overflow-hidden lg:col-span-3">
          <img src={img} alt={title} className="aspect-[16/10] w-full object-cover" />
        </div>

        <div className="card space-y-4 p-5 lg:col-span-2">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-black text-zinc-900">{title}</h1>
              {d.parentId === 0n ? (
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  原创
                </span>
              ) : (
                <Link
                  href={`/scheme/${d.parentId.toString()}`}
                  className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700 hover:bg-violet-200"
                >
                  Remix 自 #{d.parentId.toString()}
                </Link>
              )}
            </div>
            <p className="mt-2 text-sm leading-relaxed text-zinc-600">{d.description}</p>
          </div>

          <dl className="grid grid-cols-2 gap-3 text-sm">
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">创作者</dt>
              <dd className="mt-0.5 truncate font-mono text-xs">
                <a className="hover:text-indigo-600" href={`${explorerBase}/address/${creator}`} target="_blank" rel="noreferrer" title="在浏览器中查看">
                  {shortAddress(creator, 8)}
                </a>
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">房间</dt>
              <dd className="mt-0.5">{d.roomType}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">风格</dt>
              <dd className="mt-0.5">{d.theme}</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">家具数量</dt>
              <dd className="mt-0.5">{d.furnitureCount} 件</dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">Remix / 被应用</dt>
              <dd className="mt-0.5">
                🔁 {d.remixCount} / 🏠 {d.appliedCount}
              </dd>
            </div>
            <div className="rounded-xl bg-zinc-50 p-3">
              <dt className="text-[11px] text-zinc-500">内容哈希</dt>
              <dd className="mt-0.5 truncate font-mono text-[11px]" title={d.contentHash}>
                {String(d.contentHash).slice(0, 18)}…
              </dd>
            </div>
          </dl>

          {!isDemoMode && (
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                onClick={onApply}
                disabled={!canAct || isApplyPending}
                className="btn-primary flex-1"
              >
                {(isApplyPending ? "交易确认中…" : isApplied ? "✅ 已应用！" : "🏠 应用到我家（0.01 MON）")}
              </button>
              <Link href={`/remix/${d.tokenId.toString()}`} className="btn-secondary flex-1">
                🔁 Remix 这个方案
              </Link>
            </div>
          )}

          {!isDemoMode && !isConnected && (
            <p className="text-xs text-zinc-500">连接 MetaMask 后即可应用或 Remix（需使用 Monad 测试网）。</p>
          )}
          {txNote && <p className="break-all rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-600">{txNote}</p>}
          {applyError && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">{applyError}</p>}
          {applyTxHash && (
            <a
              href={`${explorerBase}/tx/${applyTxHash}`}
              target="_blank"
              rel="noreferrer"
              className="break-all text-xs text-indigo-600 underline"
            >
              查看交易：{applyTxHash}
            </a>
          )}
        </div>
      </div>

      <div className="card space-y-3 p-5">
        <h2 className="text-sm font-bold text-zinc-900">🌱 谱系树（可归因的创作链）</h2>
        <LineageTree lineage={d.lineage ?? []} currentId={d.tokenId} names={namesFrom(allSchemes)} />
        {d.children && d.children.length > 0 && (
          <div className="pt-2 text-xs text-zinc-500">
            直接衍生：{d.children.map((id: bigint) => `#${id.toString()}`).join("、")}
          </div>
        )}
      </div>

      <div className="card space-y-3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold text-zinc-900">🧬 版本时间线（同一作者链）</h2>
          {canNewVersion && (
            <Link
              href={`/remix/${d.tokenId.toString()}?newVersion=1`}
              className="btn-primary !px-3.5 !py-1.5 !text-xs"
            >
              🚀 发布新版本（v{versions.length + 1}）
            </Link>
          )}
        </div>
        <VersionTimeline line={versions} currentId={d.tokenId} names={namesFrom(allSchemes)} />
        {isCreator && !isHead && versions.length > 1 && (
          <p className="text-xs text-zinc-500">
            你的最新版本是 v{versions.length}（<Link className="text-indigo-600 underline" href={`/scheme/${headId.toString()}`}>#{headId.toString()}</Link>
            ），在那里发布新版本可保持版本链连续。
          </p>
        )}
      </div>

      <CommentsSection tokenId={d.tokenId} />

      <div className="card space-y-2 p-5 text-xs leading-relaxed text-zinc-500">
        <h2 className="text-sm font-bold text-zinc-900">📦 资产说明</h2>
        <p>ERC-721 + ERC-2981（版税 5%）；创作者在铸造时上链归因，NFT 转手不影响分账对象。</p>
        <p>
          「应用到我家」费用为 0.01 MON：90% 即时转给创作者，10% 累积到平台金库
          <code className="rounded bg-zinc-100 px-1">{schemeMarketAddress() ?? "未配置"}</code>，任何账户均可 withdraw。
        </p>
      </div>
    </div>
  );
}
function namesFrom(allSchemes: any[]): Record<string, string> {
  const map: Record<string, string> = {};
  for (const s of allSchemes) map[s.tokenId.toString()] = s.name;
  return map;
}
