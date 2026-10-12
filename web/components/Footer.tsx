"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

export default function Footer() {
  const { t } = useI18n();
  return (
    <footer className="hairline-t">
      <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-[11px] sm:flex-row sm:items-center sm:justify-between">
        <p className="mono text-muted">
          CHAIN 10143 · MONAD TESTNET · ERC-721 + ERC-2981 · IPFS
        </p>
        <nav className="mono flex flex-wrap items-center gap-4 text-muted">
          <a className="transition hover:text-violet-deep" href="https://testnet-rpc.monad.xyz" target="_blank" rel="noreferrer">
            RPC
          </a>
          <a className="transition hover:text-violet-deep" href="https://faucet.monad.xyz" target="_blank" rel="noreferrer">
            {t("水龙头", "Faucet")}
          </a>
          <a className="transition hover:text-violet-deep" href="https://testnet.monadexplorer.com" target="_blank" rel="noreferrer">
            {t("浏览器", "Explorer")}
          </a>
          <Link className="transition hover:text-violet-deep" href="/docs">
            {t("玩法文档", "Docs")}
          </Link>
        </nav>
      </div>
    </footer>
  );
}
