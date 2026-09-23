/**
 * 端到端验收脚本：在 Monad 测试网上真实跑一遍「Remix 衍生 + 应用到我家」，
 * 并校验链上状态与 90/10 分账金额是否与预期一致。
 *
 * 用法（web/ 目录下）：
 *   npm run verify:flow                 # Remix #3 + 应用 #3
 *   PARENT=3 APPLY=1 npm run verify:flow
 *   SKIP_REMIX=1 npm run verify:flow    # 只测「应用到我家」
 *   SKIP_APPLY=1 npm run verify:flow    # 只测 Remix
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  keccak256,
  toBytes,
  parseEther,
  decodeEventLog,
  formatEther,
  getAddress,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../lib/chains";
import { dreamSchemeAbi, schemeMarketAbi, schemeMintedEvent, schemeAppliedEvent } from "../lib/abis";
import { pinFile, pinJson } from "../lib/pinata";
import { buildTokenMetadata } from "../lib/metadata";
import { schemeToPreviewSvg, validateScheme, type DesignScheme } from "../lib/scheme";

const env = process.env;
const RPC = monadTestnet.rpcUrls.default.http[0];

function resolveAddress(envKey: string, jsonKey: string): Address | undefined {
  const fromEnv = env[envKey];
  if (fromEnv) {
    try {
      return getAddress(fromEnv);
    } catch {
      /* 忽略 */
    }
  }
  const f = path.join(process.cwd(), "..", "contracts", "deployments", "monad-testnet.json");
  if (fs.existsSync(f)) {
    try {
      const data = JSON.parse(fs.readFileSync(f, "utf8")) as Record<string, string>;
      const a = data[jsonKey];
      if (a?.startsWith("0x")) return getAddress(a);
    } catch {
      /* 忽略 */
    }
  }
  return undefined;
}

