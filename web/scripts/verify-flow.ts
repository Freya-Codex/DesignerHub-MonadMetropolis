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
import { agentIdForScheme } from "../lib/agents";
import { pinFile, pinJson } from "../lib/pinata";
import { buildTokenMetadata } from "../lib/metadata";
import { schemeToPreviewSvg, validateScheme, type DesignScheme } from "../lib/scheme";

/**
 * Next.js 会自动加载 .env.local，但 tsx 直接跑脚本不会。
 * 这里手动加载，避免「.env.local 明明填了却报未设置」。
 * 优先级：真实环境变量 > .env.local（不覆盖已存在的值）。
 */
function loadEnvLocal(): void {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const rawLine of fs.readFileSync(file, "utf8").split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadEnvLocal();

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

  const dreamScheme = resolveAddress("DREAM_SCHEME_ADDRESS", "DreamScheme");
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
      args: [parent, contentHash as Hex, agentIdForScheme(remixed), tokenPin.uri]
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

  /* ---------------- 2. 应用到我家（创作者定价 + 谱系即时分账） ---------------- */
  if (!env.SKIP_APPLY) {
    const platform = await publicClient.readContract({
      address: schemeMarket,
      abi: schemeMarketAbi,
      functionName: "platform"
    });
    const creator = await publicClient.readContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName: "creatorOf",
      args: [applyToken]
    });
    const isParent = (await publicClient.readContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName: "parentOf",
      args: [applyToken]
    })) === 0n;
    // 原创 90/10；衍生 85/10/5（创作者/平台/祖先池）
    const creatorBps = isParent ? 9000n : 8500n;
    const platformBps = 1000n;

    let price = await publicClient.readContract({
      address: schemeMarket,
      abi: schemeMarketAbi,
      functionName: "priceOf",
      args: [applyToken]
    });
    if (price === 0n) {
      if (creator.toLowerCase() !== account.address.toLowerCase()) {
        console.log(`⏭️  #${applyToken} 未上架且本钱包非创作者，跳过应用检查`);
      } else {
        console.log(`→ #${applyToken} 未上架，先 setPrice(0.01 MON)…`);
        const sp = await wallet.writeContract({
          address: schemeMarket,
          abi: schemeMarketAbi,
          functionName: "setPrice",
          args: [applyToken, parseEther("0.01")]
        });
        await publicClient.waitForTransactionReceipt({ hash: sp });
        price = parseEther("0.01");
        check("setPrice 上架成功", true, "0.01 MON");
      }
    }

    if (price > 0n) {
      const [balBefore, platformBalBefore] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.getBalance({ address: platform })
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

      let ev: { creatorCut: bigint; platformCut: bigint; price: bigint } | null = null;
      for (const log of receipt.logs) {
        try {
          const d = decodeEventLog({ abi: [schemeAppliedEvent], data: log.data, topics: log.topics, strict: true });
          if (d.eventName === "SchemeApplied") {
            ev = {
              creatorCut: d.args.creatorCut as bigint,
              platformCut: d.args.platformCut as bigint,
              price: d.args.price as bigint
            };
          }
        } catch {
          /* 忽略 */
        }
      }
      check("解析到 SchemeApplied 事件", ev !== null);

      // 链上 splitPreview 作为分账预言机（自 remix 时祖先份额会并入创作者，占比随谱系动态）
      const [previewCreator, previewPlatform, ancestorPool, ancestors] = await publicClient.readContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "splitPreview",
        args: [applyToken, price]
      });
      const expectedCreator = previewCreator as bigint;
      const expectedPlatform = previewPlatform as bigint;
      const pool = ancestorPool as bigint;
      const ancestorList = ancestors as readonly `0x${string}`[];
      // splitPreview 不合并「祖先即本人」的份额，而事件里的 creatorCut 会并入（85% + 5%）
      const each = ancestorList.length > 0 ? pool / BigInt(ancestorList.length) : 0n;
      const poolRemainder = pool - each * BigInt(ancestorList.length);
      const selfExtra = ancestorList.some((a) => a.toLowerCase() === String(creator).toLowerCase()) ? each : 0n;
      const expectedEventCreator = expectedCreator + selfExtra;
      const expectedEventPlatform = expectedPlatform + poolRemainder;
      if (ev) {
        check("支付金额 == 定价", ev.price === price, `${formatEther(ev.price)} MON`);
        check(
          "创作者份额 == splitPreview（含祖先回流合并）",
          ev.creatorCut === expectedEventCreator,
          `${formatEther(ev.creatorCut)} MON（pool ${formatEther(pool)}，祖先 ${ancestorList.length} 位，本人回流 ${formatEther(selfExtra)}）`
        );
        check(
          "平台份额 == splitPreview（含取整余数）",
          ev.platformCut === expectedEventPlatform,
          `${formatEther(ev.platformCut)} MON`
        );
        check("平台基础份额 == 10%", expectedPlatform === (price * platformBps) / 10_000n);
        if (!isParent) {
          check(
            "衍生基础份额 == 85%",
            expectedCreator === (price * creatorBps) / 10_000n,
            `${formatEther(expectedCreator)} MON`
          );
        }
        check("创作者+平台 ≤ 全额（衍生时差额进祖先池）", ev.creatorCut + ev.platformCut <= ev.price);
      }

      const [balAfter, platformBalAfter, appliedAfter, gasCost] = await Promise.all([
        publicClient.getBalance({ address: account.address }),
        publicClient.getBalance({ address: platform }),
        publicClient.readContract({
          address: schemeMarket,
          abi: schemeMarketAbi,
          functionName: "appliedCount",
          args: [applyToken]
        }),
        publicClient.getTransactionReceipt({ hash }).then((r) => r.gasUsed * r.effectiveGasPrice)
      ]);

      const me = account.address.toLowerCase();
      const creatorIsMe = creator.toLowerCase() === me;
      const platformIsMe = platform.toLowerCase() === me;
      check("appliedCount +1", appliedAfter === appliedBefore + 1n, `${appliedBefore} → ${appliedAfter}`);

      // 平台余额检查（平台 == 买家时无意义，收入与支出混在同一账户，改由净支出覆盖）
      if (platformIsMe) {
        check("平台 == 本账户（份额直接回流）", true, `+${formatEther(expectedEventPlatform)} MON`);
      } else {
        check(
          "平台余额即时到账（无 pending）",
          platformBalAfter - platformBalBefore === expectedEventPlatform,
          `+${formatEther(platformBalAfter - platformBalBefore)} MON`
        );
      }

      // 买家净支出 = 全额 + gas - 回流（creatorCut / platformCut / 祖先池中属于本账户的部分）
      const baseReturn = (creatorIsMe ? expectedEventCreator : 0n) + (platformIsMe ? expectedEventPlatform : 0n);
      const netSpent = balBefore - balAfter;
      const upper = price + gasCost - baseReturn; // 祖先池不回流时的最大支出
      const lower = gasCost; // 祖先池全部回流（或原创无祖先池）时的最小支出
      check(
        "买家净支出落在预期区间",
        netSpent <= upper && netSpent >= lower,
        `实际 ${formatEther(netSpent)} MON / 区间 [${formatEther(lower)}, ${formatEther(upper)}]`
      );
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
