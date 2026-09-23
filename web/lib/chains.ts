import { defineChain } from "viem";

/**
 * Monad 测试网（Chain ID 10143），EVM 完全兼容。
 * 文档：https://testnet.monad.xyz
 */
export const monadTestnet = defineChain({
  id: 10143,
  name: "Monad Testnet",
  nativeCurrency: { name: "MON", symbol: "MON", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://testnet-rpc.monad.xyz"] },
    public: { http: ["https://testnet-rpc.monad.xyz"] }
  },
  blockExplorers: {
    default: { name: "Monad Explorer", url: "https://testnet.monadexplorer.com" }
  },
  // viem 内置链定义里没有 Monad 的 Multicall3，缺了它 client.multicall() 会直接报错。
  // 该合约已按 canonical 地址部署在 Monad 测试网（codesize 3808，getBlockNumber() 可调用）。
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11"
    }
  },
  testnet: true
});
