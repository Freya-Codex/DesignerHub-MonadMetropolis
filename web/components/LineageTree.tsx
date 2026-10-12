"use client";

import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface Props {
  lineage: bigint[];
  currentId: bigint;
  names?: Record<string, string>;
}

/** 谱系树：以「图纸节点 + 虚线脊线」呈现从原创到当前的创作链。 */
export default function LineageTree({ lineage, currentId, names }: Props) {
  const { t } = useI18n();
  if (lineage.length === 0) {
    return <p className="text-sm text-muted">{t("暂无谱系数据。", "No lineage data yet.")}</p>;
  }
  return (
    <div className="flex flex-wrap items-center gap-y-3">
      {lineage.map((id, i) => {
        const isCurrent = id === currentId;
        const isRoot = i === 0;
        return (
          <div key={id.toString()} className="flex items-center">
            {i > 0 && <span className="dim-line mx-1.5 h-px w-6 sm:w-9" />}
            <Link
              href={`/scheme/${id.toString()}`}
              className={`flex items-center gap-2 rounded-xl border px-3 py-2 transition ${
                isCurrent
                  ? "border-violet bg-violet text-white shadow-glow"
                  : isRoot
                    ? "border-violet/35 bg-violet/5 text-violet-deep hover:border-violet/60"
                    : "border-hairline bg-white text-ink/75 hover:border-violet/40 hover:text-ink"
              }`}
            >
              <span className="mono text-[10px] tracking-wider opacity-70">
                {isRoot ? "ORIGIN" : `#${id.toString()}`}
              </span>
              <span className="display-sm max-w-[9rem] truncate text-[12.5px]">
                {names?.[id.toString()] ?? (isCurrent ? t("当前方案", "Current scheme") : t("方案", "Scheme"))}
              </span>
            </Link>
          </div>
        );
      })}
    </div>
  );
}
