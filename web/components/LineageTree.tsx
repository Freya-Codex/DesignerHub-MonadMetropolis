"use client";

import Link from "next/link";

interface Props {
  lineage: bigint[];
  currentId: bigint;
  names?: Record<string, string>;
}

/** 谱系树：从原创 → 各代 remix → 当前方案。 */
export default function LineageTree({ lineage, currentId, names }: Props) {
  if (lineage.length === 0) {
    return <p className="text-sm text-zinc-500">暂无谱系数据。</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {lineage.map((id, i) => {
        const isCurrent = id === currentId;
        const isRoot = i === 0;
        return (
          <div key={id.toString()} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-400">→</span>}
            <Link
              href={`/scheme/${id.toString()}`}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isCurrent
                  ? "border-indigo-500 bg-indigo-600 text-white shadow"
                  : isRoot
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
            >
              <span>{isRoot ? "🌱 原创" : isCurrent ? "✨ 当前" : `#${id.toString()}`}</span>
              <span className="font-normal opacity-70">{names?.[id.toString()]}</span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
