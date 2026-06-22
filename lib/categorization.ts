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
  { pattern: "qnb", category: "Bank Transfer" },
  { pattern: "doha bank", category: "Bank Transfer" },
  { pattern: "dukhan bank", category: "Bank Transfer" },
  { pattern: "carrefour", category: "Groceries" },
  { pattern: "lulu", category: "Groceries" },
  { pattern: "lulu hypermarket", category: "Groceries" },
  { pattern: "monoprix", category: "Groceries" },
  { pattern: "al meera", category: "Groceries" },
  { pattern: "indian super market", category: "Groceries" },
  { pattern: "indian supermarket", category: "Groceries" },
  { pattern: "spar", category: "Groceries" },
  { pattern: "hypermarket", category: "Groceries" },
  { pattern: "supermarket", category: "Groceries" },
  { pattern: "talabat", category: "Ordering Out" },
  { pattern: "snoonu", category: "Ordering Out" },
  { pattern: "rafeeq", category: "Ordering Out" },
  { pattern: "delivery hero", category: "Ordering Out" },
  { pattern: "food world", category: "Groceries" },
  { pattern: "eat time", category: "Restaurants & Cafes" },
  { pattern: "eattime", category: "Restaurants & Cafes" },
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
  { pattern: "waqood", category: "Fuel" },
  { pattern: "petroleum", category: "Fuel" },
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
  { pattern: "temu", category: "Shopping" },
  { pattern: "max fashion", category: "Shopping" },
  { pattern: "new yorker", category: "Shopping" },
  { pattern: "shein", category: "Shopping" },
  { pattern: "zara", category: "Shopping" },
  { pattern: "hm", category: "Shopping" },
  { pattern: "mall", category: "Malls" },
  { pattern: "festival city", category: "Malls" },
  { pattern: "villaggio", category: "Malls" },
  { pattern: "city center", category: "Malls" },
  { pattern: "qatar university", category: "Other" },
  { pattern: "mens campus", category: "Other" },
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
  const cleaned = description
    .replace(/\b(pos|card|purchase|payment|debit|credit|qatar|doha|qa|visa|mastercard|naps|online|terminal|ref|auth|txn)\b/gi, " ")
    .replace(/[0-9*#:_/\\-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
  return cleaned || description.trim().toUpperCase();
}

export function categorizeMerchant(description: string, userRules: MerchantRule[] = [], direction: TransactionDirection = "expense"): CategorizationResult {
  const haystack = description.toLowerCase();
  const normalizedHaystack = normalizeForMatch(description);
  const userMatch = findRuleMatch(normalizedHaystack, userRules);
  const salaryMatch = direction === "income" && /\b(salary|payroll|wage|bonus|allowance)\b/.test(haystack)
    ? ({ pattern: "salary", category: "Salary / Income" } as MerchantRule)
    : undefined;
  const incomeMatch = direction === "income" && /\b(transfer|inward|deposit|fawran)\b/.test(haystack)
    ? ({ pattern: "income transfer", category: "Bank Transfer" } as MerchantRule)
    : direction === "income" && /\b(reversal|refund|cashback)\b/.test(haystack)
      ? ({ pattern: "income reversal", category: "Other" } as MerchantRule)
      : undefined;
  const defaultMatch = salaryMatch ?? incomeMatch ?? findRuleMatch(normalizedHaystack, defaultRules);
  const match = userMatch ?? defaultMatch;

  if (match) {
    const confidence = getRuleConfidence(normalizedHaystack, match.pattern, userMatch ? 0.98 : 0.93);
    return {
      merchant: cleanMerchant(description),
      category: match.category,
      subcategory: match.category,
      transactionType: direction,
      confidence,
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

function findRuleMatch(haystack: string, rules: MerchantRule[]) {
  return rules
    .map((rule) => ({ rule, score: getRuleScore(haystack, rule.pattern) }))
    .filter((item) => item.score >= 0.72)
    .sort((left, right) => right.score - left.score || right.rule.pattern.length - left.rule.pattern.length)[0]?.rule;
}

function getRuleConfidence(haystack: string, pattern: string, base: number) {
  const score = getRuleScore(haystack, pattern);
  return Math.min(0.99, Math.max(0.78, Number((base * score).toFixed(2))));
}

function getRuleScore(haystack: string, pattern: string) {
  const normalizedPattern = normalizeForMatch(pattern);
  if (!normalizedPattern) return 0;
  if (haystack.includes(normalizedPattern)) return 1;

  const patternTokens = normalizedPattern.split(" ").filter((token) => token.length > 1);
  if (!patternTokens.length) return 0;
  const matchedTokens = patternTokens.filter((token) => haystack.includes(token)).length;
  const tokenScore = matchedTokens / patternTokens.length;
  const compactHaystack = haystack.replace(/\s+/g, "");
  const compactPattern = normalizedPattern.replace(/\s+/g, "");
  const compactScore = compactHaystack.includes(compactPattern) ? 0.95 : 0;
  return Math.max(tokenScore, compactScore);
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(pos|card|purchase|payment|debit|credit|qa|qatar|doha|visa|mastercard|naps|online|terminal|ref|auth|txn)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
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
