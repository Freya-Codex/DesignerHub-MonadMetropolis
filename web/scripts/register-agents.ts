/**
  * register-agents: register the AI agents declared in web/lib/agents.ts into the on-chain AgentRegistry,
  * making per-provider agentId assignment actually effective (Kimi=1, Qwen=2, DeepSeek=3 ...).
 *
  * Usage (from the web/ dir):
  *   cp .env.example .env.local        # fill in MONAD_PRIVATE_KEY (AgentRegistry owner)
  *   npm run register-agents           # idempotent: skip registered ones, register missing ones in order
 *
  * Notes:
  * - MONAD_PRIVATE_KEY must be the AgentRegistry owner (registerAgent is onlyOwner).
  * - verifies the on-chain returned agentId matches lib/agents.ts's declaration and errors immediately on mismatch,
  *   to avoid a front-end mapping / on-chain mismatch.
  * - contract address read order: AGENT_REGISTRY_ADDRESS > contracts/deployments/monad-testnet.json.
 */
import fs from "node:fs";
import path from "node:path";
import {
  createPublicClient,
  createWalletClient,
  http,
  getAddress,
  type Address
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { monadTestnet } from "../lib/chains";
import { agentRegistryAbi } from "../lib/abis";
import { AGENTS } from "../lib/agents";

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

function resolveRegistry(): Address | undefined {
  const fromEnv = env.AGENT_REGISTRY_ADDRESS ?? env.NEXT_PUBLIC_AGENT_REGISTRY_ADDRESS;
  if (fromEnv) {
    try {
      return getAddress(fromEnv);
    } catch {
      console.warn(`⚠️  忽略无效 AGENT_REGISTRY_ADDRESS：${fromEnv}`);
    }
  }
  const deployFile = path.join(process.cwd(), "..", "contracts", "deployments", "monad-testnet.json");
  if (fs.existsSync(deployFile)) {
    try {
      const data = JSON.parse(fs.readFileSync(deployFile, "utf8")) as Record<string, string>;
      if (data.AgentRegistry) return getAddress(data.AgentRegistry);
    } catch {
      // ignore
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

  const registry = resolveRegistry();
  if (!registry) {
    throw new Error(
      "无法确定 AgentRegistry 地址：请设置 AGENT_REGISTRY_ADDRESS 或确保 contracts/deployments/monad-testnet.json 存在"
    );
  }
  console.log("🪪 AgentRegistry :", registry);
  console.log("👤 signer        :", account.address);

  const publicClient = createPublicClient({ chain: monadTestnet, transport: http() });
  const walletClient = createWalletClient({ account, chain: monadTestnet, transport: http() });

  for (const agent of AGENTS) {
    const id = agent.id;
    const already = await publicClient.readContract({
      address: registry,
      abi: agentRegistryAbi,
      functionName: "isRegistered",
      args: [id]
    });
    if (already) {
      console.log(`✅ agentId ${id} (${agent.name}) 已注册，跳过`);
      continue;
    }

    console.log(`⏳ 注册 agentId ${id} (${agent.name}) ← ${agent.metadataURI}`);
    const txHash = await walletClient.writeContract({
      address: registry,
      abi: agentRegistryAbi,
      functionName: "registerAgent",
      args: [agent.metadataURI]
    });
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    const assigned = await publicClient.readContract({
      address: registry,
      abi: agentRegistryAbi,
      functionName: "isRegistered",
      args: [id]
    });
    if (!assigned) {
      throw new Error(
        `❌ agentId ${id} (${agent.name}) 注册后校验失败：链上该 id 仍未注册。` +
          `请检查注册顺序 / AgentRegistry 是否已被其它 agent 占用，随后再重跑本脚本。tx=${txHash}`
      );
    }
    console.log(`   ↳ ok, tx=${txHash} block=${receipt.blockNumber}`);
  }

  console.log("🎉 agent 补登完成。");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
