/**
  * Seed: mint the initial NFTs from the 3 sample schemes in assets/schemes, for demo convenience.
 *
  * Usage (from the web/ dir):
  *   cp .env.example .env.local        # fill in MONAD_PRIVATE_KEY and contract addresses
  *   npm run seed                       # mint 3 original schemes
  *   SEED_REMIX_FROM=1 npm run seed     # mint a remix version with #1 as parent
  *   SEED_APPLY_TOKEN=1 npm run seed    # additionally run one "apply to my home" on #1 (account needs MON)
 *
  * Contract address read order: env var DREAM_SCHEME_ADDRESS > contracts/deployments/monad-testnet.json
  * Without a Pinata key it automatically enters local:// demo mode (same URIs, the full flow runs).
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
import { agentIdForScheme } from "../lib/agents";
import { pinFile, pinJson } from "../lib/pinata";
import { buildTokenMetadata } from "../lib/metadata";
import { validateScheme, type DesignScheme } from "../lib/scheme";

/**
  * Next.js auto-loads .env.local, but running a script directly via tsx does not.
  * Loaded manually here to avoid "filled in .env.local yet reported unset".
  * Precedence: real env vars > .env.local (does not overwrite existing values).
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
      // Ignore read errors
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

  const dreamScheme = resolveAddress("DREAM_SCHEME_ADDRESS", "DreamScheme");
  const schemeMarket = resolveAddress("SCHEME_MARKET_ADDRESS", "SchemeMarket");
  if (!dreamScheme) {
    throw new Error("无法确定 DreamScheme 地址：请设置 DREAM_SCHEME_ADDRESS 或先运行 forge script 部署");
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

    // Preview image: prefer assets/schemes/previews/<same-name>.svg
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
      args: [parentId, contentHash, agentIdForScheme(design), tokenPin.uri]
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
        // Ignore
      }
    }

    console.log(
      `✅ ${file} → #${mintedId?.toString() ?? "?"} (${design.name}) tx=${txHash}\n   ${tokenPin.uri}`
    );

    if (applyToken !== undefined && applyToken !== 0n && schemeMarket && mintedId === applyToken) {
      const price = parseEther(env.SEED_APPLY_PRICE_ETH ?? "0.01");
      // New market: the creator lists at their own price first, and the buyer pays the listed price
      const sp = await walletClient.writeContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "setPrice",
        args: [applyToken, price]
      });
      await publicClient.waitForTransactionReceipt({ hash: sp });
      const applyHash = await walletClient.writeContract({
        address: schemeMarket,
        abi: schemeMarketAbi,
        functionName: "applyScheme",
        args: [applyToken],
        value: price
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
