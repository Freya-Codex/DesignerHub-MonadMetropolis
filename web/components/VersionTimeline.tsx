"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Props {
  line: bigint[];
  currentId: bigint;
  names?: Record<string, string>;
}

/** Version timeline: v1 / v2 / v3... on the same author chain (the order itself carries meaning) */
export default function VersionTimeline({ line, currentId, names }: Props) {
  const { t } = useI18n();
  if (!line || line.length === 0) return null;
  const latest = line[line.length - 1];
  return (
    <ol className="flex flex-wrap items-stretch gap-y-3">
      {line.map((id, i) => {
        const isCurrent = id === currentId;
        const isLatest = id === latest;
        return (
          <li key={id.toString()} className="flex items-stretch">
            {i > 0 && <span className="dim-line my-auto mx-1.5 h-px w-6 sm:w-10" />}
            <Link
              href={`/scheme/${id.toString()}`}
              title={names?.[id.toString()]}
              className={`flex min-w-[7.5rem] flex-col gap-0.5 rounded-xl border px-3 py-2 transition ${
                isCurrent
                  ? "border-violet bg-violet text-white shadow-glow"
                  : "border-hairline bg-white hover:border-violet/45"
              }`}
            >
              <span className={`mono text-[10px] tracking-[0.14em] ${isCurrent ? "text-white/75" : "text-muted"}`}>
                V{i + 1}
                {isLatest && !isCurrent ? " · LATEST" : ""}
              </span>
              <span className={`display-sm text-[12.5px] ${isCurrent ? "text-white" : "text-ink/85"}`}>
                #{id.toString()}
                {isCurrent ? t(" · 当前", " · current") : ""}
              </span>
            </Link>
          </li>
        );
      })}
    </ol>
  );
}
