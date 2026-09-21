"use client";

import { useMemo } from "react";
import { schemeToPreviewSvg, svgToDataUri, type DesignScheme } from "@/lib/scheme";

export default function SchemePreview({
  scheme,
  className = ""
}: {
  scheme: DesignScheme;
  className?: string;
}) {
  const src = useMemo(() => {
    const svg = schemeToPreviewSvg(scheme);
    return svgToDataUri(svg);
  }, [scheme]);
  return (
    <img
      src={src}
      alt={`${scheme.name} 预览占位图（自动生成）`}
      className={`w-full ${className}`}
    />
  );
}
