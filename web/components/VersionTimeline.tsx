"use client";

import Link from "next/link";

interface Props {
  line: bigint[];
  currentId: bigint;
  names?: Record<string, string>;
}

/** 版本时间线：同一作者链上的 v1/v2/v3…，按铸造顺序排列。 */
export default function VersionTimeline({ line, currentId, names }: Props) {
  if (!line || line.length === 0) return null;
  const latest = line[line.length - 1];
  return (
    <div className="flex flex-wrap items-center gap-2">
      {line.map((id, i) => {
        const isCurrent = id === currentId;
        const isLatest = id === latest;
        return (
          <div key={id.toString()} className="flex items-center gap-2">
            {i > 0 && <span className="text-zinc-300">—</span>}
            <Link
              href={`/scheme/${id.toString()}`}
              className={`flex items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                isCurrent
                  ? "border-indigo-500 bg-indigo-600 text-white shadow"
                  : isLatest
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
              }`}
              title={names?.[id.toString()]}
            >
              <span>v{i + 1}</span>
              <span className="font-mono opacity-70">#{id.toString()}</span>
              {isLatest && <span className="rounded bg-emerald-600/10 px-1 text-[10px] text-emerald-600">最新</span>}
              {isCurrent && <span className="rounded bg-white/20 px-1 text-[10px]">当前</span>}
            </Link>
          </div>
        );
      })}
    </div>
  );
}
