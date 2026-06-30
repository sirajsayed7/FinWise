import type { SpendingPeriod } from "@/lib/dashboard-types";

export const periods: SpendingPeriod[] = ["This Month", "Last Month", "Year"];

export const categoryColors: Record<string, string> = {
  Groceries:             "#10B981",
  "Ordering Out":        "#F97316",
  "Restaurants & Cafes": "#FB923C",
  Transport:             "#06B6D4",
  Fuel:                  "#F59E0B",
  Shopping:              "#3B82F6",
  Malls:                 "#7C3AED",
  Bills:                 "#8B5CF6",
  Subscriptions:         "#D946EF",
  Rent:                  "#64748B",
  Health:                "#14B8A6",
  Entertainment:         "#38BDF8",
  "Cash Withdrawal":     "#94A3B8",
  "Bank Transfer":       "#64748B",
  "Salary / Income":     "#34D399",
  Other:                 "#475569"
};

export const categoryAvatarStyles: Record<string, string> = {
  Groceries:             "bg-emerald-500/20 text-emerald-400",
  "Ordering Out":        "bg-orange-500/20 text-orange-400",
  "Restaurants & Cafes": "bg-orange-500/20 text-orange-400",
  Transport:             "bg-cyan-500/20 text-cyan-400",
  Fuel:                  "bg-amber-500/20 text-amber-400",
  Shopping:              "bg-blue-500/20 text-blue-400",
  Malls:                 "bg-violet-500/20 text-violet-400",
  Bills:                 "bg-purple-500/20 text-purple-400",
  Subscriptions:         "bg-fuchsia-500/20 text-fuchsia-400",
  Rent:                  "bg-slate-600/40 text-slate-300",
  Health:                "bg-teal-500/20 text-teal-400",
  Entertainment:         "bg-sky-500/20 text-sky-400",
  "Cash Withdrawal":     "bg-slate-600/40 text-slate-300",
  "Bank Transfer":       "bg-slate-600/40 text-slate-300",
  "Salary / Income":     "bg-emerald-500/20 text-emerald-400",
  Other:                 "bg-slate-600/40 text-slate-300"
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
