"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { CommentItem } from "@/lib/comments";
import { shortAddress } from "@/lib/scheme";
import { useI18n } from "@/lib/i18n";

export default function CommentsSection({ tokenId }: { tokenId: bigint }) {
  const { t, lang, locale } = useI18n();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [items, setItems] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comment?tokenId=${tokenId.toString()}&lang=${lang}`);
      if (!res.ok) throw new Error(t("评论读取失败", "Failed to load comments"));
      const data = (await res.json()) as { items: CommentItem[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }, [tokenId, lang]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError(t("请输入评论内容", "Please enter a comment"));
      return;
    }
    if (!address || !isConnected) {
      setError(t("请先连接 MetaMask", "Connect MetaMask first"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const issuedAt = new Date().toISOString();
      const message = [
        "Designer Hub · Monad 评论签名",
        `方案 #${tokenId.toString()}`,
        `钱包地址: ${address}`,
        `签署时间: ${issuedAt}`,
        "",
        "签署即表示你确认以上身份，用于链下评论归属（不消耗 gas）。"
      ].join("\n");

      const signature = await signMessageAsync({ message });
      const res = await fetch("/api/comment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tokenId: Number(tokenId), text: trimmed, address, signature, message, lang })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("发布失败", "Failed to publish"));
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : t("发布失败", "Failed to publish"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="sheet p-5">
      <div className="flex items-baseline justify-between">
        <h2 className="display-sm text-[15px]">{t("协作讨论", "Discussion")}</h2>
        <p className="eyebrow">
          {t(`${items.length} 条`, `${items.length} comments`)} · OFF-CHAIN · {t("零 GAS", "ZERO GAS")}
        </p>
      </div>

      <div className="mt-4 flex flex-col gap-2 sm:flex-row">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={
            isConnected
              ? t("写下你的反馈，或提出 remix 想法…", "Leave your feedback, or share a remix idea…")
              : t("连接钱包后可签名发表评论", "Connect a wallet to sign and post a comment")
          }
          className="input resize-none"
        />
        <button onClick={() => void submit()} disabled={busy || !isConnected} className="btn-primary h-fit shrink-0 whitespace-nowrap sm:!px-5">
          {busy ? t("签名中…", "Signing…") : t("签名发布", "Sign & post")}
        </button>
      </div>
      <p className="mt-2 text-[11px] text-muted">
        {t(
          "评论以钱包签名（SIWE 风格）校验归属后链下存储，不需要支付任何 gas。",
          "Comments are verified by a wallet signature (SIWE-style) and stored off-chain — no gas required."
        )}
      </p>
      {error && <p className="mt-2 rounded-xl bg-coral/15 p-2.5 text-xs text-[#a53f52]">{error}</p>}

      <ul className="mt-4 divide-y divide-hairline">
        {items.length === 0 && (
          <li className="py-6 text-center text-xs text-muted">
            {t("还没有评论 —— 成为第一个给作者反馈的人。", "No comments yet — be the first to give the creator feedback.")}
          </li>
        )}
        {[...items].reverse().map((c) => (
          <li key={c.id} className="py-3.5">
            <div className="flex items-center justify-between">
              <span className="mono text-[11px] font-semibold text-violet-deep">{shortAddress(c.author, 5)}</span>
              <time className="mono text-[10.5px] text-muted" dateTime={c.createdAt}>
                {new Date(c.createdAt).toLocaleString(locale, { hour12: false })}
              </time>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-ink/85">{c.text}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}
