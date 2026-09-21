"use client";

import Link from "next/link";
import type { SchemeSummary } from "@/lib/contracts";
import { toHttpUrl } from "@/lib/ipfs";
import { shortAddress } from "@/lib/scheme";

export default function SchemeCard({ scheme, rank }: { scheme: SchemeSummary; rank?: number }) {
  const img = scheme.image ? toHttpUrl(scheme.image) : "/previews/placeholder.svg";
  return (
    <Link
      href={`/scheme/${scheme.tokenId.toString()}`}
      className="card group overflow-hidden transition hover:-translate-y-0.5 hover:shadow-lg"
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-zinc-100">
        <img
          src={img}
          alt={scheme.name}
          className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
          loading="lazy"
        />
        <div className="absolute left-2.5 top-2.5 flex items-center gap-1.5">
          <span className="rounded-full bg-black/60 px-2 py-0.5 text-[11px] font-medium text-white backdrop-blur">
            {scheme.theme}
          </span>
          {rank !== undefined && (
            <span className="rounded-full bg-amber-400 px-2 py-0.5 text-[11px] font-bold text-zinc-900">
              #{rank + 1}
            </span>
          )}
        </div>
        {scheme.parentId !== 0n && (
          <span className="absolute bottom-2.5 left-2.5 rounded-full bg-violet-600/90 px-2 py-0.5 text-[11px] font-medium text-white">
            衍生自 #{scheme.parentId.toString()}
          </span>
        )}
      </div>
      <div className="p-3.5">
        <h3 className="line-clamp-1 text-sm font-bold text-zinc-900">{scheme.name}</h3>
        <p className="mt-0.5 line-clamp-1 text-xs text-zinc-500">{scheme.description || scheme.roomType}</p>
        <div className="mt-3 flex items-center justify-between text-xs text-zinc-500">
          <span className="flex items-center gap-1">
            <span className="h-4 w-4 rounded-full bg-indigo-100 text-center text-[10px] leading-4 text-indigo-600">
              ⛏
            </span>
            {shortAddress(scheme.creator)}
          </span>
          <span className="flex items-center gap-2.5">
            <span title="Remix 数">
              🔁 <b className="text-zinc-700">{scheme.remixCount}</b>
            </span>
            <span title="被应用次数">
              🏠 <b className="text-zinc-700">{scheme.appliedCount}</b>
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}
