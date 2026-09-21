/**
 * Seed：用 assets/schemes 里的 3 套示例方案铸造初始 NFT，便于演示。
 *
 * 用法（在 web/ 目录下）：
 *   cp .env.example .env.local        # 填入 MONAD_PRIVATE_KEY 与合约地址
 *   npm run seed                       # 铸造 3 个原创方案
 *   SEED_REMIX_FROM=1 npm run seed     # 以 #1 为 parent 铸造 remix 版本
 *   SEED_APPLY_TOKEN=1 npm run seed    # 对 #1 额外执行一次「应用到我家」（需账户有 MON）
 *
 * 合约地址读取顺序：环境变量 DREAMSCHEME_ADDRESS > contracts/deployments/monad-testnet.json
 * 未配置 Pinata 密钥时会自动进入 local:// 本地演示模式（URI 一致，全流程可跑通）。
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
  getAddress,
  type Address,
  type Hex
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../lib/chains";
import { dreamSchemeAbi, schemeMarketAbi, schemeMintedEvent } from "../lib/abis";
import { pinFile, pinJson } from "../lib/pinata";
import { buildTokenMetadata } from "../lib/metadata";
import { validateScheme, type DesignScheme } from "../lib/scheme";

const env = process.env;

function resolveAddress(envKey: string, jsonKey: string): Address | undefined {
  const fromEnv = env[envKey];
  if (fromEnv) {
    try {
      return getAddress(fromEnv);
    } catch {
      console.warn(`⚠️  忽略无效 ${envKey}：${fromEnv}`);
    }
  }
  const deployFile = path.join(process.cwd(), "..", "contracts", "deployments", "monad-testnet.json");
  if (fs.existsSync(deployFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(deployFile, "utf8")) as Record<string, string>;
      const addr = data[jsonKey];
      if (addr && addr.startsWith("0x")) return getAddress(addr);
    } catch {
      // 忽略读取错误
    }
  }
  return undefined;
}

async function main(): Promise<void> {
  const privateKey = (env.MONAD_PRIVATE_KEY ?? "").replace(/^0x/, "");
  if (!/^[0-9a-fA-F]{64}$/.test(privateKey)) {
    throw new Error("请先设置 MONAD_PRIVATE_KEY（测试网私钥，64 位 hex）");
  }
  const account = privateKeyToAccount(`0x${privateKey}`);

  const dreamScheme = resolveAddress("DREAMSCHEME_ADDRESS", "DreamScheme");
  const schemeMarket = resolveAddress("SCHEME_MARKET_ADDRESS", "SchemeMarket");
  if (!dreamScheme) {
    throw new Error("无法确定 DreamScheme 地址：请设置 DREAMSCHEME_ADDRESS 或先运行 forge script 部署");
  }
  console.log("🏠 DreamScheme :", dreamScheme);
  console.log("🏪 SchemeMarket :", schemeMarket ?? "未配置（跳过 apply）");

  const walletClient = createWalletClient({
    account,
    chain: monadTestnet,
    transport: http()
  });
  const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });

  const schemesDir = path.join(process.cwd(), "..", "assets", "schemes");
  const files = fs
    .readdirSync(schemesDir)
    .filter((f) => f.endsWith(".json"))
    .sort();

  if (files.length === 0) throw new Error(`assets/schemes 目录没有示例 JSON: ${schemesDir}`);

  const parentId = BigInt(env.SEED_REMIX_FROM ?? "0");
  const applyToken = env.SEED_APPLY_TOKEN ? BigInt(env.SEED_APPLY_TOKEN) : undefined;

  for (const file of files) {
    const raw = fs.readFileSync(path.join(schemesDir, file), "utf8");
    const design = JSON.parse(raw) as DesignScheme;
    const err = validateScheme(design);
    if (err) throw new Error(`${file} 校验失败：${err}`);

    const schemeJson = JSON.stringify(design);
    const contentHash = keccak256(toBytes(schemeJson));

    const schemePin = await pinJson(design, `seed-${file.replace(/\.json$/, "")}`);

    // 预览图：优先 assets/schemes/previews/<同名>.svg
    const previewName = file.replace(/\.json$/, ".svg");
    const previewPath = path.join(schemesDir, "previews", previewName);
    let imageUri = "";
    if (fs.existsSync(previewPath)) {
      const svg = fs.readFileSync(previewPath, "utf8");
      imageUri = (await pinFile(Buffer.from(svg, "utf8"), `seed-${previewName}`, "image/svg+xml")).uri;
    }

    const tokenMeta = buildTokenMetadata({
      design,
      name: design.name,
      description: design.description || "",
      imageUri,
      schemeUri: schemePin.uri,
      contentHash
    });
    const tokenPin = await pinJson(tokenMeta, `seed-token-${file.replace(/\.json$/, "")}`);

    const functionName = parentId > 0n ? "remix" : "mint";
    const txHash = await walletClient.writeContract({
      address: dreamScheme,
      abi: dreamSchemeAbi,
      functionName,
      args: [parentId, contentHash, tokenPin.uri]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    let mintedId: bigint | null = null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [schemeMintedEvent],
          data: log.data,
          topics: log.topics,
          strict: true
        });
        if (decoded.eventName === "SchemeMinted") {
          mintedId = decoded.args.tokenId;
          break;
        }
      } catch {
        // 忽略
      }
    }

    console.log(
      `✅ ${file} → #${mintedId?.toString() ?? "?"} (${design.name}) tx=${txHash}\n   ${tokenPin.uri}`
    );

    if (applyToken !== undefined && applyToken !== 0n && schemeMarket && mintedId === applyToken) {
      const applyHash = await walletClient.writeContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "applyScheme",
        args: [applyToken],
        value: parseEther(env.SEED_APPLY_PRICE_ETH ?? "0.01")
      });
      const applied = await publicClient.waitForTransactionReceipt({ hash: applyHash });
      console.log(`🏠 已对 #${applyToken.toString()} 执行「应用到我家」tx=${applied.transactionHash}`);
    }
  }

  console.log("\n🎉 Seed 完成。打开 http://localhost:3000 查看画廊与排行榜。");
  void walletClient;
  void account;
}

main().catch((e) => {
  console.error("❌ Seed 失败：", e instanceof Error ? e.message : e);
  process.exit(1);
});
