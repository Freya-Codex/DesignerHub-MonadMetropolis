"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useSwitchChain } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import { dreamSchemeAbi } from "@/lib/abis";
import { dreamSchemeAddress, publicClientFor, useSchemeDetail } from "@/lib/contracts";
import { monadTestnet } from "@/lib/chains";
import { fetchUriJson } from "@/lib/ipfs";
import {
  applyRemixStyle,
  schemeToPreviewSvg,
  svgToDataUri,
  THEME_PRESETS,
  validateScheme,
  type DesignScheme
} from "@/lib/scheme";
import SchemePreview from "@/components/SchemePreview";

export default function RemixPage() {
  const params = useParams<{ id: string }>();
  const tokenId = useMemo(() => {
    const n = Number(params?.id);
    return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined;
  }, [params?.id]);

  const isDemoMode = !dreamSchemeAddress();
  const { data: detail } = useSchemeDetail(tokenId);

  const [base, setBase] = useState<DesignScheme | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [themeId, setThemeId] = useState<string>("nordic");
  const [palette, setPalette] = useState<string[]>([]);
  const [furnitureCount, setFurnitureCount] = useState<number>(5);
  const [note, setNote] = useState("");

  const [isNewVersion, setIsNewVersion] = useState(false);
  const [step, setStep] = useState<"idle" | "pin" | "mint">("idle");
  const [error, setError] = useState<string | null>(null);
  const [mintHash, setMintHash] = useState<Hex | undefined>(undefined);
  const [tokenIdOut, setTokenIdOut] = useState<bigint | null>(null);
  const [advice, setAdvice] = useState<string | null>(null);
  const [adviceBusy, setAdviceBusy] = useState(false);

  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash,
    confirmations: 1
  });

  // ?newVersion=1：从详情页「发布新版本」进入，parentId 指向自己的上一版
  useEffect(() => {
    setIsNewVersion(new URLSearchParams(window.location.search).get("newVersion") === "1");
  }, []);

  // 加载原方案：链上模式读取 IPFS 元数据里的 scheme；演示模式读取 assets 示例
  useEffect(() => {
    if (!tokenId) return;
    let cancelled = false;
    setLoadError(null);
    (async () => {
      try {
        let design: DesignScheme;
        if (isDemoMode) {
          const res = await fetch(`/api/demo/${tokenId.toString()}`);
          if (!res.ok) throw new Error("演示方案加载失败");
          design = (await res.json()) as DesignScheme;
        } else {
          if (!detail?.schemeUri) throw new Error("原方案元数据不可用");
          design = (await fetchUriJson(detail.schemeUri)) as DesignScheme;
        }
        if (validateScheme(design)) throw new Error("原方案 JSON 不合法");
        if (cancelled) return;
        setBase(design);
        setFurnitureCount(design.furniture.length);
        setPalette(design.style.palette);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "加载原方案失败");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, isDemoMode, detail?.schemeUri]);

  const remixed = useMemo(() => {
    if (!base) return null;
    return applyRemixStyle(base, {
      themeId,
      palette: palette.length ? palette : undefined,
      furnitureCount,
      note: note || undefined
    });
  }, [base, themeId, palette, furnitureCount, note]);

  const handleTheme = (id: string) => {
    setThemeId(id);
    const preset = THEME_PRESETS.find((t) => t.id === id);
    if (preset) setPalette([...preset.palette]);
  };

  const askKimi = async () => {
    if (!remixed) return;
    setAdviceBusy(true);
    try {
      const res = await fetch("/api/kimi", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roomType: remixed.room.type,
          dimensions: remixed.room.dimensions,
          style: remixed.style.theme,
          palette: remixed.style.palette,
          furniture: remixed.furniture,
          question: "这是我 remix 后的方案，请给出软装搭配与优化建议"
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "建议生成失败");
      setAdvice(data.advice);
    } catch (e) {
      setAdvice(e instanceof Error ? e.message : "建议生成失败");
    } finally {
      setAdviceBusy(false);
    }
  };

  const handleMintRemix = async () => {
    setError(null);
    setTokenIdOut(null);
    if (!tokenId || !remixed) return;
    const addr = dreamSchemeAddress();
    if (!addr) {
      setError("未配置合约地址，请先部署合约并写入 web/.env.local");
      return;
    }
    if (!isConnected) {
      setError("请先连接钱包");
      return;
    }
    setStep("pin");
    try {
      const designWithParent: DesignScheme = {
        ...remixed,
        parentId: Number(tokenId)
      };
      const previewDataUri = svgToDataUri(schemeToPreviewSvg(designWithParent));
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheme: designWithParent,
          previewImage: previewDataUri,
          name: designWithParent.name,
          description: designWithParent.description
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "固定到 IPFS 失败");

      setStep("mint");
      if (switchChainAsync) {
        await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
      }
      const hash = await writeContractAsync({
        address: addr,
        abi: dreamSchemeAbi,
        functionName: "mint",
        args: [tokenId, data.contentHash as Hex, data.tokenUri as string]
      });
      setMintHash(hash);
      setStep("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remix 铸造失败");
      setStep("idle");
    }
  };

  useEffect(() => {
    if (!isConfirmed || !mintHash || tokenIdOut !== null) return;
    void (async () => {
      try {
        const client = publicClientFor();
        if (!client) return;
        const receipt = await client.getTransactionReceipt({ hash: mintHash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: dreamSchemeAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "SchemeMinted" && decoded.args.parentId === tokenId) {
              setTokenIdOut(decoded.args.tokenId);
            }
          } catch {
            // 忽略
          }
        }
      } catch {
        // 收据解析失败不影响成功提示
      }
    })();
  }, [isConfirmed, mintHash, tokenId, tokenIdOut]);

  const busy = step !== "idle" || isWritePending || isConfirming;

  if (loadError) {
    return <div className="card p-8 text-sm text-red-700">加载原方案失败：{loadError}</div>;
  }
  if (!base || !remixed) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="card aspect-[16/10] animate-pulse bg-zinc-100" />
        <div className="card h-64 animate-pulse bg-zinc-100" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <nav className="flex items-center gap-2 text-xs text-zinc-500">
        <Link href={`/scheme/${tokenId?.toString()}`} className="hover:text-zinc-900">
          原方案 #{tokenId?.toString()}
        </Link>
        <span>/</span>
        <span className="text-zinc-900">Remix 编辑器</span>
      </nav>

      {isNewVersion && (
        <div className="rounded-2xl border border-indigo-200 bg-indigo-50 p-4 text-sm text-indigo-800">
          🧬 <b>新版本发布模式</b>：本次铸造的 parentId 将指向你自己的上一版 #
          {tokenId?.toString()}，作为该方案家族的 v{(detail?.versionLine?.length ?? 1) + 1}。
          版本时间线与归因都会自动上链。
        </div>
      )}

      <header>
        <h1 className="text-2xl font-black text-zinc-900">
          {isNewVersion ? "发布新版本" : "Remix"}「{base.name}」{isNewVersion && `（v${(detail?.versionLine?.length ?? 1) + 1}）`}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          修改风格/配色/家具数量后一键铸造，链上 parentId 指向 #{tokenId?.toString()}，谱系与归因自动生成。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-500">
              实时预览（Remix 后）
            </div>
            <SchemePreview scheme={remixed} />
          </div>

          <div className="card space-y-4 p-4">
            <h2 className="text-sm font-bold text-zinc-900">风格参数编辑器</h2>

            <div>
              <label className="field-label">主题</label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTheme(t.id)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      themeId === t.id
                        ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                        : "border-zinc-300 bg-white text-zinc-600 hover:bg-zinc-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">调色板</label>
              <div className="flex flex-wrap items-center gap-2">
                {(base.style.palette.length ? [base.style.palette, ...THEME_PRESETS.map((t) => t.palette)] : THEME_PRESETS.map((t) => t.palette))
                  .filter((p, i, arr) => arr.findIndex((q) => q.join() === p.join()) === i)
                  .map((p) => (
                    <button
                      key={p.join()}
                      onClick={() => setPalette([...p])}
                      title={p.join(", ")}
                      className={`flex overflow-hidden rounded-xl ring-2 transition ${
                        palette.join() === p.join() ? "ring-indigo-500" : "ring-transparent hover:ring-zinc-300"
                      }`}
                    >
                      {p.map((c) => (
                        <span key={c} className="h-7 w-7" style={{ backgroundColor: c }} />
                      ))}
                    </button>
                  ))}
              </div>
            </div>

            <div>
              <label className="field-label">
                家具数量：<b className="text-zinc-800">{furnitureCount}</b> 件
              </label>
              <div className="flex items-center gap-3">
                <button className="btn-secondary !px-3.5 !py-1.5" onClick={() => setFurnitureCount((n) => Math.max(3, n - 1))}>
                  −
                </button>
                <input
                  type="range"
                  min={3}
                  max={12}
                  value={furnitureCount}
                  onChange={(e) => setFurnitureCount(Number(e.target.value))}
                  className="w-full accent-indigo-600"
                />
                <button className="btn-secondary !px-3.5 !py-1.5" onClick={() => setFurnitureCount((n) => Math.min(12, n + 1))}>
                  +
                </button>
              </div>
            </div>

            <div>
              <label className="field-label">Remix 备注（可选）</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如：把沙发换成双人位、增加绿植"
                className="input"
              />
            </div>

            <button onClick={() => void askKimi()} disabled={adviceBusy} className="btn-ghost !border !border-zinc-300 w-full">
              {adviceBusy ? "Kimi 思考中…" : "💡 让 Kimi 给点优化建议"}
            </button>

            {advice && (
              <div className="whitespace-pre-wrap rounded-xl bg-zinc-50 p-3 text-xs leading-relaxed text-zinc-700">
                {advice}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="card space-y-3 p-4">
            <h2 className="text-sm font-bold text-zinc-900">铸造 Remix NFT</h2>
            <dl className="space-y-1.5 text-xs text-zinc-600">
              <div className="flex justify-between gap-4">
                <dt>父方案</dt>
                <dd>#{tokenId?.toString()}（{base.name}）</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>新名称</dt>
                <dd className="line-clamp-1">{remixed.name}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt>主题 / 家具</dt>
                <dd>
                  {remixed.style.theme} / {remixed.furniture.length} 件
                </dd>
              </div>
            </dl>
            <button onClick={() => void handleMintRemix()} disabled={busy} className="btn-primary w-full">
              {step === "pin" ? "🪐 固定到 IPFS…" : isWritePending ? "⛏ 铸造中…" : isConfirming ? "等待确认…" : "🔥 固定 + 铸造 Remix"}
            </button>
            {error && <div className="rounded-xl bg-red-50 p-3 text-xs leading-relaxed text-red-700">{error}</div>}
            {writeError && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{writeError.message}</div>}
            {mintHash && !tokenIdOut && (
              <a
                href={`https://testnet.monadexplorer.com/tx/${mintHash}`}
                target="_blank"
                rel="noreferrer"
                className="block break-all text-xs text-indigo-600 underline"
              >
                交易：{mintHash}
              </a>
            )}
            {tokenIdOut && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
                🎉 Remix 铸造成功！衍生方案 <b>#{tokenIdOut.toString()}</b> 的 parentId = #{tokenId?.toString()}
                <Link href={`/scheme/${tokenIdOut.toString()}`} className="mt-2 block font-semibold text-indigo-600 underline">
                  查看谱系与详情 →
                </Link>
              </div>
            )}
            {!isConnected && <p className="text-xs text-zinc-500">铸造前请先连接 MetaMask 并切换到 Monad 测试网。</p>}
          </div>

          <div className="card space-y-2 p-4 text-xs leading-relaxed text-zinc-500">
            <h3 className="text-sm font-bold text-zinc-900">归因与分账规则</h3>
            <p>✦ 本次铸造后你是新方案的 creator；链上 lineageOf 会把完整谱系（含原创）记入</p>
            <p>✦ 新方案被「应用到我家」时，90% 费用归你，10% 进入平台金库</p>
            <p>✦ 父方案原创作者不受影响，其收益基于自身被应用/被转售次数</p>
            <p>✦ 转售按 ERC-2981 收取 5% 版税给原创作者（或平台指定接收方）</p>
          </div>
        </div>
      </div>
    </div>
  );
}
