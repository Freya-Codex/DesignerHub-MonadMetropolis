import "@rainbow-me/rainbowkit/styles.css";
import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { metaMaskWallet, walletConnectWallet } from "@rainbow-me/rainbowkit/wallets";
import { http } from "viem";
import { monadTestnet } from "./chains";

/**
  * WalletConnect / Reown Cloud projectId (optional).
 *
  * WARNING: key point -- enable the WalletConnect connector only when a **real** projectId is available.
  * The previous implementation always injected a placeholder "000...0" and used RainbowKit's default wallet list
  * (including walletConnectWallet), causing the browser to request
 *   - https://api.web3modal.org/appkit/v1/config?projectId=000...0  → 403
  *   - wss://relay.walletconnect.org/...                            -> connection reset
  * when connecting a wallet, which then triggered a front-end client exception ("Application error: a client-side exception has occurred").
 *
  * Now: without a real projectId, the wallet list keeps only the browser-injected MetaMask,
  * the WalletConnect connector is never instantiated, and those network requests no longer happen.
  * To enable WalletConnect (mobile QR / more wallets), request one at https://cloud.reown.com and
  * put the projectId into NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID to turn it on automatically.
 */
const rawProjectId = process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID?.trim();
const hasRealProjectId = !!rawProjectId && !/^0+$/.test(rawProjectId);

export const config = getDefaultConfig({
  appName: "Designer Hub · Monad",
  // getDefaultConfig's type requires projectId; give a placeholder when there is no real value,
  // but the wallets list below will not include walletConnectWallet, so the placeholder is never actually used.
  projectId: hasRealProjectId ? rawProjectId! : "00000000000000000000000000000000",
  chains: [monadTestnet],
  wallets: [
    {
      // The RainbowKit connect modal is English; keep group names consistent with it (this config is fixed at module load and cannot switch reactively).
      groupName: hasRealProjectId ? "Recommended" : "Browser Wallet",
      wallets: hasRealProjectId ? [metaMaskWallet, walletConnectWallet] : [metaMaskWallet]
    }
  ],
  transports: {
    [monadTestnet.id]: http(monadTestnet.rpcUrls.default.http[0])
  },
  ssr: true
});
