"use client";

import Link from "next/link";
import type { SchemeSummary } from "@/lib/contracts";
import { shortAddress } from "@/lib/scheme";
import { useI18n } from "@/lib/i18n";
import PreviewImage from "./PreviewImage";

export default function SchemeCard({ scheme, rank }: { scheme: SchemeSummary; rank?: number }) {
  const { pick, t } = useI18n();
  return (
    <Link
      href={`/scheme/${scheme.tokenId.toString()}`}
      className="group relative block overflow-hidden rounded-2xl border border-hairline bg-white transition duration-300 hover:-translate-y-0.5 hover:border-violet/45 hover:shadow-sheet"
    >
      <div className="relative aspect-[4/3] overflow-hidden bg-paper-2">
        <PreviewImage
          uri={scheme.image}
          alt={pick(scheme.name, scheme.nameEn)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        <span className="mono absolute left-3 top-3 rounded-md bg-ink/85 px-2 py-1 text-[10px] tracking-wider text-white backdrop-blur">
          #{scheme.tokenId.toString()}
        </span>
        <span className="absolute right-3 top-3 rounded-md border border-white/25 bg-white/85 px-2 py-1 text-[10px] font-semibold text-ink backdrop-blur">
          {pick(scheme.theme, scheme.themeEn)}
        </span>
        {rank !== undefined && (
          <span className="mono absolute bottom-3 right-3 rounded-md bg-violet px-2 py-1 text-[10px] font-bold text-white">
            {String(rank + 1).padStart(2, "0")}
          </span>
        )}
      </div>

      <div className="p-4">
        <h3 className="display-sm line-clamp-1 text-[15px] text-ink">{pick(scheme.name, scheme.nameEn)}</h3>
        <div className="mt-2 flex flex-wrap gap-1.5">
          <span className="chip !py-0.5 !text-[10.5px]">{pick(scheme.roomType, scheme.roomTypeEn)}</span>
          <span className="chip !py-0.5 !text-[10.5px]">
            {scheme.furnitureCount} {t("件家具", "items")}
          </span>
        </div>
        <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">
          {scheme.description
            ? pick(scheme.description, scheme.descriptionEn)
            : pick(scheme.roomType, scheme.roomTypeEn)}
        </p>

        <div className="mt-3.5 flex items-end justify-between border-t border-hairline pt-3">
          <div>
            <p className="eyebrow">CREATOR</p>
            <p className="mono mt-1 text-[11px] text-ink/80">{shortAddress(scheme.creator)}</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right">
              <p className="eyebrow">REMIX</p>
              <p className="mono mt-1 text-[13px] font-semibold text-ink">{scheme.remixCount}</p>
            </div>
            <div className="text-right">
              <p className="eyebrow">APPLIED</p>
              <p className="mono mt-1 text-[13px] font-semibold text-violet-deep">{scheme.appliedCount}</p>
            </div>
          </div>
        </div>

        {scheme.parentId !== 0n && (
          <p className="mono mt-3 text-[10.5px] text-[#a53f52]">
            ↳ REMIX OF #{scheme.parentId.toString()}
          </p>
        )}
      </div>

      <span className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 origin-left scale-x-0 bg-violet transition-transform duration-300 group-hover:scale-x-100" />
    </Link>
  );
}
