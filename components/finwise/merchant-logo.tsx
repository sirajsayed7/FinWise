"use client";

import { memo, useEffect, useState } from "react";
import {
  getLogoFallbackClass,
  getLogoFallbackText,
  getMerchantLogoUrls,
  rememberBadLogoUrl
} from "@/lib/merchant-logos";

export const MerchantLogo = memo(function MerchantLogo({
  merchant,
  fallback
}: {
  merchant: string;
  fallback: string;
}) {
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [logoIndex, setLogoIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setLogoUrls(getMerchantLogoUrls(merchant));
    setLogoIndex(0);
    setLoaded(false);
  }, [merchant]);

  const logoUrl = logoUrls[logoIndex];
  const fallbackNode = (
    <span className={`grid h-full w-full place-items-center rounded-full text-[12px] font-extrabold ${getLogoFallbackClass(merchant)}`}>
      {getLogoFallbackText(merchant, fallback)}
    </span>
  );

  if (!logoUrl) return fallbackNode;

  return (
    <span className="relative block h-full w-full rounded-full">
      {fallbackNode}
      <img
        src={logoUrl}
        alt=""
        className={`absolute inset-0 h-full w-full rounded-full bg-white object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          rememberBadLogoUrl(merchant, logoUrl);
          setLoaded(false);
          setLogoIndex((current) => current + 1);
        }}
      />
    </span>
  );
});
