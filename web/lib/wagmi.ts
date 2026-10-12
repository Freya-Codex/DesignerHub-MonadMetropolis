import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { monadTestnet } from "./chains";

/**
 * WalletConnect / Reown Cloud projectId（可选）。
 *
 * ⚠️ 关键：只有拿到**真实的** projectId 时才启用 WalletConnect 连接器。
 * 之前的实现无论有没有配置，都塞了一个占位值 "000...0" 并走 RainbowKit 默认钱包列表
 * （含 walletConnectWallet），导致连接钱包时浏览器去请求
 *   - https://api.web3modal.org/appkit/v1/config?projectId=000...0  → 403
 *   - wss://relay.walletconnect.org/...                            → 连接被重置
 * 进而触发前端客户端异常（“Application error: a client-side exception has occurred”）。
 *
 * 现在：没有真实 projectId 时，钱包列表只保留浏览器注入的 MetaMask，
 * 完全不会实例化 WalletConnect 连接器，也就不再发生上面这些网络请求。
 * 想启用 WalletConnect（手机扫码/更多钱包），去 https://cloud.reown.com 申请一个
 * projectId 填进 NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID 即可自动开启。
 */
const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const hasRealProjectId = !!rawProjectId && !/^0+$/.test(rawProjectId);

export const config = getDefaultConfig({
  appName: "Designer Hub · Monad",
  // getDefaultConfig 的类型要求 projectId 必填；没有真实值时给占位符，
  // 但下面的 wallets 列表不会包含 walletConnectWallet，占位符不会被真正使用。
  projectId: hasRealProjectId ? rawProjectId! : "00000000000000000000000000000000",
  chains: [monadTestnet],
  wallets: [
    {
      // RainbowKit 连接弹窗为英文，分组名与其保持一致（该配置在模块加载时固定，无法响应式切换）。
      groupName: hasRealProjectId ? "Recommended" : "Browser Wallet",
      wallets: hasRealProjectId ? [metaMaskWallet, walletConnectWallet] : [metaMaskWallet]
    }
  ],
  transports: {
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0])
  },
  ssr: true
});
