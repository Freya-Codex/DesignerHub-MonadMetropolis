"use client";

import { useCallback, useEffect, useState } from "react";
import { useAccount, useSignMessage } from "wagmi";
import type { CommentItem } from "@/lib/comments";
import { shortAddress } from "@/lib/scheme";

export default function CommentsSection({ tokenId }: { tokenId: bigint }) {
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();

  const [items, setItems] = useState<CommentItem[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/comment?tokenId=${tokenId.toString()}`);
      if (!res.ok) throw new Error("评论读取失败");
      const data = (await res.json()) as { items: CommentItem[] };
      setItems(data.items ?? []);
    } catch {
      setItems([]);
    }
  }, [tokenId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) {
      setError("请输入评论内容");
      return;
    }
    if (!address || !isConnected) {
      setError("请先连接 MetaMask");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      // SIWE 风格：对「方案号 + 地址 + 时间戳」的文本签名，后端恢复地址校验
      const issuedAt = new Date().toISOString();
      const message = [
        "云筑家 · DreamHome 评论签名",
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
        body: JSON.stringify({ tokenId: Number(tokenId), text: trimmed, address, signature, message })
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(data.error ?? "发布失败");
      setText("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "发布失败");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card space-y-4 p-5">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-zinc-900">💬 协作讨论（链下 · 钱包签名）</h2>
        <span className="text-[11px] text-zinc-400">
          {items.length} 条 · 不消耗 gas
        </span>
      </div>

      <div className="flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder={isConnected ? "给创作者/作者一些反馈，或提出 remix 想法…" : "连接钱包后可签名发表评论"}
          className="input resize-none text-sm"
        />
        <button
          onClick={() => void submit()}
          disabled={busy || !isConnected}
          className="btn-primary h-fit !px-5"
        >
          {busy ? "签名中…" : "✍ 签名发布"}
        </button>
      </div>
      {!isConnected && <p className="text-xs text-zinc-500">使用 MetaMask 对内容签名即可发布，无需支付任何 gas。</p>}
      {error && <p className="rounded-xl bg-red-50 p-2.5 text-xs text-red-700">{error}</p>}

      <ul className="space-y-3">
        {items.length === 0 && (
          <li className="rounded-xl bg-zinc-50 p-3 text-center text-xs text-zinc-400">
            还没有评论，来写下第一条反馈吧
          </li>
        )}
        {[...items].reverse().map((c) => (
          <li key={c.id} className="rounded-xl border border-zinc-100 bg-zinc-50/60 p-3">
            <div className="flex items-center justify-between text-[11px] text-zinc-500">
              <span className="font-mono font-semibold text-indigo-600">{shortAddress(c.author, 5)}</span>
              <time dateTime={c.createdAt}>
                {new Date(c.createdAt).toLocaleString("zh-CN", { hour12: false })}
              </time>
            </div>
            <p className="mt-1.5 text-sm leading-relaxed text-zinc-800">{c.text}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
