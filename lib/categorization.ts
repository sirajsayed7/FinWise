import type { CategorizationResult, CategoryName, MerchantRule, TransactionDirection } from "@/lib/types";

export const categories: CategoryName[] = [
  "Groceries",
  "Ordering Out",
  "Restaurants & Cafes",
  "Transport",
  "Fuel",
  "Shopping",
  "Malls",
  "Bills",
  "Subscriptions",
  "Rent",
  "Health",
  "Entertainment",
  "Cash Withdrawal",
  "Bank Transfer",
  "Salary / Income",
  "Other"
];

export const defaultRules: MerchantRule[] = [
  { pattern: "carrefour", category: "Groceries" },
  { pattern: "lulu", category: "Groceries" },
  { pattern: "monoprix", category: "Groceries" },
  { pattern: "al meera", category: "Groceries" },
  { pattern: "spar", category: "Groceries" },
  { pattern: "hypermarket", category: "Groceries" },
  { pattern: "supermarket", category: "Groceries" },
  { pattern: "talabat", category: "Ordering Out" },
  { pattern: "snoonu", category: "Ordering Out" },
  { pattern: "rafeeq", category: "Ordering Out" },
  { pattern: "delivery hero", category: "Ordering Out" },
  { pattern: "food world", category: "Groceries" },
  { pattern: "restaurant", category: "Restaurants & Cafes" },
  { pattern: "cafe", category: "Restaurants & Cafes" },
  { pattern: "coffee", category: "Restaurants & Cafes" },
  { pattern: "karak", category: "Restaurants & Cafes" },
  { pattern: "tea time", category: "Restaurants & Cafes" },
  { pattern: "jawahar", category: "Restaurants & Cafes" },
  { pattern: "starbucks", category: "Restaurants & Cafes" },
  { pattern: "mcdonald", category: "Restaurants & Cafes" },
  { pattern: "uber", category: "Transport" },
  { pattern: "karwa", category: "Transport" },
  { pattern: "taxi", category: "Transport" },
  { pattern: "metro", category: "Transport" },
  { pattern: "woqod", category: "Fuel" },
  { pattern: "fuel", category: "Fuel" },
  { pattern: "petrol", category: "Fuel" },
  { pattern: "vodafone", category: "Bills" },
  { pattern: "ooredoo", category: "Bills" },
  { pattern: "kahramaa", category: "Bills" },
  { pattern: "qatar cool", category: "Bills" },
  { pattern: "apple.com", category: "Subscriptions" },
  { pattern: "apple services", category: "Subscriptions" },
  { pattern: "netflix", category: "Subscriptions" },
  { pattern: "spotify", category: "Subscriptions" },
  { pattern: "youtube", category: "Subscriptions" },
  { pattern: "icloud", category: "Subscriptions" },
  { pattern: "amazon", category: "Shopping" },
  { pattern: "shein", category: "Shopping" },
  { pattern: "zara", category: "Shopping" },
  { pattern: "hm", category: "Shopping" },
  { pattern: "mall", category: "Malls" },
  { pattern: "festival city", category: "Malls" },
  { pattern: "villaggio", category: "Malls" },
  { pattern: "city center", category: "Malls" },
  { pattern: "rent", category: "Rent" },
  { pattern: "cinema", category: "Entertainment" },
  { pattern: "novo", category: "Entertainment" },
  { pattern: "vox", category: "Entertainment" },
  { pattern: "pharmacy", category: "Health" },
  { pattern: "clinic", category: "Health" },
  { pattern: "hospital", category: "Health" },
  { pattern: "atm", category: "Cash Withdrawal" },
  { pattern: "cash withdrawal", category: "Cash Withdrawal" },
  { pattern: "transfer", category: "Bank Transfer" },
  { pattern: "fawran", category: "Bank Transfer" },
  { pattern: "standing order", category: "Bank Transfer" },
  { pattern: "iban", category: "Bank Transfer" },
  { pattern: "salary", category: "Salary / Income" }
];

