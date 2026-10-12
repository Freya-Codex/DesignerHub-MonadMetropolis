"use client";

/**
 * lib/passkeyAccount.ts —— Passkey 智能账户的客户端辅助（在 /passkey 与 /mint/create 之间复用）。
 *
 * 把「从 localStorage 读取 passkey → 推导 CREATE2 账户 → relayer 代付部署 → 用 passkey 签名执行链上动作」
 * 这套流程收敛到一处，供任意页面复用（例如铸造页用 passkey 免 MetaMask 铸币）。
 *
 * 全程无私钥：私钥只在设备安全芯片内；relayer 只付 gas，无法篡改操作（挑战覆盖 calldata 与 nonce）。
 */

import type { Address, Hex } from "viem";
import { publicClientFor, passkeyFactoryAddress } from "@/lib/contracts";
import { passkeyAccountAbi, passkeyFactoryAbi } from "@/lib/abis";
import { monadTestnet } from "@/lib/chains";
import {
  b64urlDecode,
  deriveSingleChallenge,
  originHashHex,
  passkeyRpId,
  rpIdHashHex,
  signAssertion
} from "@/lib/passkey";
import { L, getLang } from "@/lib/langStore";

/** 本机 passkey 记录的 localStorage key（与 /passkey 页一致）。 */
export const PASSKEY_STORE_KEY = "dh.passkey.v1";

/** passkey 记录变化时派发的事件名（Header 等跨页感知）。 */
export const PASSKEY_EVENT = "dh:passkey-changed";

function emitPasskeyChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PASSKEY_EVENT));
}

/** 订阅 passkey 变化（返回取消函数）。 */
export function onPasskeyChange(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(PASSKEY_EVENT, cb);
  return () => window.removeEventListener(PASSKEY_EVENT, cb);
}

export interface StoredPasskey {
  credentialIdB64: string;
  x: Hex;
  y: Hex;
}

/** 读取本机保存的 passkey（无则 null）。 */
export function loadStoredPasskey(): StoredPasskey | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(PASSKEY_STORE_KEY);
    if (!raw) return null;
    const c = JSON.parse(raw) as StoredPasskey;
    if (!c?.x || !c?.y || !c?.credentialIdB64) return null;
    return c;
  } catch {
    return null;
  }
}

export function saveStoredPasskey(c: StoredPasskey): void {
  localStorage.setItem(PASSKEY_STORE_KEY, JSON.stringify(c));
  emitPasskeyChange();
}

export function clearStoredPasskey(): void {
  localStorage.removeItem(PASSKEY_STORE_KEY);
  emitPasskeyChange();
}

/** 由 passkey 公钥 + RP ID + Origin 推导 CREATE2 账户地址（counterfactual，部署前即可用）。 */
export async function passkeyAccountAddress(cred: StoredPasskey): Promise<Address | undefined> {
  const client = publicClientFor();
  const factory = passkeyFactoryAddress();
  if (!client || !factory) return undefined;
  return (await client.readContract({
    address: factory,
    abi: passkeyFactoryAbi,
    functionName: "accountOf",
    args: [BigInt(cred.x), BigInt(cred.y), rpIdHashHex(), originHashHex()]
  })) as Address;
}

/** 账户合约是否已部署。 */
export async function isAccountDeployed(addr: Address): Promise<boolean> {
  const client = publicClientFor();
  if (!client) return false;
  const code = await client.getCode({ address: addr });
  return Boolean(code && code !== "0x");
}

/** 通过 relayer 代付部署 passkey 账户（已部署则直接返回）。 */
export async function deployPasskeyAccount(
  cred: StoredPasskey
): Promise<{ account: Address; txHash?: Hex; alreadyDeployed?: boolean }> {
  const res = await fetch("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      op: "createAccount",
      x: cred.x,
      y: cred.y,
      rpIdHash: rpIdHashHex(),
      originHash: originHashHex(),
      lang: getLang()
    })
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error + (data.hint ? ` — ${data.hint}` : ""));
  return { account: data.account as Address, txHash: data.txHash as Hex | undefined, alreadyDeployed: data.alreadyDeployed };
}

/**
 * 用 passkey 签名并通过 relayer 代付执行一次链上调用（value 恒为 0）。
 * 返回 relayer 提交的交易哈希。
 */
export async function executeViaPasskey(opts: {
  account: Address;
  cred: StoredPasskey;
  to: Address;
  data: Hex;
}): Promise<Hex> {
  const client = publicClientFor();
  if (!client) throw new Error(L("缺少只读客户端", "Missing read-only client"));

  const nonce = (await client.readContract({
    address: opts.account,
    abi: passkeyAccountAbi,
    functionName: "nonce"
  })) as bigint;

  const challenge = deriveSingleChallenge({
    account: opts.account,
    chainId: BigInt(monadTestnet.id),
    nonce,
    to: opts.to,
    value: 0n,
    data: opts.data
  });

  const assertion = await signAssertion({
    challenge,
    rpId: passkeyRpId(),
    credentialId: b64urlDecode(opts.cred.credentialIdB64)
  });

  const res = await fetch("/api/relay", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      op: "execute",
      account: opts.account,
      to: opts.to,
      value: "0",
      data: opts.data,
      lang: getLang(),
      assertion: {
        authenticatorData: assertion.authenticatorData,
        clientDataJSON: assertion.clientDataJSON,
        r: assertion.r.toString(),
        s: assertion.s.toString()
      }
    })
  });
  const out = await res.json();
  if (!res.ok) {
    throw new Error(out.error + (out.hint ? ` — ${out.hint}` : "") + (out.message ? ` (${out.message})` : ""));
  }
  return out.txHash as Hex;
}

/**
 * 确保 passkey 账户可用：推导地址 → 未部署则先由 relayer 代付部署。返回账户地址。
 * 供 Remix / setPrice 等页在 executeViaPasskey 之前调用。
 */
export async function ensurePasskeyAccount(cred: StoredPasskey): Promise<Address> {
  const addr = await passkeyAccountAddress(cred);
  if (!addr)
    throw new Error(L("无法推导 passkey 账户地址（缺少合约地址或只读客户端）", "Could not derive the passkey account address (missing contract address or read-only client)"));
  if (!(await isAccountDeployed(addr))) {
    await deployPasskeyAccount(cred);
  }
  return addr;
}

/** 签名者选择结果：连了 MetaMask 优先 MetaMask，否则用本机 passkey，都无则 none。 */
export type SignerMode = "metamask" | "passkey" | "none";

export function pickSigner(isConnected: boolean): { mode: SignerMode; cred: StoredPasskey | null } {
  const cred = loadStoredPasskey();
  if (isConnected) return { mode: "metamask", cred };
  if (cred) return { mode: "passkey", cred };
  return { mode: "none", cred: null };
}
