"use client";

import { useEffect, useState } from "react";
import { toHttpUrl } from "@/lib/ipfs";

const FALLBACK = "/previews/placeholder.svg";

/**
 * 统一的方案预览图。
 * IPFS 网关偶尔抽风或 CID 缺失时回退到本地占位图，避免出现碎裂图标。
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
  const [failed, setFailed] = useState(false);
  const src = !uri || failed ? FALLBACK : toHttpUrl(uri);

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
