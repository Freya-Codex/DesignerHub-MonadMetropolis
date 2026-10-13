/**
  * app/api/relay/route.ts -- demo gas sponsor (relayer).
 *
  * Purpose: let users holding a passkey perform on-chain actions without holding MON --
  *   1) op=createAccount: the relayer pays to deploy the P256PasskeyAccount (CREATE2 factory);
  *   2) op=execute      : submit the passkey-signed assertion to the account contract for execution (the relayer only pays gas
  *                        and cannot tamper with the operation -- the challenge covers the calldata hash and nonce).
 *
  * Security boundaries (demo grade):
  *   - Monad Testnet only (chainId 10143);
  *   - value is always 0: the relayer transfers no ETH/MON;
  *   - target allowlist: only this project's 4 contracts, or the account's own addKey, may be called;
  *   - quota: global daily cap + per-account daily cap (in-process counter; reset on restart).
 *
  * WARNING: production should switch to persisted quotas, per-account/signature billing, metrics & alerts, and key custody (KMS).
 */

import { NextRequest, NextResponse } from "next/server";
import {
  createPublicClient,
  createWalletClient,
  getAddress,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "@/lib/chains";
import { passkeyAccountAbi, passkeyFactoryAbi } from "@/lib/abis";
import { serverTransport, usingAlchemy, safeRpcLabel } from "@/lib/serverRpc";
import { L, pickLang } from "@/lib/apiLang";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const RELAYER_KEY = (process.env.RELAYER_PRIVATE_KEY || process.env.MONAD_PRIVATE_KEY || "").trim();
const FACTORY = process.env.NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS;

const MAX_GLOBAL_PER_DAY = Number(process.env.RELAYER_MAX_PER_DAY || 200);
const MAX_PER_ACCOUNT_PER_DAY = Number(process.env.RELAYER_MAX_PER_ACCOUNT_PER_DAY || 10);

/** Target contract allowlist (lowercase). */
function allowTargets(): Set<string> {
  return new Set(
    [
      process.env.NEXT_PUBLIC_DREAM_SCHEME_ADDRESS,
      process.env.NEXT_PUBLIC_SCHEME_MARKET_ADDRESS,
      process.env.NEXT_PUBLIC_PROVENANCE_REGISTRY_ADDRESS,
      process.env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS
    ]
      .filter(Boolean)
      .map((a) => (a as string).toLowerCase())
  );
}

// In-process quota (demo grade; reset on restart)
const state = { day: "", global: 0, perAccount: new Map<string, number>() };

function takeQuota(account: string, lang: "zh" | "en"): { ok: true } | { ok: false; reason: string } {
  const today = new Date().toISOString().slice(0, 10);
  if (state.day !== today) {
    state.day = today;
    state.global = 0;
    state.perAccount.clear();
  }
  if (state.global >= MAX_GLOBAL_PER_DAY)
    return { ok: false, reason: L(lang, "已达当日全局额度上限", "Global daily quota reached") };
  const used = state.perAccount.get(account.toLowerCase()) ?? 0;
  if (used >= MAX_PER_ACCOUNT_PER_DAY)
    return { ok: false, reason: L(lang, "该账户已达当日额度上限", "This account reached its daily quota") };
  state.global += 1;
  state.perAccount.set(account.toLowerCase(), used + 1);
  return { ok: true };
}

function clients() {
  const account = privateKeyToAccount(RELAYER_KEY as Hex);
  // The server uniformly uses serverTransport(): Alchemy first, with automatic public-RPC fallback.
  const transport = serverTransport();
  const wallet = createWalletClient({ account, chain: monadTestnet, transport });
  const pub = createPublicClient({ chain: monadTestnet, transport });
  return { account, wallet, pub };
}

function bad(status: number, error: string, extra?: Record<string, unknown>) {
  return NextResponse.json({ error, ...extra }, { status });
}

export async function GET() {
  return NextResponse.json({
    enabled: Boolean(RELAYER_KEY) && Boolean(FACTORY),
    chainId: monadTestnet.id,
    maxGlobalPerDay: MAX_GLOBAL_PER_DAY,
    maxPerAccountPerDay: MAX_PER_ACCOUNT_PER_DAY,
    usedToday: state.day === new Date().toISOString().slice(0, 10) ? state.global : 0,
    // Server RPC provider (Alchemy first, public-RPC fallback); exposes only a label, never the Key.
    rpcProvider: usingAlchemy() ? "alchemy" : "public",
    rpcLabel: safeRpcLabel()
  });
}

export async function POST(req: NextRequest) {
  if (!RELAYER_KEY) {
    return bad(503, "relayer_disabled", {
      hint: L(pickLang(req), "未配置 RELAYER_PRIVATE_KEY（或 MONAD_PRIVATE_KEY）。relayer 为演示功能，可关闭。", "RELAYER_PRIVATE_KEY (or MONAD_PRIVATE_KEY) is not configured. The relayer is a demo feature and can be disabled.")
    });
  }
  if (!FACTORY)
    return bad(503, "factory_unconfigured", {
      hint: L(pickLang(req), "缺少 NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS", "Missing NEXT_PUBLIC_PASSKEY_FACTORY_ADDRESS")
    });

  let body: any;
  try {
    body = await req.json();
  } catch {
    return bad(400, "invalid_json");
  }
  const lang = pickLang(req, body);

  const { wallet, pub } = clients();

  try {
    if (body.op === "createAccount") {
      const { x, y, rpIdHash, originHash } = body;
      if (!x || !y || !rpIdHash || !originHash) return bad(400, "missing_fields");
      const factory = getAddress(FACTORY);
      const predicted = (await pub.readContract({
        address: factory,
        abi: passkeyFactoryAbi,
        functionName: "accountOf",
        args: [BigInt(x), BigInt(y), rpIdHash as Hex, originHash as Hex]
      })) as Address;

      const existing = await pub.getCode({ address: predicted });
      if (existing && existing !== "0x") {
        return NextResponse.json({ ok: true, alreadyDeployed: true, account: predicted });
      }
      const quota = takeQuota(predicted, lang);
      if (!quota.ok) return bad(429, "quota_exceeded", { reason: quota.reason });

      const hash = await wallet.writeContract({
        address: factory,
        abi: passkeyFactoryAbi,
        functionName: "createAccount",
        args: [BigInt(x), BigInt(y), rpIdHash as Hex, originHash as Hex]
      });
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") return bad(502, "tx_reverted", { txHash: hash });
      return NextResponse.json({ ok: true, txHash: hash, account: predicted });
    }

    if (body.op === "execute") {
      const { account, to, data, assertion } = body;
      const value = body.value ?? "0";
      if (!account || !to || !data || !assertion) return bad(400, "missing_fields");
      if (BigInt(value) !== 0n)
        return bad(400, "value_must_be_zero", { hint: L(lang, "relayer 不代转 ETH/MON", "The relayer does not transfer ETH/MON") });

      const acct = getAddress(account);
      const target = getAddress(to);

      const allowed = allowTargets();
      const isSelfKeyAdd = target.toLowerCase() === acct.toLowerCase();
      if (!allowed.has(target.toLowerCase()) && !isSelfKeyAdd) {
        return bad(403, "target_not_allowed", { target });
      }

      const code = await pub.getCode({ address: acct });
      if (!code || code === "0x") return bad(400, "account_not_deployed", { account: acct });

      const quota = takeQuota(acct, lang);
      if (!quota.ok) return bad(429, "quota_exceeded", { reason: quota.reason });

      const args = [
        target,
        0n,
        data as Hex,
        {
          authenticatorData: assertion.authenticatorData as Hex,
          clientDataJSON: assertion.clientDataJSON as Hex,
          r: BigInt(assertion.r),
          s: BigInt(assertion.s)
        }
      ] as const;

      // Dry-run once so signature/challenge errors surface before submission (avoids paying gas for nothing)
      const { request } = await pub.simulateContract({
        address: acct,
        abi: passkeyAccountAbi,
        functionName: "execute",
        args,
        account: wallet.account
      });

      const hash = await wallet.writeContract(request);
      const receipt = await pub.waitForTransactionReceipt({ hash, timeout: 60_000 });
      if (receipt.status !== "success") return bad(502, "tx_reverted", { txHash: hash });
      return NextResponse.json({ ok: true, txHash: hash, account: acct, to: target });
    }

    return bad(400, "unknown_op", { op: body.op });
  } catch (e: any) {
    return bad(500, "relay_error", { message: e?.shortMessage || e?.message || String(e) });
  }
}
