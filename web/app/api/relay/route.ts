/**
 * app/api/relay/route.ts —— 演示用 gas sponsor（relayer）。
 *
 * 用途：让持有 passkey 的用户无需持有 MON 也能完成链上动作——
 *   1) op=createAccount：由 relayer 代付部署 P256PasskeyAccount（CREATE2 工厂）；
 *   2) op=execute      ：把 passkey 签好的断言提交给账户合约执行（relayer 只出 gas，
 *                        无法篡改操作内容——挑战覆盖 calldata 哈希与 nonce）。
 *
 * 安全边界（演示级）：
 *   · 仅 Monad 测试网（chainId 10143）；
 *   · value 恒为 0：relayer 不代转任何 ETH/MON；
 *   · 目标白名单：只允许调用本项目的 4 个合约，或账户自身的 addKey；
 *   · 额度：全局每日上限 + 单账户每日上限（进程内计数，重启清零）。
 *
 * ⚠️ 生产环境应改为：持久化配额、按账户/签名付费、指标与告警、密钥托管（KMS）。
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

/** 目标合约白名单（小写）。 */
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

// 进程内配额（演示级，重启清零）
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
  // 服务端统一走 serverTransport()：Alchemy 优先，公共 RPC 自动兜底。
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
    // 服务端 RPC 提供方（Alchemy 优先，公共 RPC 兜底）；只暴露标签，不含 Key。
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

      // 预演一次，签名/挑战错误会在提交前暴露（避免白付 gas）
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
