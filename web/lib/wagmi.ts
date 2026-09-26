import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "viem";
import { monadTestnet } from "./chains";

/**
 * WalletConnect Cloud projectId。
 * 注意用 || 而不是 ??：.env.local 里写了 `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=`（空字符串）时，
 * ?? 不会回退，会让 RainbowKit 直接抛 "No projectId found"。
 * 未配置时用占位值，MetaMask 注入模式依然可用（不启用 WalletConnect 连接器）。
 */
const walletConnectProjectId =
  process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim() || "00000000000000000000000000000000";

export const config = getDefaultConfig({
  appName: "云筑家 · VirtuHome on Monad",
  projectId: walletConnectProjectId,
  chains: [monadTestnet],
  transports: {
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0])
  },
  ssr: true
});
