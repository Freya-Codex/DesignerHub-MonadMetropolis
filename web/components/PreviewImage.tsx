"use client";

import { useEffect, useState } from "react";
import { toHttpUrl } from "@/lib/ipfs";
import { useI18n } from "@/lib/i18n";

const FALLBACK = "/previews/placeholder.svg";

/**
  * Unified scheme preview image.
  * Falls back to a local placeholder when the IPFS gateway hiccups or the CID is missing, avoiding a broken icon.
  * The site's bundled sample previews (/previews/*.svg) are bilingual: the English UI auto-switches to *.en.svg.
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
