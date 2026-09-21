"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useAccount, useSwitchChain } from "wagmi";
import { useWaitForTransactionReceipt, useWriteContract } from "wagmi";
import { decodeEventLog, type Hex } from "viem";
import { dreamSchemeAbi } from "@/lib/abis";
import { dreamSchemeAddress, publicClientFor } from "@/lib/contracts";
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
            const decoded = decodeEventLog({ abi: dreamSchemeAbi, data: log.data, topics: log.topics });
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
    const addr = dreamSchemeAddress();
    if (!addr) {
      setError("未配置 DREAMSCHEME 合约地址。请先部署合约，并把地址写入 web/.env.local 后重启 dev 服务。");
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
        abi: dreamSchemeAbi,
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
    <div className="mx-auto max-w-4xl space-y-6">
      <header>
        <h1 className="text-2xl font-black text-zinc-900">创建原创方案</h1>
        <p className="mt-1 text-sm text-zinc-500">
          上传/粘贴方案 JSON → 自动生成预览图 → 固定到 IPFS → 铸造为 Monad 链上 NFT（parentId = 0）。
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="space-y-4">
          <div className="card p-4">
            <label className="field-label">方案 JSON</label>
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
              className={`grid min-h-28 cursor-pointer place-items-center rounded-2xl border-2 border-dashed p-4 text-center transition ${
                dragOver
                  ? "border-indigo-500 bg-indigo-50"
                  : "border-zinc-300 bg-zinc-50 hover:border-indigo-300 hover:bg-indigo-50/50"
              }`}
            >
              <div className="text-sm">
                <span className="text-2xl">📂</span>
                <p className="mt-1 font-medium text-zinc-700">
                  {dragOver ? "松开即可载入" : "拖拽方案 JSON 到此处，或点击选择文件"}
                </p>
                <p className="mt-0.5 text-xs text-zinc-400">支持 .json / application/json</p>
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".json,application/json"
                className="hidden"
                onChange={(e) => void handleFile(e.target.files?.[0])}
              />
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <button className="btn-ghost !border !border-zinc-300 !py-1.5 text-xs" onClick={() => void loadSample(1)}>
                🧪 载入示例（北欧客厅）
              </button>
              {fileName && <span className="text-xs text-zinc-500">已加载：{fileName}</span>}
            </div>
            <textarea
              value={raw}
              onChange={(e) => setRaw(e.target.value)}
              rows={12}
              spellCheck={false}
              placeholder={SAMPLE_JSON}
              className="input font-mono text-xs leading-relaxed"
            />
            {validationError && <p className="mt-2 text-xs text-red-600">{validationError}</p>}
          </div>

          <div className="card p-4">
            <label className="field-label">方案名称（可选，覆盖 JSON 中的 name）</label>
            <input value={nameOverride} onChange={(e) => setName(e.target.value)} placeholder="例如：我家客厅 v2" className="input" />
          </div>

          <button onClick={() => void handleMint()} disabled={busy || !displayScheme} className="btn-primary w-full">
            {step === "pin" ? "🪐 固定到 IPFS…" : step === "mint" || isWritePending ? "⛏ 铸造 NFT…" : isConfirming ? "等待链上确认…" : "🚀 固定 + 铸造"}
          </button>

          {error && <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-relaxed text-red-700">{error}</div>}

          {pinInfo && (
            <div className="card space-y-1.5 p-4 text-xs">
              <p className="font-bold text-zinc-900">✅ 已固定到 IPFS</p>
              <p className="break-all text-zinc-600">contentHash：<code>{pinInfo.contentHash}</code></p>
              <p className="break-all text-zinc-600">tokenUri：<code>{pinInfo.tokenUri}</code></p>
            </div>
          )}

          {tokenId !== null && isConfirmed && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
              🎉 铸造成功！你的原创方案是 <b>#{tokenId.toString()}</b>
              <Link href={`/scheme/${tokenId.toString()}`} className="mt-2 block font-semibold text-indigo-600 underline">
                查看方案详情 →
              </Link>
            </div>
          )}

          {writeError && <div className="rounded-xl bg-red-50 p-3 text-xs text-red-700">{writeError.message}</div>}

          <p className="text-xs leading-relaxed text-zinc-500">
            格式要求：name、room.type、room.dimensions(width/length/height)、style.theme + style.palette，
            furniture 数组含 modelId 与 position/rotation/scale（x/y/z 数字）。
          </p>
        </div>

        <div className="space-y-4">
          <div className="card overflow-hidden">
            <div className="border-b border-zinc-100 px-4 py-2.5 text-xs font-semibold text-zinc-500">
              预览图（自动生成占位）
            </div>
            {displayScheme ? (
              <SchemePreview scheme={displayScheme} />
            ) : (
              <div className="grid aspect-[16/10] place-items-center bg-zinc-50 text-sm text-zinc-400">
                填写左侧 JSON 后自动生成预览
              </div>
            )}
          </div>

          {scheme && (
            <div className="card space-y-2.5 p-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-zinc-900">参数摘要</h3>
                <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                  校验通过 ✓
                </span>
              </div>
              <dl className="grid grid-cols-2 gap-2 text-xs text-zinc-600">
                <div className="rounded-xl bg-zinc-50 p-2.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-400">房间</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-800">{scheme.room.type}</dd>
                </div>
                <div className="rounded-xl bg-zinc-50 p-2.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-400">尺寸</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-800">
                    {scheme.room.dimensions.width} × {scheme.room.dimensions.length} × {scheme.room.dimensions.height} m
                  </dd>
                </div>
                <div className="rounded-xl bg-zinc-50 p-2.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-400">风格主题</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-800">{scheme.style.theme}</dd>
                </div>
                <div className="rounded-xl bg-zinc-50 p-2.5">
                  <dt className="text-[10px] uppercase tracking-wide text-zinc-400">家具数量</dt>
                  <dd className="mt-0.5 font-semibold text-zinc-800">{scheme.furniture.length} 件</dd>
                </div>
              </dl>
              <div className="flex items-center gap-1.5">
                {scheme.style.palette.slice(0, 5).map((c) => (
                  <span key={c} className="h-6 w-6 rounded-full border border-zinc-200" style={{ backgroundColor: c }} />
                ))}
                <span className="ml-1 text-[11px] text-zinc-400">{scheme.style.mood ?? ""}</span>
              </div>
              <p className="text-xs text-zinc-500">确认无误后点击下方「固定 + 铸造」上链；name 可覆盖 JSON 中的名称。</p>
            </div>
          )}

          <div className="card p-4 text-sm">
            <h3 className="font-bold text-zinc-900">铸造信息</h3>
            <dl className="mt-2 space-y-1.5 text-xs text-zinc-600">
              <div className="flex justify-between gap-4"><dt>合约</dt><dd className="truncate font-mono">{dreamSchemeAddress() ?? "未配置"}</dd></div>
              <div className="flex justify-between gap-4"><dt>Parent</dt><dd>0（原创）</dd></div>
              <div className="flex justify-between gap-4"><dt>版税</dt><dd>ERC-2981 · 5%</dd></div>
              <div className="flex justify-between gap-4"><dt>网络</dt><dd>Monad Testnet (10143)</dd></div>
            </dl>
            {!isConnected && <p className="mt-3 rounded-xl bg-zinc-50 p-2.5 text-xs text-zinc-500">铸造前请先连接 MetaMask 并切换到 Monad 测试网。</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