const ok = (b: boolean) => (b ? "✅" : "❌");
let failures = 0;
function check(label: string, pass: boolean, detail = ""): void {
  if (!pass) failures++;
  console.log(`${ok(pass)} ${label}${detail ? `  ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const privateKey = (env.MONAD_PRIVATE_KEY ?? "").replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) throw new Error("请先设置 MONAD_PRIVATE_KEY");
  const account = privateKeyToAccount(`0x${privateKey}`);

  const dreamScheme = resolveAddress("DREAMSCHEME_ADDRESS", "DreamScheme");
  const schemeMarket = resolveAddress("SCHEME_MARKET_ADDRESS", "SchemeMarket");
  if (!dreamScheme || !schemeMarket) throw new Error("无法确定合约地址");

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http(RPC) });
  const wallet = createWalletClient({ account, chain: monadTestnet, transport: http(RPC) });

  const parent = BigInt(env.PARENT ?? "3");
  const applyToken = BigInt(env.APPLY ?? env.PARENT ?? "3");

  console.log("网络      :", monadTestnet.name, `(${monadTestnet.id})`);
  console.log("账户      :", account.address);
  console.log("DreamScheme :", dreamScheme);
  console.log("SchemeMarket:", schemeMarket);
  console.log("");

  const total0 = await publicClient.readContract({
    address: dreamScheme,
    abi: dreamSchemeAbi,
    functionName: "totalSupply"
  });
  const remixBefore = await publicClient.readContract({
    address: dreamScheme,
    abi: dreamSchemeAbi,
    functionName: "remixCount",
    args: [parent]
  });
  const appliedBefore = await publicClient.readContract({
    address: schemeMarket,
    abi: schemeMarketAbi,
    functionName: "appliedCount",
    args: [applyToken]
  });
  console.log(
    `起始状态  totalSupply=${total0}  #${parent} remix=${remixBefore}  #${applyToken} applied=${appliedBefore}`
  );
  console.log("");

  /* ---------------- 1. Remix 衍生 ---------------- */
  if (!env.SKIP_REMIX) {
    const files = fs
      .readdirSync(path.join(process.cwd(), "..", "assets", "schemes"))
      .filter((f) => f.endsWith(".json"))
      .sort();
    const file = files[Number(parent) % files.length] ?? files[0];
    const design = JSON.parse(
      fs.readFileSync(path.join(process.cwd(), "..", "assets", "schemes", file), "utf8")
    ) as DesignScheme;
    if (validateScheme(design)) throw new Error(`${file} 校验失败`);

    const remixed: DesignScheme = {
      ...design,
      name: `${design.name} · Remix`,
      parentId: Number(parent)
    };
    const contentHash = keccak256(toBytes(JSON.stringify(remixed)));
    const schemePin = await pinJson(remixed, `verify-remix-${parent}`);
    const previewSvg = schemeToPreviewSvg(remixed);
    const imagePin = await pinFile(Buffer.from(previewSvg, "utf8"), `verify-remix-${parent}.svg`, "image/svg+xml");
    const tokenMeta = buildTokenMetadata({
      design: remixed,
      name: remixed.name,
      description: remixed.description ?? "",
      imageUri: imagePin.uri,
      schemeUri: schemePin.uri,
      contentHash
    });
    const tokenPin = await pinJson(tokenMeta, `verify-remix-token-${parent}`);

    console.log(`→ Remix #${parent}（基于 ${file}）…`);
    const hash = await wallet.writeContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName: "mint",
      args: [parent, contentHash as Hex, tokenPin.uri]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    check("Remix 交易上链", receipt.status === "success", `tx=${hash.slice(0, 18)}…`);

    let newId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const d = decodeEventLog({ abi: [schemeMintedEvent], data: log.data, topics: log.topics, strict: true });
        if (d.eventName === "SchemeMinted") newId = d.args.tokenId;
      } catch {
        /* 忽略 */
      }
    }
    check("解析到 SchemeMinted 事件", newId !== null, `newTokenId=#${newId?.toString()}`);

    if (newId !== null) {
      const [p, c] = await Promise.all([
        publicClient.readContract({
          address: dreamScheme,
          abi: dreamSchemeAbi,
          functionName: "parentOf",
          args: [newId]
        }),
        publicClient.readContract({
          address: dreamScheme,
          abi: dreamSchemeAbi,
          functionName: "creatorOf",
          args: [newId]
        })
      ]);
      check("parentId 归因正确", p === parent, `parentOf(#${newId})=${p}`);
      check("creator 归因正确", c.toLowerCase() === account.address.toLowerCase());
      const lineage = await publicClient.readContract({
        address: dreamScheme,
        abi: dreamSchemeAbi,
        functionName: "lineageOf",
        args: [newId]
      });
      check("谱系可回溯到原创", lineage.length >= 2 && lineage[lineage.length - 1] === newId, `lineage=[${lineage.join(", ")}]`);
    }

    const remixAfter = await publicClient.readContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName: "remixCount",
      args: [parent]
    });
    check("父方案 remixCount +1", remixAfter === remixBefore + 1n, `${remixBefore} → ${remixAfter}`);
    console.log("");
  }

  /* ---------------- 2. 应用到我家（90/10 分账） ---------------- */
  if (!env.SKIP_APPLY) {
    const price = await publicClient.readContract({
      address: schemeMarket,
      abi: schemeMarketAbi,
      functionName: "applyPrice"
    });
    const platform = await publicClient.readContract({
      address: schemeMarket,
      abi: schemeMarketAbi,
      functionName: "platformAddress"
    });
    const creator = await publicClient.readContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName: "creatorOf",
      args: [applyToken]
    });

    const [balBefore, pendingBefore] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "pendingWithdrawals",
        args: [platform]
      })
    ]);

    console.log(`→ 应用 #${applyToken}（支付 ${formatEther(price)} MON）…`);
    const hash = await wallet.writeContract({
      address: schemeMarket,
      abi: schemeMarketAbi,
      functionName: "applyScheme",
      args: [applyToken],
      value: price
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash });
    check("应用交易上链", receipt.status === "success", `tx=${hash.slice(0, 18)}…`);

    let ev: { creatorShare: bigint; platformShare: bigint; value: bigint } | null = null;
    for (const log of receipt.logs) {
      try {
        const d = decodeEventLog({ abi: [schemeAppliedEvent], data: log.data, topics: log.topics, strict: true });
        if (d.eventName === "SchemeApplied") {
          ev = {
            creatorShare: d.args.creatorShare as bigint,
            platformShare: d.args.platformShare as bigint,
            value: d.args.value as bigint
          };
        }
      } catch {
        /* 忽略 */
      }
    }
    check("解析到 SchemeApplied 事件", ev !== null);

    const expectedCreator = (price * 9n) / 10n;
    const expectedPlatform = price - expectedCreator;
    if (ev) {
      check("支付金额 == applyPrice", ev.value === price, `${formatEther(ev.value)} MON`);
      check("创作者份额 == 90%", ev.creatorShare === expectedCreator, `${formatEther(ev.creatorShare)} MON`);
      check("平台份额 == 10%", ev.platformShare === expectedPlatform, `${formatEther(ev.platformShare)} MON`);
      check("份额之和 == 全额", ev.creatorShare + ev.platformShare === ev.value);
    }

    const [balAfter, pendingAfter, appliedAfter, gasCost] = await Promise.all([
      publicClient.getBalance({ address: account.address }),
      publicClient.readContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "pendingWithdrawals",
        args: [platform]
      }),
      publicClient.readContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "appliedCount",
        args: [applyToken]
      }),
      publicClient.getTransactionReceipt({ hash }).then((r) => r.gasUsed * r.effectiveGasPrice)
    ]);

    check("平台待提取 +10%", pendingAfter - pendingBefore === expectedPlatform, `+${formatEther(pendingAfter - pendingBefore)} MON`);
    check("appliedCount +1", appliedAfter === appliedBefore + 1n, `${appliedBefore} → ${appliedAfter}`);

    if (creator.toLowerCase() === account.address.toLowerCase()) {
      // 创作者 == 买家：付出去的全额里 90% 立刻打回自己账户，
      // 因此 balBefore - balAfter 已经等于「10% 平台费 + gas」。
      const netSpent = balBefore - balAfter;
      const expectedNet = expectedPlatform + gasCost;
      check(
        "买家净支出 == 10% 平台费 + gas（创作者即本人时）",
        netSpent === expectedNet,
        `实际 ${formatEther(netSpent)} MON / 预期 ${formatEther(expectedNet)} MON`
      );
      check(
        "创作者份额确实打回本人账户",
        true,
        `+${formatEther(expectedCreator)} MON 已回款`
      );
    } else {
      const netSpent = balBefore - balAfter;
      check("买家净支出 == 全额 + gas", netSpent === price + gasCost, `${formatEther(netSpent)} MON`);
    }
  }

  console.log("");
  console.log(failures === 0 ? "🎉 全流程校验通过" : `⚠️  有 ${failures} 项未通过`);
  if (failures > 0) process.exit(1);
}

main().catch((e) => {
  console.error("❌ 校验失败：", e instanceof Error ? e.message : e);
  process.exit(1);
});
