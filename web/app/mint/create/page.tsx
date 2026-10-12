"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, encodeFunctionData, type Address, type Hex } from "viem";
import { dreamSchemeAbi, KIMI_AGENT_ID } from "@/lib/abis";
import { dreamSchemeAddress, publicClientFor } from "@/lib/contracts";
import { monadTestnet } from "@/lib/chains";
import { schemeToPreviewSvg, svgToDataUri, validateScheme, type DesignScheme } from "@/lib/scheme";
import {
  deployPasskeyAccount,
  executeViaPasskey,
  isAccountDeployed,
  loadStoredPasskey,
  passkeyAccountAddress,
  type StoredPasskey
} from "@/lib/passkeyAccount";
import { decodeSchemeCode, encodeSchemeCode } from "@/lib/schemeCodec";
import SchemePreview from "@/components/SchemePreview";
import { useI18n } from "@/lib/i18n";

type Step = "idle" | "pin" | "mint" | "done";

const SAMPLE_JSON = `{
  "version": "1.0",
  "name": "我的奶油风客厅",
  "description": "自己设计的客厅方案：圆润线条 + 奶油色系，温馨又耐看。",
  "room": { "type": "客厅", "dimensions": { "width": 4.5, "length": 5.8, "height": 2.7, "unit": "m" } },
  "style": { "theme": "奶油风", "palette": ["#FBF6EC", "#F3E3D3", "#E7C8A8", "#B98A68", "#FFFFFF"], "mood": "温柔治愈" },
  "furniture": [
    { "modelId": "sofa_curved_cream_01", "name": "奶油弧形沙发", "position": { "x": 1.0, "y": 0.5, "z": 0.1 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
    { "modelId": "coffee_table_marble_01", "name": "大理石圆茶几", "position": { "x": 2.1, "y": 1.7, "z": 0.1 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 0.8, "y": 0.8, "z": 0.8 } },
    { "modelId": "tv_stand_cream_01", "name": "奶油电视柜", "position": { "x": 4.6, "y": 3.1, "z": 0.1 }, "rotation": { "x": 0, "y": 90, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
    { "modelId": "floor_lamp_arc_02", "name": "拱形落地灯", "position": { "x": 0.7, "y": 3.9, "z": 0.1 }, "rotation": { "x": 0, "y": -10, "z": 0 }, "scale": { "x": 1, "y": 1, "z": 1 } },
    { "modelId": "rug_round_cream_01", "name": "奶油圆地毯", "position": { "x": 2.2, "y": 1.9, "z": 0.05 }, "rotation": { "x": 0, "y": 0, "z": 0 }, "scale": { "x": 1.6, "y": 1.6, "z": 1 } }
  ],
  "license": "CC-BY 4.0"
}`;

