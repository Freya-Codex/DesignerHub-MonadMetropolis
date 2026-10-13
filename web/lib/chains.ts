import { defineChain } from "viem";

/**
  * Monad Testnet (Chain ID 10143), fully EVM-compatible.
  * Docs: https://testnet.monad.xyz
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
  // viem's built-in chain definition has no Multicall3 for Monad; without it client.multicall() errors out.
  // That contract is deployed at the canonical address on Monad Testnet (codesize 3808, getBlockNumber() callable).
  contracts: {
    multicall3: {
      address: "0xcA11bde05977b3631167028862bE2a173976CA11"
    }
  },
  testnet: true
});
