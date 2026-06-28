import type { SpendingPeriod } from "@/lib/dashboard-types";

export const periods: SpendingPeriod[] = ["This Month", "Last Month", "Year"];

export const categoryColors: Record<string, string> = {
  Groceries: "#22C55E",
  "Ordering Out": "#F97316",
  "Restaurants & Cafes": "#FB923C",
  Transport: "#06B6D4",
  Fuel: "#F59E0B",
  Shopping: "#3B82F6",
  Malls: "#7C3AED",
  Bills: "#8B5CF6",
  Subscriptions: "#D946EF",
  Rent: "#64748B",
  Health: "#14B8A6",
  Entertainment: "#0EA5E9",
  "Cash Withdrawal": "#94A3B8",
  "Bank Transfer": "#64748B",
  "Salary / Income": "#10B981",
  Other: "#CBD5E1"
};

export const categoryAvatarStyles: Record<string, string> = {
  Groceries: "bg-emerald-50 text-emerald-600",
  "Ordering Out": "bg-orange-500 text-white",
  "Restaurants & Cafes": "bg-orange-50 text-orange-600",
  Transport: "bg-cyan-50 text-cyan-600",
  Fuel: "bg-amber-50 text-amber-600",
  Shopping: "bg-blue-50 text-blue-600",
  Malls: "bg-violet-50 text-violet-600",
  Bills: "bg-purple-50 text-purple-600",
  Subscriptions: "bg-fuchsia-50 text-fuchsia-600",
  Rent: "bg-slate-100 text-slate-600",
  Health: "bg-teal-50 text-teal-600",
  Entertainment: "bg-sky-50 text-sky-600",
  "Cash Withdrawal": "bg-slate-100 text-slate-600",
  "Bank Transfer": "bg-slate-100 text-slate-600",
  "Salary / Income": "bg-emerald-50 text-emerald-600",
  Other: "bg-slate-100 text-slate-600"
};

export const merchantLogoDomains = [
  { keywords: ["qnb"], domain: "qnb.com" },
  { keywords: ["doha bank", "dobank"], domain: "dohabank.com.qa" },
  { keywords: ["dukhan bank"], domain: "dukhanbank.com" },
  { keywords: ["qatar university", "mens campus", "men''s campus", "men campus"], domain: "qu.edu.qa" },
  { keywords: ["reverse", "reversal", "refund"], domain: "dohabank.com.qa" },
  { keywords: ["carrefour"], domain: "carrefour.com" },
  { keywords: ["talabat"], domain: "talabat.com" },
  { keywords: ["lulu", "lulu hypermarket"], domain: "luluhypermarket.com" },
  { keywords: ["uber"], domain: "uber.com" },
  { keywords: ["netflix"], domain: "netflix.com" },
  { keywords: ["apple"], domain: "apple.com" },
  { keywords: ["amazon"], domain: "amazon.com" },
  { keywords: ["ooredoo"], domain: "ooredoo.qa" },
  { keywords: ["vodafone"], domain: "vodafone.qa" },
  { keywords: ["snoonu"], domain: "snoonu.com" },
  { keywords: ["monoprix"], domain: "monoprix.qa" },
  { keywords: ["woqod", "waqood", "petroleum", "petrol", "fuel"], domain: "woqod.com" },
  { keywords: ["tea time", "teatime", "team time"], domain: "teatime.qa" },
  { keywords: ["max fashion", "max"], domain: "maxfashion.com" },
  { keywords: ["new yorker", "newyorker"], domain: "newyorker.de" },
  { keywords: ["temu"], domain: "temu.com" },
  { keywords: ["karak mqanes", "mqanes"], domain: "karakmqanes.com" },
  { keywords: ["food world"], domain: "foodworldqatar.com" },
  { keywords: ["indian super market", "indian supermarket"], domain: "indiansupermarketqatar.com" },
  { keywords: ["eat time", "eattime", "eat time dukhan"], domain: "teatime.qa" },
  { keywords: ["jawahar"], domain: "jawaharrestaurant.com" },
  { keywords: ["starbucks"], domain: "starbucks.com" },
  { keywords: ["mcdonald"], domain: "mcdonalds.com" },
  { keywords: ["spotify"], domain: "spotify.com" },
  { keywords: ["youtube"], domain: "youtube.com" }
] as const;
