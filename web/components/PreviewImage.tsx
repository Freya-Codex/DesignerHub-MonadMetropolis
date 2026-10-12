"use client";

import { useEffect, useState } from "react";
import { toHttpUrl } from "@/lib/ipfs";
import { useI18n } from "@/lib/i18n";

const FALLBACK = "/previews/placeholder.svg";

/**
 * 统一的方案预览图。
 * IPFS 网关偶尔抽风或 CID 缺失时回退到本地占位图，避免出现碎裂图标。
 * 站点自带示例预览（/previews/*.svg）为双语资源：英文界面自动切换到 *.en.svg。
 */
export default function PreviewImage({
  uri,
  alt,
  className = "",
  lazy = true
}: {
  uri?: string | null;
  alt: string;
  className?: string;
  lazy?: boolean;
}) {
  const { lang } = useI18n();
  const [failed, setFailed] = useState(false);

  const localize = (u: string): string => {
    if (lang !== "en") return u;
    if (u.startsWith("/previews/") && u.endsWith(".svg") && !u.endsWith(".en.svg")) {
      return u.replace(/\.svg$/, ".en.svg");
    }
    return u;
  };

  const src = !uri || failed ? localize(FALLBACK) : localize(toHttpUrl(uri));

  useEffect(() => {
    setFailed(false);
  }, [uri]);

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading={lazy ? "lazy" : "eager"}
      onError={() => setFailed(true)}
    />
  );
}