export default function CreatePage() {
  const { t, lang } = useI18n();
  const { isConnected } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync, data: mintHash, error: writeError, isPending: isWritePending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash: mintHash,
    confirmations: 1
  });

  const [raw, setRaw] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState("");
  const [nameOverride, setName] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string | null>(null);
  const [pinInfo, setPinInfo] = useState<{ tokenUri: string; schemeUri: string; contentHash: string } | null>(null);
  const [tokenId, setTokenId] = useState<bigint | null>(null);
  const [txHash, setTxHash] = useState<Hex | null>(null);
  const [pk, setPk] = useState<StoredPasskey | null>(null);
  const [pkAccount, setPkAccount] = useState<Address | null>(null);
  const [pkDeployed, setPkDeployed] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [inputMode, setInputMode] = useState<"json" | "code">("json");
  const [codeText, setCodeText] = useState("");
  const [codeNote, setCodeNote] = useState<string | null>(null);
  const [decoding, setDecoding] = useState(false);
  const [copied, setCopied] = useState(false);

  const scheme = useMemo<DesignScheme | null>(() => {
    if (!raw.trim()) return null;
    try {
      const obj = JSON.parse(raw) as unknown;
      return validateScheme(obj, lang) === null ? (obj as DesignScheme) : null;
    } catch {
      return null;
    }
  }, [raw, lang]);

  const validationError = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return validateScheme(JSON.parse(raw) as unknown, lang);
    } catch {
      return t("JSON 解析失败，请检查格式", "JSON parse failed, please check the format");
    }
  }, [raw, lang, t]);

  const displayScheme = useMemo(() => {
    if (!scheme) return null;
    const copy: DesignScheme = JSON.parse(JSON.stringify(scheme));
    if (nameOverride.trim()) copy.name = nameOverride.trim();
    return copy;
  }, [scheme, nameOverride]);

  // 从收据日志里解析 SchemeMinted 的 tokenId
  const tokenIdFromReceipt = useCallback(async (hash: Hex): Promise<bigint | null> => {
    try {
      const client = publicClientFor();
      if (!client) return null;
      const receipt = await client.getTransactionReceipt({ hash });
      for (const log of receipt.logs) {
        try {
          const decoded = decodeEventLog({ abi: dreamSchemeAbi, data: log.data, topics: log.topics });
          if (decoded.eventName === "SchemeMinted") return decoded.args.tokenId as bigint;
        } catch {
          // 忽略其他合约日志
        }
      }
    } catch {
      /* 收据解析失败 */
    }
    return null;
  }, []);

  // 载入本机 passkey（用于免 MetaMask 铸造）
  useEffect(() => {
    const c = loadStoredPasskey();
    if (!c) return;
    setPk(c);
    void (async () => {
      const acc = await passkeyAccountAddress(c).catch(() => undefined);
      if (!acc) return;
      setPkAccount(acc);
      setPkDeployed(await isAccountDeployed(acc).catch(() => false));
    })();
  }, []);

  // MetaMask 路径：交易确认后从收据日志解析 tokenId
  useEffect(() => {
    if (!isConfirmed || !mintHash || tokenId !== null) return;
    void (async () => {
      const id = await tokenIdFromReceipt(mintHash);
      setTokenId(id); // 解析失败时仍进入完成态
      setStep("done");
    })();
  }, [isConfirmed, mintHash, tokenId, tokenIdFromReceipt]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setRaw(text);
      setFileName(file.name);
    } catch {
      setError(t("文件读取失败", "Failed to read file"));
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    void handleFile(file);
  };

  const loadSample = async (id: number) => {
    setError(null);
    try {
      const res = await fetch(`/api/demo/${id}?lang=${lang}`);
      if (!res.ok) throw new Error(t("示例加载失败", "Failed to load sample"));
      const data = await res.json();
      setRaw(JSON.stringify(data, null, 2));
      setFileName(t("示例方案 {id}", "Sample scheme {id}", { id }));
    } catch (e) {
      setError(e instanceof Error ? e.message : t("示例加载失败", "Failed to load sample"));
    }
  };

  // 方案码（base64url）→ 方案 JSON
  const handleDecode = async () => {
    setError(null);
    setCodeNote(null);
    setDecoding(true);
    try {
      const { scheme, source, note } = await decodeSchemeCode(codeText);
      setRaw(JSON.stringify(scheme, null, 2));
      setFileName(source === "homeplan" ? t("方案码 · VirtuHome", "Scheme code · VirtuHome") : t("方案码", "Scheme code"));
      setCodeNote(`✓ ${note}`);
      setInputMode("json");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("方案码解析失败", "Failed to parse scheme code"));
    } finally {
      setDecoding(false);
    }
  };

  // 当前方案 → 方案码（写入剪贴板）
  const handleCopyCode = async () => {
    if (!displayScheme) return;
    setError(null);
    try {
      const code = await encodeSchemeCode(displayScheme);
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      setError(t("复制方案码失败（浏览器可能未授权剪贴板）", "Failed to copy scheme code (the browser may not have granted clipboard access)"));
    }
  };

  const handleMint = async () => {
    setError(null);
    setPinInfo(null);
    setTokenId(null);
    setTxHash(null);
    const addr = dreamSchemeAddress();
    if (!addr) {
      setError(
        t(
          "未配置 DreamScheme 合约地址。请先部署合约，并把地址写入 web/.env.local 后重启 dev 服务。",
          "DreamScheme contract address is not configured. Please deploy the contract first, write the address into web/.env.local, and restart the dev server."
        )
      );
      return;
    }
    if (!displayScheme) {
      setError(t("请先粘贴或上传有效的方案 JSON", "Please paste or upload a valid scheme JSON first"));
      return;
    }

    const useMetaMask = isConnected;
    const usePasskey = !useMetaMask && Boolean(pk);
    if (!useMetaMask && !usePasskey) {
      setError(t("请先在「Passkey」页创建通行密钥，或在 /passkey 连接 MetaMask（备选）。", "Please create a passkey on the \"Passkey\" page first, or connect MetaMask (fallback) at /passkey."));
      return;
    }

    setStep("pin");
    try {
      // 1) 固定到 IPFS（两条路径共用）
      const previewDataUri = svgToDataUri(schemeToPreviewSvg(displayScheme, lang));
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheme: displayScheme,
          previewImage: previewDataUri,
          name: displayScheme.name,
          description: displayScheme.description,
          lang
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? t("固定到 IPFS 失败", "Failed to pin to IPFS"));
      setPinInfo(data);

      const mintArgs = [0n, data.contentHash as Hex, KIMI_AGENT_ID, data.tokenUri as string] as const;

      if (useMetaMask) {
        // 2a) MetaMask（备选）
        setStep("mint");
        if (switchChainAsync) {
          await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
        }
        await writeContractAsync({ address: addr, abi: dreamSchemeAbi, functionName: "mint", args: mintArgs });
        return; // 收据确认后由 effect 解析 tokenId
      }

      // 2b) Passkey 智能账户 + relayer 代付（无需 MetaMask、无需持有 MON）
      if (!pk) throw new Error(t("缺少本机 passkey 记录", "Missing local passkey record"));
      setStep("mint");
      let account: Address | null = pkAccount ?? (await passkeyAccountAddress(pk)) ?? null;
      if (!account) throw new Error(t("无法推导 Passkey 账户地址", "Unable to derive the Passkey account address"));
      setPkAccount(account);
      if (!(await isAccountDeployed(account))) {
        const dep = await deployPasskeyAccount(pk);
        account = dep.account ?? account;
        setPkAccount(account);
      }
      setPkDeployed(true);
      const callData = encodeFunctionData({ abi: dreamSchemeAbi, functionName: "mint", args: mintArgs });
      const hash = await executeViaPasskey({ account, cred: pk, to: addr, data: callData });
      setTxHash(hash);
      const id = await tokenIdFromReceipt(hash);
      setTokenId(id);
      setStep("done");
    } catch (e) {
      setError(e instanceof Error ? e.message : t("铸造失败", "Minting failed"));
      setStep("idle");
    }
  };

  const busy = step === "pin" || step === "mint" || isWritePending || isConfirming;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="rise">
        <p className="eyebrow">{t("Create · 铸造原创方案", "Create · Mint original scheme")}</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">{t("创建原创方案", "Create original scheme")}</h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          {t("上传 JSON / 粘贴方案码 → 自动生成蓝图预览 → 固定到 IPFS → 铸造为 Monad 链上 NFT（", "Upload JSON / paste a scheme code → auto-generate a blueprint preview → pin to IPFS → mint as an NFT on Monad (")}
          <span className="mono text-ink">parentId = 0</span>
          {t("）。创作者地址在铸造时上链固化。", "). The creator address is committed on-chain at mint time.")}
        </p>
      </header>

      <div className="grid min-w-0 gap-6 lg:grid-cols-2 [&>*]:min-w-0">
        <div className="space-y-5">
          <div className="sheet p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="field-label !mb-0">{t("Scheme · 方案来源", "Scheme · Source")}</label>
              <div className="inline-flex rounded-lg border border-hairline p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setInputMode("json")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    inputMode === "json" ? "bg-violet text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {t("JSON 文件", "JSON file")}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode("code")}
                  className={`rounded-md px-2.5 py-1 transition ${
                    inputMode === "code" ? "bg-violet text-white" : "text-muted hover:text-ink"
                  }`}
                >
                  {t("方案码", "Scheme code")}
                </button>
              </div>
            </div>

            {inputMode === "json" ? (
              <>
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => fileRef.current?.click()}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") fileRef.current?.click();
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={onDrop}
                  className={`mt-3 grid min-h-[124px] cursor-pointer place-items-center rounded-xl border-2 border-dashed p-5 text-center transition ${
                    dragOver
                      ? "border-violet bg-violet/10"
                      : "border-hairline bg-paper-2/60 hover:border-violet/60 hover:bg-violet/[0.04]"
                  }`}
                >
                  <div className="text-sm">
                    <span
                      aria-hidden
                      className={`mono block text-[18px] ${dragOver ? "text-violet" : "text-muted"}`}
                    >
                      ⤓
                    </span>
                    <p className="mt-2 font-medium text-ink">
                      {dragOver ? t("松开即可载入", "Drop to load") : t("拖拽方案 JSON 到此处，或点击选择文件", "Drag a scheme JSON here, or click to choose a file")}
                    </p>
                    <p className="mono mt-1.5 text-[10.5px] uppercase tracking-[0.12em] text-muted">
                      .json / application/json
                    </p>
                  </div>
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".json,application/json"
                    className="hidden"
                    onChange={(e) => void handleFile(e.target.files?.[0])}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button className="btn-secondary !py-1.5 !text-xs" onClick={() => void loadSample(1)}>
                    {t("载入示例（北欧客厅）", "Load sample (Nordic living room)")}
                  </button>
                  <button
                    className="btn-secondary !py-1.5 !text-xs"
                    onClick={() => void handleCopyCode()}
                    disabled={!displayScheme}
                  >
                    {copied ? t("已复制 ✓", "Copied ✓") : t("复制方案码", "Copy scheme code")}
                  </button>
                  {fileName && <span className="mono text-[11px] text-muted">{t("已加载 · {name}", "Loaded · {name}", { name: fileName })}</span>}
                </div>
                <textarea
                  value={raw}
                  onChange={(e) => setRaw(e.target.value)}
                  rows={12}
                  spellCheck={false}
                  placeholder={SAMPLE_JSON}
                  className="input mono mt-3 text-xs leading-relaxed"
                />
                {validationError && (
                  <p className="mt-2 text-xs text-[#a53f52]">{validationError}</p>
                )}
              </>
            ) : (
              <>
                <p className="mt-3 text-xs leading-relaxed text-muted">
                  {t("粘贴 ", "Paste a ")}
                  <span className="mono">base64url</span>
                  {t(" 方案码（本站 DesignScheme 或 VirtuHome HomePlan），自动解码为方案 JSON 后走同一套预览 / 铸造流程。", " scheme code (this site's DesignScheme or VirtuHome HomePlan); it will be auto-decoded to scheme JSON and go through the same preview / mint flow.")}
                </p>
                <textarea
                  value={codeText}
                  onChange={(e) => setCodeText(e.target.value)}
                  rows={6}
                  spellCheck={false}
                  placeholder={t("粘贴方案码，例如：3sY9x…", "Paste a scheme code, e.g. 3sY9x…")}
                  className="input mono mt-3 text-xs leading-relaxed"
                />
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <button
                    className="btn-primary !py-1.5 !text-xs"
                    onClick={() => void handleDecode()}
                    disabled={decoding || !codeText.trim()}
                  >
                    {decoding ? t("解码中…", "Decoding…") : t("解析方案码", "Parse scheme code")}
                  </button>
                  {codeNote && <span className="mono text-[11px] text-violet-deep">{codeNote}</span>}
                </div>
              </>
            )}
          </div>

          <div className="sheet p-5">
            <label className="field-label">{t("Display Name · 方案名称（可选）", "Display Name · Scheme name (optional)")}</label>
            <input
              value={nameOverride}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("例如：我家客厅 v2", "e.g. My living room v2")}
              className="input"
            />
          </div>

          <button onClick={() => void handleMint()} disabled={busy || !displayScheme} className="btn-primary w-full">
            {step === "pin"
              ? t("固定到 IPFS…", "Pinning to IPFS…")
              : step === "mint" || isWritePending
                ? t("铸造 NFT…", "Minting NFT…")
                : isConfirming
                  ? t("等待链上确认…", "Waiting for on-chain confirmation…")
                  : t("固定 + 铸造", "Pin + mint")}
          </button>

          {error && (
            <div className="rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs leading-relaxed text-[#a53f52]">
              {error}
            </div>
          )}

          {pinInfo && (
            <div className="sheet space-y-2 p-5 text-xs">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-violet">{t("Pinned · 已固定到 IPFS", "Pinned · Stored on IPFS")}</p>
              <p className="break-all text-muted">
                contentHash <code className="mono text-ink">{pinInfo.contentHash}</code>
              </p>
              <p className="break-all text-muted">
                tokenUri <code className="mono text-ink">{pinInfo.tokenUri}</code>
              </p>
            </div>
          )}

          {tokenId !== null && (
            <div className="sheet border-violet/40 bg-violet/[0.06] p-5 text-sm">
              <p className="text-ink">
                {t("铸造成功！你的原创方案是 ", "Minted! Your original scheme is ")}
                <span className="mono font-semibold text-violet-deep">#{tokenId.toString()}</span>
              </p>
              {txHash && <p className="mono mt-2 break-all text-[11px] text-muted">tx: {txHash}</p>}
              <Link href={`/scheme/${tokenId.toString()}`} className="btn-primary mt-3">
                {t("查看方案详情", "View scheme details")}
              </Link>
            </div>
          )}

          {writeError && (
            <div className="rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs text-[#a53f52]">
              {writeError.message}
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            {t("格式要求：", "Format requirements: ")}
            <span className="mono text-ink">name</span>
            {t("、", ", ")}
            <span className="mono text-ink"> room.type</span>
            {t("、", ", ")}
            <span className="mono text-ink"> room.dimensions</span>(width/length/height)
            {t("、", ", ")}
            <span className="mono text-ink"> style.theme</span> +{" "}
            <span className="mono text-ink">style.palette</span>
            {t("，furniture 数组含 modelId 与 position/rotation/scale。", ", and a furniture array containing modelId and position/rotation/scale.")}
          </p>
        </div>

        <div className="space-y-5">
          <div className="sheet grid-sheet overflow-hidden">
            <div className="border-b border-hairline px-5 py-3">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-muted">
                {t("Preview · 自动生成蓝图预览", "Preview · Auto-generated blueprint")}
              </p>
            </div>
            {displayScheme ? (
              <SchemePreview scheme={displayScheme} />
            ) : (
              <div className="grid aspect-[16/10] place-items-center text-sm text-muted">
                {t("填写左侧 JSON 后自动生成预览", "Fill in the JSON on the left to auto-generate a preview")}
              </div>
            )}
          </div>

          {scheme && (
            <div className="sheet p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">{t("Summary · 参数摘要", "Summary · Parameters")}</p>
                <span className="chip chip-violet">{t("校验通过", "Validated")}</span>
              </div>
              <dl className="mt-4 divide-y divide-hairline border-y border-hairline text-[13px]">
                <SummaryRow label={t("ROOM / 房间", "ROOM")}>{scheme.room.type}</SummaryRow>
                <SummaryRow label={t("SIZE / 尺寸", "SIZE")}>
                  <span className="mono">
                    {scheme.room.dimensions.width} × {scheme.room.dimensions.length} ×{" "}
                    {scheme.room.dimensions.height} m
                  </span>
                </SummaryRow>
                <SummaryRow label={t("THEME / 风格", "THEME")}>{scheme.style.theme}</SummaryRow>
                <SummaryRow label={t("FURNITURE / 家具", "FURNITURE")}>
                  <span className="mono">{scheme.furniture.length}</span>{t(" 件", " items")}
                </SummaryRow>
              </dl>
              <div className="mt-4 flex flex-wrap items-center gap-2">
                {scheme.style.palette.slice(0, 5).map((c) => (
                  <span
                    key={c}
                    className="h-6 w-6 rounded-full border border-hairline"
                    style={{ backgroundColor: c }}
                    title={c}
                  />
                ))}
                <span className="mono ml-1 text-[11px] text-muted">{scheme.style.mood ?? ""}</span>
              </div>
              <p className="mt-4 text-xs leading-relaxed text-muted">
                {t("确认无误后点击左侧「固定 + 铸造」上链；名称可在上方覆盖 JSON 中的 name。", "Once everything looks right, click \"Pin + mint\" on the left to go on-chain; the name can be overridden above the JSON's name.")}
              </p>
            </div>
          )}

          <div className="sheet p-5">
            <p className="eyebrow">{t("Mint · 铸造信息", "Mint · Info")}</p>
            <dl className="mt-4 divide-y divide-hairline border-y border-hairline text-[13px]">
              <SummaryRow label="CONTRACT">
                <span className="mono break-all text-[11px]">{dreamSchemeAddress() ?? t("未配置", "Not configured")}</span>
              </SummaryRow>
              <SummaryRow label="PARENT">
                <span className="mono">{t("0 · 原创", "0 · original")}</span>
              </SummaryRow>
              <SummaryRow label="ROYALTY">
                <span className="mono">ERC-2981 · 5%</span>
              </SummaryRow>
              <SummaryRow label="NETWORK">
                <span className="mono">Monad Testnet · 10143</span>
              </SummaryRow>
              {isConnected ? (
                <SummaryRow label="SIGNER">
                  <span className="mono">{t("MetaMask · 备选", "MetaMask · fallback")}</span>
                </SummaryRow>
              ) : pkAccount ? (
                <SummaryRow label="SIGNER">
                  <span className="mono text-[11px]">Passkey · {pkAccount}</span>
                </SummaryRow>
              ) : null}
            </dl>
            {isConnected ? (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                {t("将用 MetaMask 铸造，请确认已切换到 Monad 测试网。", "You'll mint with MetaMask — please make sure you've switched to Monad Testnet.")}
              </p>
            ) : pk ? (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                {t("将用 Passkey 智能账户铸造，relayer 代付 gas（无需 MetaMask、无需持有 MON）。", "You'll mint with a Passkey smart account; the relayer covers gas (no MetaMask, no MON needed).")}
                {pkAccount && (pkDeployed ? t(" 账户已部署。", " The account is already deployed.") : t(" 首次铸造会自动部署账户。", " The account will be deployed automatically on first mint."))}
              </p>
            ) : (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                {t("铸造前请先在 ", "Before minting, ")}
                <Link href="/passkey" className="text-violet-deep underline">{t("Passkey 页", "Passkey page")}</Link>
                {t(" 创建通行密钥，或到 /passkey 连接 MetaMask（备选）。", " create a passkey, or connect MetaMask (fallback) at /passkey.")}
              </p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <dt className="mono shrink-0 text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="min-w-0 break-all text-right text-ink">{children}</dd>
    </div>
  );
}
