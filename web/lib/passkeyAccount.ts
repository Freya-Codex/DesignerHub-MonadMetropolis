"use client";

/**
  * lib/passkeyAccount.ts -- client helper for the passkey smart account (shared between /passkey and /mint/create).
 *
  * Consolidates "read passkey from localStorage -> derive the CREATE2 account -> relayer-sponsored deploy -> sign an on-chain action with the passkey"
  * into one place for any page to reuse (e.g. the mint page using a passkey to mint without MetaMask).
 *
  * No private key throughout: it stays in the device secure chip; the relayer only pays gas and cannot tamper with the operation (the challenge covers calldata and nonce).
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

/** localStorage key for the local passkey record (same as the /passkey page). */
export const PASSKEY_STORE_KEY = "dh.passkey.v1";

/** Event name dispatched when the passkey record changes (so Header etc. notice across pages). */
export const PASSKEY_EVENT = "dh:passkey-changed";

function emitPasskeyChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(PASSKEY_EVENT));
}

/** Subscribe to passkey changes (returns an unsubscribe function). */
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

/** Read the locally saved passkey (null when absent). */
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

/** Derive the CREATE2 account address from the passkey public key + RP ID + Origin (counterfactual, usable before deployment). */
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

/** Whether the account contract is deployed. */
export async function isAccountDeployed(addr: Address): Promise<boolean> {
  const client = publicClientFor();
  if (!client) return false;
  const code = await client.getCode({ address: addr });
  return Boolean(code && code !== "0x");
}

/** Deploy the passkey account via relayer sponsorship (returns early if already deployed). */
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
  * Sign with the passkey and execute one on-chain call via relayer sponsorship (value is always 0).
  * Returns the tx hash submitted by the relayer.
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
  * Ensure the passkey account is usable: derive the address -> if undeployed, deploy it via relayer sponsorship first. Returns the account address.
  * Called by pages such as Remix / setPrice before executeViaPasskey.
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

/** Signer selection result: prefer MetaMask if connected, otherwise the local passkey, else none. */
export type SignerMode = "metamask" | "passkey" | "none";

export function pickSigner(isConnected: boolean): { mode: SignerMode; cred: StoredPasskey | null } {
  const cred = loadStoredPasskey();
  if (isConnected) return { mode: "metamask", cred };
  if (cred) return { mode: "passkey", cred };
  return { mode: "none", cred: null };
}