export function cleanMerchant(description: string) {
  return description
    .replace(/\b(pos|card|purchase|payment|debit|credit|qatar|doha)\b/gi, " ")
    .replace(/[0-9*#:_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

export function categorizeMerchant(description: string, userRules: MerchantRule[] = [], direction: TransactionDirection = "expense"): CategorizationResult {
  const haystack = description.toLowerCase();
  const userMatch = userRules.find((rule) => haystack.includes(rule.pattern.toLowerCase()));
  const salaryMatch = direction === "income" && /\b(salary|payroll|wage|bonus|allowance)\b/.test(haystack)
    ? ({ pattern: "salary", category: "Salary / Income" } as MerchantRule)
    : undefined;
  const incomeMatch = direction === "income" && /\b(transfer|inward|deposit|fawran)\b/.test(haystack)
    ? ({ pattern: "income transfer", category: "Bank Transfer" } as MerchantRule)
    : direction === "income" && /\b(reversal|refund|cashback)\b/.test(haystack)
      ? ({ pattern: "income reversal", category: "Other" } as MerchantRule)
      : undefined;
  const defaultMatch = salaryMatch ?? incomeMatch ?? defaultRules.find((rule) => haystack.includes(rule.pattern.toLowerCase()));
  const match = userMatch ?? defaultMatch;

  if (match) {
    return {
      merchant: cleanMerchant(description),
      category: match.category,
      subcategory: match.category,
      transactionType: direction,
      confidence: match.pattern.length > 6 ? 0.95 : 0.88,
      reason: `Matched merchant rule "${match.pattern}".`,
      source: userMatch ? "user_rule" : "default_rule"
    };
  }

  const inferred = inferCategory(haystack, direction);
  if (inferred) {
    return {
      merchant: cleanMerchant(description),
      category: inferred.category,
      subcategory: inferred.subcategory,
      transactionType: direction,
      confidence: inferred.confidence,
      reason: inferred.reason,
      source: "fallback"
    };
  }

  return {
    merchant: cleanMerchant(description),
    category: direction === "income" ? "Salary / Income" : ("Other" as CategoryName),
    subcategory: direction === "income" ? "Income" : "Uncategorized",
    transactionType: direction,
    confidence: direction === "income" ? 0.76 : 0.42,
    reason: direction === "income" ? "Incoming transaction without a specific merchant rule." : "No saved or default merchant rule matched.",
    source: "fallback"
  };
}

function inferCategory(haystack: string, direction: TransactionDirection): { category: CategoryName; subcategory: string; confidence: number; reason: string } | null {
  if (direction === "income") {
    if (/\b(salary|payroll|wage|bonus|allowance)\b/.test(haystack)) return { category: "Salary / Income", subcategory: "Salary", confidence: 0.9, reason: "Income wording suggests salary or payroll." };
    if (/\b(refund|reversal|cashback)\b/.test(haystack)) return { category: "Other", subcategory: "Refund", confidence: 0.7, reason: "Incoming refund-like transaction." };
    return { category: "Salary / Income", subcategory: "Income", confidence: 0.76, reason: "Incoming transaction classified as income." };
  }

  if (/\b(pos|purchase|card)\b/.test(haystack) && /\b(mall|store|shop|retail)\b/.test(haystack)) return { category: "Shopping", subcategory: "Retail", confidence: 0.68, reason: "Retail purchase wording detected." };
  if (/\b(transfer|beneficiary|remittance)\b/.test(haystack)) return { category: "Bank Transfer", subcategory: "Transfer", confidence: 0.72, reason: "Transfer wording detected." };
  if (/\b(doctor|medical|dental|pharma)\b/.test(haystack)) return { category: "Health", subcategory: "Medical", confidence: 0.72, reason: "Health-related wording detected." };
  if (/\b(subscription|monthly|recurring)\b/.test(haystack)) return { category: "Subscriptions", subcategory: "Recurring", confidence: 0.7, reason: "Recurring payment wording detected." };

  return null;
}
