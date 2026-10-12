"use client";

import { useMemo } from "react";
import { schemeToPreviewSvg, svgToDataUri, type DesignScheme } from "@/lib/scheme";
import { useI18n } from "@/lib/i18n";

export default function SchemePreview({
  scheme,
  className = ""
}: {
  scheme: DesignScheme;
  className?: string;
}) {
  const { t, lang } = useI18n();
  const src = useMemo(() => {
    const svg = schemeToPreviewSvg(scheme, lang);
    return svgToDataUri(svg);
  }, [scheme, lang]);
  const nm = lang === "en" ? scheme.nameEn ?? scheme.name : scheme.name;
  return (
    <img
      src={src}
      alt={`${nm} ${t("预览占位图（自动生成）", "preview placeholder (auto-generated)")}`}
      className={`w-full ${className}`}
    />
  );
}
