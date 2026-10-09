"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useAccount, useSwitchChain } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, encodeFunctionData, type Hex } from "viem";
import { dreamSchemeAbi, KIMI_AGENT_ID } from "@/lib/abis";
import { dreamSchemeAddress, publicClientFor, useSchemeDetail } from "@/lib/contracts";
import {
  ensurePasskeyAccount,
  executeViaPasskey,
  loadStoredPasskey,
  onPasskeyChange,
  type StoredPasskey
} from "@/lib/passkeyAccount";
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

  // 签名者选择：连了 MetaMask 优先 MetaMask，否则用本机 passkey（免钱包）
  const [pk, setPk] = useState<StoredPasskey | null>(null);
  const [busyPasskey, setBusyPasskey] = useState(false);
  useEffect(() => {
    const load = () => setPk(loadStoredPasskey());
    load();
    return onPasskeyChange(load);
  }, []);
  const useMetaMask = isConnected;
  const usePasskey = !useMetaMask && Boolean(pk);

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
    const cred = loadStoredPasskey();
    const walletMode = isConnected;
    const passkeyMode = !walletMode && Boolean(cred);
    if (!walletMode && !passkeyMode) {
      setError("请先在「Passkey」页创建通行密钥，或在 /passkey 连接 MetaMask（备选）");
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
      if (passkeyMode && cred) {
        setBusyPasskey(true);
        const callData = encodeFunctionData({
          abi: dreamSchemeAbi,
          functionName: "remix",
          args: [tokenId, data.contentHash as Hex, KIMI_AGENT_ID, data.tokenUri as string]
        });
        const account = await ensurePasskeyAccount(cred);
        const hash = await executeViaPasskey({ account, cred, to: addr, data: callData });
        setMintHash(hash);
      } else {
        if (switchChainAsync) {
          await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
        }
        const hash = await writeContractAsync({
          address: addr,
          abi: dreamSchemeAbi,
          functionName: "remix",
          args: [tokenId, data.contentHash as Hex, KIMI_AGENT_ID, data.tokenUri as string]
        });
        setMintHash(hash);
      }
      setStep("idle");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Remix 铸造失败");
      setStep("idle");
    } finally {
      setBusyPasskey(false);
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

  const busy = step !== "idle" || isWritePending || isConfirming || busyPasskey;

  if (loadError) {
    return (
      <div className="sheet border-coral/40 bg-coral/10 p-8 text-sm text-[#a53f52]">
        加载原方案失败：{loadError}
      </div>
    );
  }
  if (!base || !remixed) {
    return (
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="sheet aspect-[16/10] animate-pulse bg-paper-2" />
        <div className="sheet h-72 animate-pulse bg-paper-2" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <nav className="eyebrow flex items-center gap-2">
        <Link href={`/scheme/${tokenId?.toString()}`} className="transition hover:text-violet-deep">
          原方案 #{tokenId?.toString()}
        </Link>
        <span className="text-hairline">/</span>
        <span className="text-ink">Remix 编辑器</span>
      </nav>

      <header className="rise">
        <p className="eyebrow">{isNewVersion ? "New Version · 版本迭代" : "Remix · 衍生创作"}</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">
          {isNewVersion ? "发布新版本" : "Remix"}「{base.name}」
          {isNewVersion && <span className="mono text-violet"> v{(detail?.versionLine?.length ?? 1) + 1}</span>}
        </h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          修改风格 / 配色 / 家具数量后一键铸造，链上{" "}
          <span className="mono text-ink">parentId</span> 指向{" "}
          <span className="mono text-ink">#{tokenId?.toString()}</span>，谱系与归因自动生成。
        </p>
      </header>

      {isNewVersion && (
        <div className="sheet border-violet/40 bg-violet/[0.06] p-5 text-[13px] leading-relaxed text-ink">
          <p className="mono mb-2 text-[10px] uppercase tracking-[0.14em] text-violet">
            Version Chain · 新版本发布模式
          </p>
          本次铸造的 parentId 将指向你自己的上一版 #{tokenId?.toString()}，作为该方案家族的 v
          {(detail?.versionLine?.length ?? 1) + 1}。版本时间线与归因都会自动上链。
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="sheet grid-sheet overflow-hidden">
            <div className="border-b border-hairline px-5 py-3">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Live Preview · Remix 后实时预览
              </p>
            </div>
            <SchemePreview scheme={remixed} />
          </div>

          <div className="sheet space-y-6 p-5">
            <div>
              <p className="eyebrow">Editor · 风格参数</p>
              <h2 className="display-sm mt-2 text-lg text-ink">风格参数编辑器</h2>
            </div>

            <div>
              <label className="field-label">主题</label>
              <div className="grid grid-cols-3 gap-2">
                {THEME_PRESETS.map((t) => (
                  <button
                    key={t.id}
                    onClick={() => handleTheme(t.id)}
                    className={`rounded-xl border px-2 py-2 text-xs font-semibold transition ${
                      themeId === t.id
                        ? "border-violet bg-violet/10 text-violet-deep"
                        : "border-hairline bg-white text-muted hover:border-violet/50 hover:text-ink"
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
                        palette.join() === p.join() ? "ring-violet" : "ring-transparent hover:ring-violet/40"
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
                Furniture · 家具数量 <span className="mono text-ink">{furnitureCount}</span> 件
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
                  className="w-full"
                  style={{ accentColor: "#6E54FF" }}
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

            <button onClick={() => void askKimi()} disabled={adviceBusy} className="btn-secondary w-full">
              {adviceBusy ? "Kimi 思考中…" : "让 Kimi 给点优化建议"}
            </button>

            {advice && (
              <div className="whitespace-pre-wrap rounded-xl bg-paper-2 p-4 text-xs leading-relaxed text-ink">
                {advice}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="sheet p-5">
            <p className="eyebrow">Mint · 铸造 Remix</p>
            <h2 className="display-sm mt-2 text-lg text-ink">铸造 Remix NFT</h2>
            <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
              <Row label="PARENT / 父方案">
                <span className="mono text-[12px]">#{tokenId?.toString()}</span>
                <span className="ml-2 text-muted">{base.name}</span>
              </Row>
              <Row label="NAME / 新名称">
                <span className="line-clamp-1">{remixed.name}</span>
              </Row>
              <Row label="THEME / FURNITURE">
                {remixed.style.theme} · <span className="mono">{remixed.furniture.length}</span> 件
              </Row>
              <Row label="CHAIN">
                <span className="mono">Monad Testnet · 10143</span>
              </Row>
              <Row label="SIGNER / 签名">
                <span className="mono text-[12px]">
                  {useMetaMask ? "MetaMask" : usePasskey ? "Passkey · 免 gas" : "—"}
                </span>
              </Row>
            </dl>

            <button onClick={() => void handleMintRemix()} disabled={busy} className="btn-primary mt-5 w-full">
              {step === "pin" ? "固定到 IPFS…" : isWritePending ? "铸造中…" : isConfirming ? "等待确认…" : "固定 + 铸造 Remix"}
            </button>

            {error && (
              <div className="mt-4 rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs leading-relaxed text-[#a53f52]">
                {error}
              </div>
            )}
            {writeError && (
              <div className="mt-4 rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs text-[#a53f52]">
                {writeError.message}
              </div>
            )}
            {mintHash && !tokenIdOut && (
              <a
                href={`https://testnet.monadexplorer.com/tx/${mintHash}`}
                target="_blank"
                rel="noreferrer"
                className="mono mt-4 block break-all text-[11px] text-violet-deep hover:underline"
              >
                交易已提交 ↗ {mintHash.slice(0, 22)}…
              </a>
            )}
            {tokenIdOut && (
              <div className="mt-4 rounded-xl border border-violet/40 bg-violet/[0.06] p-4 text-[13px] text-ink">
                Remix 铸造成功！衍生方案{" "}
                <span className="mono font-semibold text-violet-deep">#{tokenIdOut.toString()}</span> 的 parentId = #
                {tokenId?.toString()}
                <Link href={`/scheme/${tokenIdOut.toString()}`} className="btn-primary mt-3">
                  查看谱系与详情
                </Link>
              </div>
            )}
            {usePasskey ? (
              <p className="mt-4 rounded-xl bg-violet/[0.06] p-3 text-xs leading-relaxed text-muted">
                将用 <span className="text-ink">Passkey 智能账户</span>铸造，relayer 代付 gas（无需 MetaMask、无需 MON）。
              </p>
            ) : useMetaMask ? (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                将用 MetaMask 铸造，请确认已切换到 Monad 测试网。
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                铸造前请先在「Passkey」页创建通行密钥，或在 /passkey 连接 MetaMask（备选）。
              </p>
            )}
          </div>

          <div className="sheet p-5">
            <p className="eyebrow">Attribution · 归因与分账</p>
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">01</span>
                本次铸造后你是新方案的 creator；链上 lineageOf 会把完整谱系（含原创）记入
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">02</span>
                新方案被「应用到我家」时，85% 费用归你、10% 给平台、5% 沿谱系回馈原创
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">03</span>
                父方案原创作者不受影响，其收益基于自身被应用 / 被转售次数
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">04</span>
                转售按 ERC-2981 收取 5% 版税给原创作者
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="flex items-center text-right text-ink">{children}</dd>
    </div>
  );
}
