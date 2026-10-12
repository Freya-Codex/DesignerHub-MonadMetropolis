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
import { useI18n } from "@/lib/i18n";

type SchemeI18n = DesignScheme & {
  nameEn?: string;
  descriptionEn?: string;
  themeEn?: string;
  roomTypeEn?: string;
};

export default function RemixPage() {
  const { t, pick, lang } = useI18n();
  const params = useParams<{ id: string }>();
  const tokenId = useMemo(() => {
    const n = Number(params?.id);
    return Number.isFinite(n) && n > 0 ? BigInt(n) : undefined;
  }, [params?.id]);

  const isDemoMode = !dreamSchemeAddress();
  const { data: detail } = useSchemeDetail(tokenId);

  const [base, setBase] = useState<SchemeI18n | null>(null);
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
          const res = await fetch(`/api/demo/${tokenId.toString()}?lang=${lang}`);
          if (!res.ok) throw new Error(t("演示方案加载失败", "Failed to load demo scheme"));
          design = (await res.json()) as DesignScheme;
        } else {
          if (!detail?.schemeUri)
            throw new Error(t("原方案元数据不可用", "Source scheme metadata unavailable"));
          design = (await fetchUriJson(detail.schemeUri)) as DesignScheme;
        }
        if (validateScheme(design, lang))
          throw new Error(t("原方案 JSON 不合法", "Source scheme JSON is invalid"));
        if (cancelled) return;
        setBase(design as SchemeI18n);
        setFurnitureCount(design.furniture.length);
        setPalette(design.style.palette);
      } catch (e) {
        if (!cancelled)
          setLoadError(
            e instanceof Error ? e.message : t("加载原方案失败", "Failed to load source scheme")
          );
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [tokenId, isDemoMode, detail?.schemeUri, t, lang]);

  const remixed = useMemo<SchemeI18n | null>(() => {
    if (!base) return null;
    return applyRemixStyle(
      base,
      {
        themeId,
        palette: palette.length ? palette : undefined,
        furnitureCount,
        note: note || undefined
      },
      lang
    ) as SchemeI18n;
  }, [base, themeId, palette, furnitureCount, note, lang]);

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
          roomType: pick(remixed.room.type, remixed.room.typeEn),
          dimensions: remixed.room.dimensions,
          style: pick(remixed.style.theme, remixed.style.themeEn),
          palette: remixed.style.palette,
          furniture: remixed.furniture,
          lang,
          question: t(
            "这是我 remix 后的方案，请给出软装搭配与优化建议",
            "This is my remixed scheme — please suggest soft-furnishing pairings and optimizations"
          )
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t("建议生成失败", "Failed to generate advice"));
      setAdvice(data.advice);
    } catch (e) {
      setAdvice(e instanceof Error ? e.message : t("建议生成失败", "Failed to generate advice"));
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
      setError(
        t(
          "未配置合约地址，请先部署合约并写入 web/.env.local",
          "Contract address not configured; deploy the contract and write it into web/.env.local"
        )
      );
      return;
    }
    const cred = loadStoredPasskey();
    const walletMode = isConnected;
    const passkeyMode = !walletMode && Boolean(cred);
    if (!walletMode && !passkeyMode) {
      setError(
        t(
          "请先在「Passkey」页创建通行密钥，或在 /passkey 连接 MetaMask（备选）",
          "Create a passkey on the \"Passkey\" page first, or connect MetaMask at /passkey (alternative)"
        )
      );
      return;
    }
    setStep("pin");
    try {
      const designWithParent: DesignScheme = {
        ...remixed,
        parentId: Number(tokenId)
      };
      const previewDataUri = svgToDataUri(schemeToPreviewSvg(designWithParent, lang));
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheme: designWithParent,
          previewImage: previewDataUri,
          name: designWithParent.name,
          description: designWithParent.description,
          lang
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t("固定到 IPFS 失败", "Failed to pin to IPFS"));

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
      setError(e instanceof Error ? e.message : t("Remix 铸造失败", "Remix mint failed"));
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
        {t("加载原方案失败：", "Failed to load source scheme: ")}
        {loadError}
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
          {t("原方案 #{id}", "Source #{id}", { id: tokenId?.toString() ?? "" })}
        </Link>
        <span className="text-hairline">/</span>
        <span className="text-ink">{t("Remix 编辑器", "Remix Editor")}</span>
      </nav>

      <header className="rise">
        <p className="eyebrow">
          {isNewVersion
            ? t("New Version · 版本迭代", "New Version · Iteration")
            : t("Remix · 衍生创作", "Remix · Derivative Work")}
        </p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">
          {isNewVersion ? t("发布新版本", "Publish New Version") : "Remix"}「
          {pick(base.name, base.nameEn)}」
          {isNewVersion && <span className="mono text-violet"> v{(detail?.versionLine?.length ?? 1) + 1}</span>}
        </h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          {t(
            "修改风格 / 配色 / 家具数量后一键铸造，链上",
            "Tweak style / palette / furniture count and mint in one click; on-chain"
          )}{" "}
          <span className="mono text-ink">parentId</span>{" "}
          {t("指向", "points to")}{" "}
          <span className="mono text-ink">#{tokenId?.toString()}</span>
          {t("，谱系与归因自动生成。", ", with lineage and attribution generated automatically.")}
        </p>
      </header>

      {isNewVersion && (
        <div className="sheet border-violet/40 bg-violet/[0.06] p-5 text-[13px] leading-relaxed text-ink">
          <p className="mono mb-2 text-[10px] uppercase tracking-[0.14em] text-violet">
            {t("Version Chain · 新版本发布模式", "Version Chain · New Version Mode")}
          </p>
          {t(
            "本次铸造的 parentId 将指向你自己的上一版",
            "This mint’s parentId will point to your own previous version"
          )}{" "}
          #{tokenId?.toString()}
          {t("，作为该方案家族的 v", ", as v")}
          {(detail?.versionLine?.length ?? 1) + 1}
          {t(
            "。版本时间线与归因都会自动上链。",
            " of this scheme family. Version timeline and attribution are recorded on-chain automatically."
          )}
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="sheet grid-sheet overflow-hidden">
            <div className="border-b border-hairline px-5 py-3">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {t("Live Preview · Remix 后实时预览", "Live Preview · Remix Result")}
              </p>
            </div>
            <SchemePreview scheme={remixed} />
          </div>

          <div className="sheet space-y-6 p-5">
            <div>
              <p className="eyebrow">{t("Editor · 风格参数", "Editor · Style Parameters")}</p>
              <h2 className="display-sm mt-2 text-lg text-ink">
                {t("风格参数编辑器", "Style Parameter Editor")}
              </h2>
            </div>

            <div>
              <label className="field-label">{t("主题", "Theme")}</label>
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
                    {pick(t.label, t.labelEn)}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="field-label">{t("调色板", "Palette")}</label>
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
                {t("Furniture · 家具数量", "Furniture · Item Count")}{" "}
                <span className="mono text-ink">{furnitureCount}</span> {t("件", "items")}
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
              <label className="field-label">{t("Remix 备注（可选）", "Remix Note (optional)")}</label>
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder={t("例如：把沙发换成双人位、增加绿植", "e.g., swap the sofa for a two-seater, add plants")}
                className="input"
              />
            </div>

            <button onClick={() => void askKimi()} disabled={adviceBusy} className="btn-secondary w-full">
              {adviceBusy ? t("Kimi 思考中…", "Kimi is thinking…") : t("让 Kimi 给点优化建议", "Ask Kimi for suggestions")}
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
            <p className="eyebrow">{t("Mint · 铸造 Remix", "Mint · Remix")}</p>
            <h2 className="display-sm mt-2 text-lg text-ink">{t("铸造 Remix NFT", "Mint Remix NFT")}</h2>
            <dl className="mt-5 divide-y divide-hairline border-y border-hairline text-[13px]">
              <Row label={t("PARENT / 父方案", "PARENT")}>
                <span className="mono text-[12px]">#{tokenId?.toString()}</span>
                <span className="ml-2 text-muted">{pick(base.name, base.nameEn)}</span>
              </Row>
              <Row label={t("NAME / 新名称", "NAME")}>
                <span className="line-clamp-1">{pick(remixed.name, remixed.nameEn)}</span>
              </Row>
              <Row label="THEME / FURNITURE">
                {pick(remixed.style.theme, remixed.style.themeEn)} ·{" "}
                <span className="mono">{remixed.furniture.length}</span> {t("件", "items")}
              </Row>
              <Row label="CHAIN">
                <span className="mono">Monad Testnet · 10143</span>
              </Row>
              <Row label={t("SIGNER / 签名", "SIGNER")}>
                <span className="mono text-[12px]">
                  {useMetaMask ? "MetaMask" : usePasskey ? t("Passkey · 免 gas", "Passkey · gasless") : "—"}
                </span>
              </Row>
            </dl>

            <button onClick={() => void handleMintRemix()} disabled={busy} className="btn-primary mt-5 w-full">
              {step === "pin"
                ? t("固定到 IPFS…", "Pinning to IPFS…")
                : isWritePending
                  ? t("铸造中…", "Minting…")
                  : isConfirming
                    ? t("等待确认…", "Waiting for confirmation…")
                    : t("固定 + 铸造 Remix", "Pin + Mint Remix")}
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
                {t("交易已提交 ↗", "Transaction submitted ↗")} {mintHash.slice(0, 22)}…
              </a>
            )}
            {tokenIdOut && (
              <div className="mt-4 rounded-xl border border-violet/40 bg-violet/[0.06] p-4 text-[13px] text-ink">
                {t("Remix 铸造成功！衍生方案", "Remix minted successfully! The derivative scheme")}{" "}
                <span className="mono font-semibold text-violet-deep">#{tokenIdOut.toString()}</span>
                {t(" 的 parentId = #", " has parentId = #")}
                {tokenId?.toString()}
                <Link href={`/scheme/${tokenIdOut.toString()}`} className="btn-primary mt-3">
                  {t("查看谱系与详情", "View Lineage & Details")}
                </Link>
              </div>
            )}
            {usePasskey ? (
              <p className="mt-4 rounded-xl bg-violet/[0.06] p-3 text-xs leading-relaxed text-muted">
                {t("将用", "Mint with")}{" "}
                <span className="text-ink">{t("Passkey 智能账户", "a Passkey smart account")}</span>
                {t("铸造，relayer 代付 gas（无需 MetaMask、无需 MON）。", "; the relayer pays gas (no MetaMask, no MON needed).")}
              </p>
            ) : useMetaMask ? (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                {t(
                  "将用 MetaMask 铸造，请确认已切换到 Monad 测试网。",
                  "Mint with MetaMask — make sure you’ve switched to Monad Testnet."
                )}
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                {t(
                  "铸造前请先在「Passkey」页创建通行密钥，或在 /passkey 连接 MetaMask（备选）。",
                  "Before minting, create a passkey on the \"Passkey\" page, or connect MetaMask at /passkey (alternative)."
                )}
              </p>
            )}
          </div>

          <div className="sheet p-5">
            <p className="eyebrow">{t("Attribution · 归因与分账", "Attribution · Splits")}</p>
            <ul className="mt-4 space-y-3 text-xs leading-relaxed text-muted">
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">01</span>
                {t(
                  "本次铸造后你是新方案的 creator；链上 lineageOf 会把完整谱系（含原创）记入",
                  "After this mint you are the creator of the new scheme; on-chain lineageOf records the full lineage (including the origin)"
                )}
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">02</span>
                {t(
                  "新方案被「应用到我家」时，85% 费用归你、10% 给平台、5% 沿谱系回馈原创",
                  "When the new scheme is applied to a home, 85% of the fee goes to you, 10% to the platform, and 5% flows back along the lineage to the origin"
                )}
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">03</span>
                {t(
                  "父方案原创作者不受影响，其收益基于自身被应用 / 被转售次数",
                  "The original parent author is unaffected; their earnings depend on how often their own scheme is applied or resold"
                )}
              </li>
              <li className="flex gap-3">
                <span className="mono shrink-0 text-violet">04</span>
                {t(
                  "转售按 ERC-2981 收取 5% 版税给原创作者",
                  "Resales charge a 5% royalty to the original author under ERC-2981"
                )}
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
