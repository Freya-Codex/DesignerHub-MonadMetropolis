"use client";

/**
 * /passkey —— Passkey 钱包（主流程入口）。
 *
 * 全流程无需助记词、无需持有 MON：
 *   1) 用设备安全芯片（Face ID / Touch ID / Windows Hello）创建 passkey；
 *   2) CREATE2 工厂推导出确定性账户地址（counterfactual，部署前即可用）；
 *   3) relayer 代付 gas 部署账户；
 *   4) 用一次 passkey 签名执行链上动作（此处演示：在 ProvenanceRegistry 留下一条确权记录）。
 *
 * MetaMask 保留为「备选」（页内下方可连接），供习惯 EOA 的开发者使用。
 */

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { encodeFunctionData, encodePacked, keccak256, toHex, type Address, type Hex } from "viem";
import {
  publicClientFor,
  provenanceRegistryAddress,
  passkeyFactoryAddress
} from "@/lib/contracts";
import { KIMI_AGENT_ID, passkeyAccountAbi, passkeyFactoryAbi, provenanceRegistryAbi } from "@/lib/abis";
import { monadTestnet } from "@/lib/chains";
import {
  b64urlDecode,
  b64urlEncode,
  createPasskey,
  deriveSingleChallenge,
  originHashHex,
  passkeyOrigin,
  passkeyRpId,
  rpIdHashHex,
  signAssertion
} from "@/lib/passkey";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { clearStoredPasskey, loadStoredPasskey, saveStoredPasskey } from "@/lib/passkeyAccount";

const EXPLORER = "https://testnet.monadexplorer.com";

interface StoredCred {
  credentialIdB64: string;
  x: Hex;
  y: Hex;
}

