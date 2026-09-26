"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import { virtuHomeSchemeAbi } from "@/lib/abis";
import { virtuHomeSchemeAddress, publicClientFor } from "@/lib/contracts";
import { monadTestnet } from "@/lib/chains";
import { schemeToPreviewSvg, svgToDataUri, validateScheme, type DesignScheme } from "@/lib/scheme";
import SchemePreview from "@/components/SchemePreview";

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
  const fileRef = useRef<HTMLInputElement>(null);

  const scheme = useMemo<DesignScheme | null>(() => {
    if (!raw.trim()) return null;
    try {
      const obj = JSON.parse(raw) as unknown;
      return validateScheme(obj) === null ? (obj as DesignScheme) : null;
    } catch {
      return null;
    }
  }, [raw]);

  const validationError = useMemo(() => {
    if (!raw.trim()) return null;
    try {
      return validateScheme(JSON.parse(raw) as unknown);
    } catch {
      return "JSON 解析失败，请检查格式";
    }
  }, [raw]);

  const displayScheme = useMemo(() => {
    if (!scheme) return null;
    const copy: DesignScheme = JSON.parse(JSON.stringify(scheme));
    if (nameOverride.trim()) copy.name = nameOverride.trim();
    return copy;
  }, [scheme, nameOverride]);

  // 交易确认后从收据日志解析 tokenId
  useEffect(() => {
    if (!isConfirmed || !mintHash || tokenId !== null) return;
    void (async () => {
      try {
        const client = publicClientFor();
        if (!client) return;
        const receipt = await client.getTransactionReceipt({ hash: mintHash });
        for (const log of receipt.logs) {
          try {
            const decoded = decodeEventLog({ abi: virtuHomeSchemeAbi, data: log.data, topics: log.topics });
            if (decoded.eventName === "SchemeMinted") {
              setTokenId(decoded.args.tokenId);
              setStep("done");
            }
          } catch {
            // 忽略其他合约日志
          }
        }
      } catch {
        setStep("done"); // 收据解析失败时仍显示成功
      }
    })();
  }, [isConfirmed, mintHash, tokenId]);

  const handleFile = async (file: File | undefined) => {
    if (!file) return;
    setError(null);
    try {
      const text = await file.text();
      setRaw(text);
      setFileName(file.name);
    } catch {
      setError("文件读取失败");
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
      const res = await fetch(`/api/demo/${id}`);
      if (!res.ok) throw new Error("示例加载失败");
      const data = await res.json();
      setRaw(JSON.stringify(data, null, 2));
      setFileName(`示例方案 ${id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "示例加载失败");
    }
  };

  const handleMint = async () => {
    setError(null);
    setPinInfo(null);
    setTokenId(null);
    const addr = virtuHomeSchemeAddress();
    if (!addr) {
      setError("未配置 VIRTUHOME_SCHEME 合约地址。请先部署合约，并把地址写入 web/.env.local 后重启 dev 服务。");
      return;
    }
    if (!displayScheme) {
      setError("请先粘贴或上传有效的方案 JSON");
      return;
    }
    if (!isConnected) {
      setError("请先连接钱包（MetaMask，切换到 Monad 测试网）");
      return;
    }

    setStep("pin");
    try {
      const previewDataUri = svgToDataUri(schemeToPreviewSvg(displayScheme));
      const res = await fetch("/api/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scheme: displayScheme,
          previewImage: previewDataUri,
          name: displayScheme.name,
          description: displayScheme.description
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? "固定到 IPFS 失败");
      setPinInfo(data);

      setStep("mint");
      if (switchChainAsync) {
        await switchChainAsync({ chainId: monadTestnet.id }).catch(() => undefined);
      }
      await writeContractAsync({
        address: addr,
        abi: virtuHomeSchemeAbi,
        functionName: "mint",
        args: [0n, data.contentHash as Hex, data.tokenUri as string]
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "铸造失败");
      setStep("idle");
    }
  };

  const busy = step === "pin" || step === "mint" || isWritePending || isConfirming;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      <header className="rise">
        <p className="eyebrow">Create · 铸造原创方案</p>
        <h1 className="display mt-3 text-[30px] text-ink sm:text-[42px]">创建原创方案</h1>
        <div className="dim-line mt-6" />
        <p className="mt-5 max-w-2xl text-sm leading-relaxed text-muted">
          上传 / 粘贴方案 JSON → 自动生成蓝图预览 → 固定到 IPFS → 铸造为 Monad 链上 NFT（
          <span className="mono text-ink">parentId = 0</span>）。创作者地址在铸造时上链固化。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-5">
          <div className="sheet p-5">
            <label className="field-label">Scheme JSON · 方案文件</label>
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
              className={`grid min-h-[124px] cursor-pointer place-items-center rounded-xl border-2 border-dashed p-5 text-center transition ${
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
                  {dragOver ? "松开即可载入" : "拖拽方案 JSON 到此处，或点击选择文件"}
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
                载入示例（北欧客厅）
              </button>
              {fileName && <span className="mono text-[11px] text-muted">已加载 · {fileName}</span>}
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
          </div>

          <div className="sheet p-5">
            <label className="field-label">Display Name · 方案名称（可选）</label>
            <input
              value={nameOverride}
              onChange={(e) => setName(e.target.value)}
              placeholder="例如：我家客厅 v2"
              className="input"
            />
          </div>

          <button onClick={() => void handleMint()} disabled={busy || !displayScheme} className="btn-primary w-full">
            {step === "pin"
              ? "固定到 IPFS…"
              : step === "mint" || isWritePending
                ? "铸造 NFT…"
                : isConfirming
                  ? "等待链上确认…"
                  : "固定 + 铸造"}
          </button>

          {error && (
            <div className="rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs leading-relaxed text-[#a53f52]">
              {error}
            </div>
          )}

          {pinInfo && (
            <div className="sheet space-y-2 p-5 text-xs">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-violet">Pinned · 已固定到 IPFS</p>
              <p className="break-all text-muted">
                contentHash <code className="mono text-ink">{pinInfo.contentHash}</code>
              </p>
              <p className="break-all text-muted">
                tokenUri <code className="mono text-ink">{pinInfo.tokenUri}</code>
              </p>
            </div>
          )}

          {tokenId !== null && isConfirmed && (
            <div className="sheet border-violet/40 bg-violet/[0.06] p-5 text-sm">
              <p className="text-ink">
                铸造成功！你的原创方案是 <span className="mono font-semibold text-violet-deep">#{tokenId.toString()}</span>
              </p>
              <Link href={`/scheme/${tokenId.toString()}`} className="btn-primary mt-3">
                查看方案详情
              </Link>
            </div>
          )}

          {writeError && (
            <div className="rounded-xl border border-coral/40 bg-coral/10 p-3.5 text-xs text-[#a53f52]">
              {writeError.message}
            </div>
          )}

          <p className="text-xs leading-relaxed text-muted">
            格式要求：<span className="mono text-ink">name</span>、
            <span className="mono text-ink"> room.type</span>、
            <span className="mono text-ink"> room.dimensions</span>(width/length/height)、
            <span className="mono text-ink"> style.theme</span> +{" "}
            <span className="mono text-ink">style.palette</span>，furniture 数组含 modelId 与
            position/rotation/scale。
          </p>
        </div>

        <div className="space-y-5">
          <div className="sheet grid-sheet overflow-hidden">
            <div className="border-b border-hairline px-5 py-3">
              <p className="mono text-[10px] uppercase tracking-[0.14em] text-muted">
                Preview · 自动生成蓝图预览
              </p>
            </div>
            {displayScheme ? (
              <SchemePreview scheme={displayScheme} />
            ) : (
              <div className="grid aspect-[16/10] place-items-center text-sm text-muted">
                填写左侧 JSON 后自动生成预览
              </div>
            )}
          </div>

          {scheme && (
            <div className="sheet p-5">
              <div className="flex items-center justify-between">
                <p className="eyebrow">Summary · 参数摘要</p>
                <span className="chip chip-violet">校验通过</span>
              </div>
              <dl className="mt-4 divide-y divide-hairline border-y border-hairline text-[13px]">
                <SummaryRow label="ROOM / 房间">{scheme.room.type}</SummaryRow>
                <SummaryRow label="SIZE / 尺寸">
                  <span className="mono">
                    {scheme.room.dimensions.width} × {scheme.room.dimensions.length} ×{" "}
                    {scheme.room.dimensions.height} m
                  </span>
                </SummaryRow>
                <SummaryRow label="THEME / 风格">{scheme.style.theme}</SummaryRow>
                <SummaryRow label="FURNITURE / 家具">
                  <span className="mono">{scheme.furniture.length}</span> 件
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
                确认无误后点击左侧「固定 + 铸造」上链；名称可在上方覆盖 JSON 中的 name。
              </p>
            </div>
          )}

          <div className="sheet p-5">
            <p className="eyebrow">Mint · 铸造信息</p>
            <dl className="mt-4 divide-y divide-hairline border-y border-hairline text-[13px]">
              <SummaryRow label="CONTRACT">
                <span className="mono text-[11px]">{virtuHomeSchemeAddress() ?? "未配置"}</span>
              </SummaryRow>
              <SummaryRow label="PARENT">
                <span className="mono">0 · 原创</span>
              </SummaryRow>
              <SummaryRow label="ROYALTY">
                <span className="mono">ERC-2981 · 5%</span>
              </SummaryRow>
              <SummaryRow label="NETWORK">
                <span className="mono">Monad Testnet · 10143</span>
              </SummaryRow>
            </dl>
            {!isConnected && (
              <p className="mt-4 rounded-xl bg-paper-2 p-3 text-xs leading-relaxed text-muted">
                铸造前请先连接 MetaMask 并切换到 Monad 测试网。
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
      <dt className="mono text-[10px] uppercase tracking-[0.12em] text-muted">{label}</dt>
      <dd className="text-right text-ink">{children}</dd>
    </div>
  );
}
