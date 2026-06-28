import { merchantLogoDomains } from "@/lib/dashboard-constants";
import type { MerchantLogoRecord, Transaction } from "@/lib/types";

const logoFallbackClasses = [
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
  "bg-orange-50 text-orange-700",
  "bg-rose-50 text-rose-700",
  "bg-slate-100 text-slate-700"
];

const prefetchedMerchantLogos = new Set<string>();

export function getMerchantLogoUrls(merchant: string) {
  const key = getLogoStorageKey(merchant);
  const badUrls = getBadLogoUrls(merchant);
  const override = getCachedMerchantLogoOverride(merchant);
  if (override && !badUrls.includes(override.logoUrl)) return [override.logoUrl];

  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        const urls = (JSON.parse(cached) as string[]).filter((url) => !badUrls.includes(url));
        if (urls.length) return urls;
      }
    } catch {
      // A logo cache failure must not block transaction rendering.
    }
  }

  const urls = getKnownMerchantLogoUrls(merchant).filter((url) => !badUrls.includes(url));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(urls));
    } catch {
      // The image can still load for this session.
    }
  }
  return urls;
}

export function getKnownMerchantLogoUrls(merchant: string) {
  const normalized = normalizeLogoKey(merchant);
  const match = merchantLogoDomains.find((item) =>
    item.keywords.some((keyword) => normalized.includes(normalizeLogoKey(keyword)))
  );
  if (!match) return [];
  return [
    `https://logo.clearbit.com/${match.domain}`,
    `https://www.google.com/s2/favicons?domain=${match.domain}&sz=128`
  ];
}

export function cacheMerchantLogoOverrides(logos: MerchantLogoRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("finwise.logoOverrides", JSON.stringify(logos));
  } catch {
    // Logo persistence should never block financial data.
  }
}

export function mergeLogoOverrides(current: MerchantLogoRecord[], transactions: Transaction[]) {
  const byKey = new Map(current.map((logo) => [logo.merchantKey, logo]));
  for (const transaction of transactions) {
    const merchantKey = getMerchantLogoKey(transaction.merchant);
    if (!merchantKey || byKey.has(merchantKey)) continue;
    const logoUrl = getKnownMerchantLogoUrls(transaction.merchant)[0];
    if (!logoUrl) continue;
    byKey.set(merchantKey, {
      merchantKey,
      merchantName: transaction.merchant,
      logoUrl,
      source: "known_domain",
      confidence: 0.86
    });
  }
  return Array.from(byKey.values());
}

export function rememberBadLogoUrl(merchant: string, url: string) {
  if (typeof window === "undefined") return;
  try {
    const key = getBadLogoStorageKey(merchant);
    const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
    if (!current.includes(url)) {
      window.localStorage.setItem(key, JSON.stringify([...current, url].slice(-12)));
    }
  } catch {
    // Broken logo storage should never block the transaction list.
  }
}

export function getLogoFallbackText(merchant: string, fallback: string) {
  const normalized = normalizeLogoKey(merchant) || normalizeLogoKey(fallback) || "fw";
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
}

export function getLogoFallbackClass(merchant: string) {
  const normalized = normalizeLogoKey(merchant);
  const hash = Array.from(normalized).reduce((total, char) => total + char.charCodeAt(0), 0);
  return logoFallbackClasses[hash % logoFallbackClasses.length];
}

export function preloadMerchantLogos(merchants: string[]) {
  const unique = Array.from(new Set(merchants.filter(Boolean)))
    .filter((merchant) => !prefetchedMerchantLogos.has(merchant))
    .slice(0, 80);
  if (!unique.length || typeof window === "undefined") return () => undefined;

  const preload = (items: string[]) => {
    for (const merchant of items) {
      prefetchedMerchantLogos.add(merchant);
      for (const url of getMerchantLogoUrls(merchant)) {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      }
    }
  };

  preload(unique.slice(0, 18));
  const remaining = unique.slice(18);
  if (!remaining.length) return () => undefined;

  const idle = window.requestIdleCallback
    ?? ((callback: IdleRequestCallback) =>
      window.setTimeout(() => callback({ didTimeout: false, timeRemaining: () => 0 }), 250));
  const cancelIdle = window.cancelIdleCallback ?? window.clearTimeout;
  const idleId = idle(() => preload(remaining), { timeout: 2500 });
  return () => cancelIdle(idleId);
}

function getCachedMerchantLogoOverride(merchant: string) {
  if (typeof window === "undefined") return null;
  try {
    const logos = JSON.parse(window.localStorage.getItem("finwise.logoOverrides") ?? "[]") as MerchantLogoRecord[];
    const key = getMerchantLogoKey(merchant);
    return logos.find((logo) => logo.merchantKey === key) ?? null;
  } catch {
    return null;
  }
}

function getBadLogoUrls(merchant: string) {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(getBadLogoStorageKey(merchant)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function getLogoStorageKey(merchant: string) {
  return `finwise.logo.${getMerchantLogoKey(merchant) || "unknown"}`;
}

function getBadLogoStorageKey(merchant: string) {
  return `${getLogoStorageKey(merchant)}.bad`;
}

function normalizeLogoKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function getMerchantLogoKey(merchant: string) {
  return normalizeLogoKey(merchant).replace(/\s+/g, "-");
}