export default function PasskeyPage() {
  const [supported, setSupported] = useState(true);
  const [cred, setCred] = useState<StoredCred | null>(null);
  const [account, setAccount] = useState<Address | null>(null);
  const [deployed, setDeployed] = useState(false);
  const [nonce, setNonce] = useState<bigint | null>(null);
  const [busy, setBusy] = useState("");
  const [log, setLog] = useState<string[]>([]);

  const rpId = passkeyRpId();
  const origin = passkeyOrigin();
  const factory = passkeyFactoryAddress();
  const provenance = provenanceRegistryAddress();

  const say = useCallback((m: string) => {
    setLog((l) => [`${new Date().toLocaleTimeString()}  ${m}`, ...l].slice(0, 40));
  }, []);

  const refreshChain = useCallback(
    async (addr: Address) => {
      const client = publicClientFor();
      if (!client) return;
      const code = await client.getCode({ address: addr });
      const isDeployed = Boolean(code && code !== "0x");
      setDeployed(isDeployed);
      if (isDeployed) {
        const n = (await client.readContract({
          address: addr,
          abi: passkeyAccountAbi,
          functionName: "nonce"
        })) as bigint;
        setNonce(n);
      } else {
        setNonce(null);
      }
    },
    []
  );

  const computeAccount = useCallback(
    async (c: StoredCred) => {
      const client = publicClientFor();
      if (!client || !factory) return;
      const predicted = (await client.readContract({
        address: factory,
        abi: passkeyFactoryAbi,
        functionName: "accountOf",
        args: [BigInt(c.x), BigInt(c.y), rpIdHashHex(), originHashHex()]
      })) as Address;
      setAccount(predicted);
      await refreshChain(predicted);
      return predicted;
    },
    [factory, refreshChain]
  );

  // 载入本机已保存的 passkey
  useEffect(() => {
    setSupported(typeof window !== "undefined" && Boolean(window.PublicKeyCredential));
    const c = loadStoredPasskey();
    if (c) {
      setCred(c);
      computeAccount(c).catch(() => {});
    }
  }, [computeAccount]);

  async function onCreate() {
    setBusy("create");
    try {
      const c = await createPasskey({ rpId, rpName: "Designer Hub" });
      const stored: StoredCred = { credentialIdB64: c.credentialIdB64, x: c.x, y: c.y };
      saveStoredPasskey(stored);
      setCred(stored);
      say(`passkey 已创建（凭证 ${c.credentialIdB64.slice(0, 12)}…）`);
      await computeAccount(stored);
      say("已推导确定性账户地址");
    } catch (e: any) {
      say(`创建失败：${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  async function onDeploy() {
    if (!cred) return;
    setBusy("deploy");
    try {
      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "createAccount",
          x: cred.x,
          y: cred.y,
          rpIdHash: rpIdHashHex(),
          originHash: originHashHex()
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error + (data.hint ? ` — ${data.hint}` : ""));
      say(data.alreadyDeployed ? "账户已存在（无需再部署）" : `账户已部署：${data.txHash}`);
      if (account) await refreshChain(account);
    } catch (e: any) {
      say(`部署失败：${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  async function onDemoAttest() {
    if (!cred || !account || !provenance) return;
    setBusy("attest");
    try {
      const client = publicClientFor();
      if (!client) throw new Error("缺少只读客户端");

      // commitment = keccak256(contentHash ‖ salt)，内容不入链（隐私模型）
      const contentHash = keccak256(toHex(`designer-hub-demo-${Date.now()}`));
      const salt = crypto.getRandomValues(new Uint8Array(32));
      const commitment = keccak256(encodePacked(["bytes32", "bytes32"], [contentHash, toHex(salt)]));

      const data = encodeFunctionData({
        abi: provenanceRegistryAbi,
        functionName: "attest",
        args: [commitment, KIMI_AGENT_ID, ""]
      });

      const n = (await client.readContract({
        address: account,
        abi: passkeyAccountAbi,
        functionName: "nonce"
      })) as bigint;

      const challenge = deriveSingleChallenge({
        account,
        chainId: BigInt(monadTestnet.id),
        nonce: n,
        to: provenance,
        value: 0n,
        data
      });
      say(`挑战：${challenge.slice(0, 14)}… 准备签名（会弹出 Face ID / 指纹）`);

      const assertion = await signAssertion({
        challenge,
        rpId,
        credentialId: b64urlDecode(cred.credentialIdB64)
      });
      say("签名完成，提交 relayer 代付…");

      const res = await fetch("/api/relay", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          op: "execute",
          account,
          to: provenance,
          value: "0",
          data,
          assertion: {
            authenticatorData: assertion.authenticatorData,
            clientDataJSON: assertion.clientDataJSON,
            r: assertion.r.toString(),
            s: assertion.s.toString()
          }
        })
      });
      const out = await res.json();
      if (!res.ok) throw new Error(out.error + (out.hint ? ` — ${out.hint}` : "") + (out.message ? ` (${out.message})` : ""));
      say(`✅ 链上确权成功：${out.txHash}`);
      await refreshChain(account);
    } catch (e: any) {
      say(`失败：${e?.message || e}`);
    } finally {
      setBusy("");
    }
  }

  function onReset() {
    clearStoredPasskey();
    setCred(null);
    setAccount(null);
    setDeployed(false);
    setNonce(null);
    say("已清除本机 passkey 记录（设备中的凭证仍保留）");
  }

  return (
    <div className="space-y-8">
      <section className="sheet-dark grid-sheet-dark rise relative overflow-hidden px-5 py-9 sm:px-10 sm:py-12">
        <div className="relative">
          <p className="eyebrow eyebrow-dark">Passkey · 无助记词账户（主流程）</p>
          <h1 className="display mt-5 text-[34px] text-white sm:text-[52px]">用 Face ID 登录 web3</h1>
          <p className="mt-5 max-w-3xl text-sm leading-relaxed text-white/70 sm:text-[15px]">
            无需助记词、无需安装浏览器插件、<span className="text-white">无需持有 MON</span>。私钥在设备安全芯片内生成且永不导出；
            relayer 代付 gas，你只需一次指纹 / 面容确认即可完成链上动作。
            <span className="text-white"> Passkey 密钥不接触资金，支付密钥由用户自选</span>——涉及付款的操作，可在本页下方连接 MetaMask（备选）完成。
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/board" className="btn-outline-light">
              浏览排行榜
            </Link>
            <Link href="/docs" className="btn-ghost-light">
              机制说明
            </Link>
          </div>
        </div>
      </section>

      {!supported && (
        <div className="sheet border-l-4 border-coral p-5 text-sm text-ink">
          当前浏览器不支持 WebAuthn（Passkey）。请用 Chrome / Edge / Safari（≥16）桌面版或手机浏览器打开；也可改用
          MetaMask（备选）。
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="sheet p-6">
          <p className="eyebrow">Step 1–3 · 创建 → 推导地址 → 部署</p>
          <div className="dim-line mt-4" />

          <dl className="mt-6 space-y-3 text-[13px]">
            <Row k="RP ID（域）" v={rpId} />
            <Row k="Origin" v={origin} />
            <Row k="rpIdHash" v={rpIdHashHex()} mono />
            <Row k="originHash" v={originHashHex()} mono />
            <Row k="账户地址（CREATE2）" v={account || "—"} mono />
            <Row
              k="链上状态"
              v={account ? (deployed ? `已部署 · nonce=${nonce ?? 0}` : "未部署（counterfactual）") : "—"}
            />
          </dl>

          <div className="mt-7 flex flex-wrap gap-3">
            <button className="btn-primary" disabled={busy !== "" || !supported} onClick={onCreate}>
              {cred ? "重新创建 Passkey" : "创建 Passkey"}
            </button>
            <button
              className="btn-secondary"
              disabled={!cred || !account || deployed || busy !== ""}
              onClick={onDeploy}
            >
              {deployed ? "账户已部署" : "relayer 代付部署账户"}
            </button>
            {cred && (
              <button className="btn-ghost" disabled={busy !== ""} onClick={onReset}>
                清除本机记录
              </button>
            )}
          </div>

          <p className="mt-4 text-[11px] leading-relaxed text-muted">
            注意：账户地址由「passkey 公钥 + RP ID + Origin」共同决定。换域名或换端口（localhost
            ↔ 127.0.0.1）会得到不同账户地址；本机记录存于 localStorage。
          </p>
        </div>

        <div className="sheet p-6">
          <p className="eyebrow">Step 4 · 用 passkey 执行链上动作</p>
          <div className="dim-line mt-4" />
          <p className="mt-5 text-[13px] leading-relaxed text-muted">
            演示：向 <span className="mono text-ink">ProvenanceRegistry</span> 写入一条内容承诺
            （commitment = keccak256(contentHash ‖ salt)，方案内容不上链）。签名覆盖确切 calldata 与
            nonce，relayer 无法篡改。
          </p>
          <button
            className="btn-primary mt-6"
            disabled={!deployed || busy !== ""}
            onClick={onDemoAttest}
          >
            {busy === "attest" ? "签名 & 提交中…" : "用 Passkey 确权（relayer 免 gas）"}
          </button>
          {!deployed && (
            <p className="mt-3 text-[11px] text-muted">需先完成 Step 3 部署账户。</p>
          )}

          <div className="mt-6">
            <p className="field-label">运行日志</p>
            <div className="mono mt-2 max-h-72 overflow-auto rounded-lg border border-hairline bg-paper-2/60 p-3 text-[11px] leading-relaxed text-muted">
              {log.length === 0 ? <p>—</p> : log.map((l, i) => <p key={i}>{l}</p>)}
            </div>
          </div>
        </div>
      </section>

      <section className="sheet p-6">
        <p className="eyebrow">备选 · 连接钱包（MetaMask）</p>
        <div className="dim-line mt-4" />
        <p className="mt-5 text-[13px] leading-relaxed text-muted">
          习惯自托管 EOA 的开发者，也可在此连接 MetaMask 作为备选签名方式。
          <span className="text-ink">Passkey 密钥不接触资金，支付密钥由用户自选</span>
          ——「应用到我家」等付费操作需由钱包支付。
        </p>
        <div className="mt-5">
          <ConnectButton chainStatus="icon" accountStatus="address" showBalance={false} />
        </div>
      </section>

      <section className="sheet p-6">
        <p className="eyebrow">Relayer 边界（演示级）</p>
        <div className="dim-line mt-4" />
        <ul className="mt-5 grid gap-3 text-[13px] text-muted sm:grid-cols-2">
          <li>· 仅 Monad 测试网（chainId 10143）</li>
          <li>· value 恒为 0，不代转任何 ETH/MON</li>
          <li>· 目标白名单：本项目 4 个合约 + 账户自身 addKey</li>
          <li>· 全局 / 单账户每日额度上限（进程内计数）</li>
        </ul>
      </section>
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 border-b border-hairline pb-2.5">
      <dt className="shrink-0 text-muted">{k}</dt>
      <dd className={`break-all text-right text-ink ${mono ? "mono text-[11px]" : ""}`}>{v}</dd>
    </div>
  );
}
