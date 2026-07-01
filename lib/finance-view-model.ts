import type { User } from "@supabase/supabase-js";
import { categories } from "@/lib/categorization";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/storage";
import { categoryColors } from "@/lib/dashboard-constants";
import type { SpendingPeriod, StatementPeriodInfo, StatementSummary } from "@/lib/dashboard-types";
import type { MerchantRule, SpendingRow, Transaction } from "@/lib/types";

export function getSummary(transactions: Transaction[]) {
  const income = transactions
    .filter((row) => row.direction === "income")
    .reduce((sum, row) => sum + row.amount, 0);
  const expenses = transactions
    .filter((row) => row.direction === "expense")
    .reduce((sum, row) => sum + row.amount, 0);
  return { income, expenses, net: income - expenses, balance: income - expenses };
}

export function getReviewRows(transactions: Transaction[]) {
  return transactions
    .filter(isReviewTransaction)
    .sort((left, right) => left.confidence - right.confidence || right.date.localeCompare(left.date));
}

export function getReviewStats(transactions: Transaction[]) {
  const needsReview = getReviewRows(transactions).length;
  const categorized = transactions.filter(
    (transaction) => transaction.category !== "Other" && !isReviewTransaction(transaction)
  ).length;
  return {
    needsReview,
    categorizedPercent: transactions.length ? Math.round((categorized / transactions.length) * 100) : 0,
    ruleCount: getStoredMerchantRules().length
  };
}

export function isReviewTransaction(transaction: Transaction) {
  if (isUserResolvedTransaction(transaction)) return false;
  const merchantLooksMessy =
    transaction.merchant.length < 3
    || /\b(unknown|payment|purchase|transaction|pos|card)\b/i.test(transaction.merchant)
    || /\d{5,}/.test(transaction.merchant);
  return transaction.needsReview
    || transaction.confidence < 0.75
    || transaction.category === "Other"
    || merchantLooksMessy;
}

export function isUserResolvedTransaction(transaction: Transaction) {
  return transaction.categorySource === "user_rule" && !transaction.needsReview;
}

export function applyMerchantCorrection(
  transactions: Transaction[],
  edited: Transaction,
  category: Transaction["category"],
  savedPattern?: string
) {
  return transactions.map((row) => {
    if (!shouldApplyMerchantCorrection(row, edited, savedPattern)) return row;
    return {
      ...row,
      category,
      subcategory: category,
      confidence: 1,
      needsReview: false,
      categorySource: "user_rule" as const,
      reason: `Saved merchant rule for "${edited.merchant}".`
    };
  });
}

export function applySingleTransactionCorrection(
  transactions: Transaction[],
  edited: Transaction,
  category: Transaction["category"]
) {
  return transactions.map((row) =>
    row.id === edited.id
      ? {
          ...row,
          category,
          subcategory: category,
          confidence: 1,
          needsReview: false,
          categorySource: "user_rule" as const,
          reason: `Manually corrected "${edited.merchant}".`
        }
      : row
  );
}

export function shouldApplyMerchantCorrection(row: Transaction, edited: Transaction, savedPattern?: string) {
  const rowMerchant = normalizeMerchantKey(row.merchant);
  const editedMerchant = normalizeMerchantKey(edited.merchant);
  if (!rowMerchant || !editedMerchant) return row.id === edited.id;
  const pattern = savedPattern ? normalizeMerchantKey(savedPattern) : "";
  return row.id === edited.id
    || rowMerchant === editedMerchant
    || rowMerchant.includes(editedMerchant)
    || editedMerchant.includes(rowMerchant)
    || Boolean(pattern && (rowMerchant.includes(pattern) || pattern.includes(rowMerchant)));
}

export function getReviewReason(transaction: Transaction) {
  if (transaction.category === "Other") {
    return "Category is Other, so this needs a real category before FinWise can learn it.";
  }
  if (transaction.confidence < 0.75) {
    return `Low confidence: ${Math.round(transaction.confidence * 100)}%. Confirm the category once to save a merchant rule.`;
  }
  if (transaction.needsReview) {
    return transaction.reason || "Marked for manual review by the statement parser.";
  }
  return "Merchant text looks unusual. Confirm the category once to prevent future reviews.";
}

export function normalizeMerchantKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

export function getSpendingRows(transactions: Transaction[], period: SpendingPeriod): SpendingRow[] {
  const rows = filterByPeriod(transactions, period).filter((row) => row.direction === "expense");
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount));
  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label: label === "Ordering Out" ? "Dining Out" : label,
      amount,
      percent: total ? Number(((amount / total) * 100).toFixed(1)) : 0,
      color: categoryColors[label] ?? categoryColors.Other
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);
}

export function getInsightCategories(transactions: Transaction[], period: SpendingPeriod) {
  return getSpendingRows(transactions, period).map((row) => ({
    ...row,
    label: row.label === "Dining Out" ? "Ordering Out" : row.label
  }));
}

export function getAllCategoryRows(transactions: Transaction[]) {
  const rows = transactions.filter((row) => row.direction === "expense");
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const label = normalizeCategoryLabel(row.category);
    totals.set(label, (totals.get(label) ?? 0) + row.amount);
  });
  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      percent: total ? Number(((amount / total) * 100).toFixed(1)) : 0,
      color: categoryColors[label] ?? categoryColors.Other
    }))
    .sort((left, right) => right.amount - left.amount);
}

export function getMerchantInsights(transactions: Transaction[], period: SpendingPeriod) {
  const currentRows = filterByPeriod(transactions, period).filter((row) => row.direction === "expense");
  const previousMonth = getPreviousPeriodMonth(transactions, period);
  const previousRows = previousMonth
    ? transactions.filter((row) => row.direction === "expense" && row.date.startsWith(previousMonth))
    : [];

  const totals = new Map<string, number>();
  currentRows.forEach((row) => totals.set(row.merchant, (totals.get(row.merchant) ?? 0) + row.amount));
  const previousTotals = new Map<string, number>();
  previousRows.forEach((row) =>
    previousTotals.set(row.merchant, (previousTotals.get(row.merchant) ?? 0) + row.amount)
  );

  return Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([merchant, amount]) => {
      const count = currentRows.filter((row) => row.merchant === merchant).length;
      const trend = getMerchantTrend(amount, previousTotals.get(merchant), Boolean(previousMonth));
      return {
        merchant: toTitle(merchant),
        amount,
        count,
        color: "bg-violet-50 text-violet-600",
        ...trend
      };
    });
}

export function getAllMerchantRows(transactions: Transaction[]) {
  const totals = new Map<string, { amount: number; count: number }>();
  transactions.filter((row) => row.direction === "expense").forEach((row) => {
    const merchant = toTitle(row.merchant);
    const current = totals.get(merchant) ?? { amount: 0, count: 0 };
    totals.set(merchant, { amount: current.amount + row.amount, count: current.count + 1 });
  });
  return Array.from(totals.entries())
    .map(([merchant, value]) => ({ merchant, amount: value.amount, count: value.count }))
    .sort((left, right) => right.amount - left.amount);
}

export function buildTrendRows(transactions: Transaction[], period: SpendingPeriod) {
  const expenseRows = transactions.filter((row) => row.direction === "expense");
  if (!expenseRows.length) return [];

  if (period === "Year") {
    const totalsByMonth = new Map<string, number>();
    expenseRows.forEach((row) => {
      const month = row.date.slice(0, 7);
      totalsByMonth.set(month, (totalsByMonth.get(month) ?? 0) + row.amount);
    });
    return Array.from(totalsByMonth.entries())
      .sort(([left], [right]) => left.localeCompare(right))
      .slice(-12)
      .map(([month, amount]) => ({ date: getShortMonthYear(month), amount }));
  }

  const month = getPeriodMonth(transactions, period);
  if (!month) return [];
  const monthRows = expenseRows.filter((row) => row.date.startsWith(month));
  if (!monthRows.length) return [];

  return [1, 8, 15, 22, 30].map((day) => ({
    date: `${getShortMonth(month)} ${day}`,
    amount: monthRows
      .filter((row) => Number(row.date.slice(8, 10)) <= day)
      .reduce((sum, row) => sum + row.amount, 0)
  }));
}

export function getPeriodComparison(transactions: Transaction[], period: SpendingPeriod) {
  if (period === "Year") return { percentChange: null as number | null, hasData: false };
  const currentMonth = getPeriodMonth(transactions, period);
  const previousMonth = getPreviousPeriodMonth(transactions, period);
  if (!currentMonth || !previousMonth) return { percentChange: null as number | null, hasData: false };

  const currentTotal = transactions
    .filter((row) => row.direction === "expense" && row.date.startsWith(currentMonth))
    .reduce((sum, row) => sum + row.amount, 0);
  const previousTotal = transactions
    .filter((row) => row.direction === "expense" && row.date.startsWith(previousMonth))
    .reduce((sum, row) => sum + row.amount, 0);
  if (!previousTotal) return { percentChange: null as number | null, hasData: false };
  return { percentChange: ((currentTotal - previousTotal) / previousTotal) * 100, hasData: true };
}

export function getFlexibleSavingsOpportunity(transactions: Transaction[], period: SpendingPeriod) {
  const rows = getAllCategoryRows(filterByPeriod(transactions, period));
  const orderingOut = rows.find((row) => row.label === "Ordering Out" || row.label === "Dining Out")?.amount ?? 0;
  const shopping = rows.find((row) => row.label === "Shopping")?.amount ?? 0;
  const subscriptions = rows.find((row) => row.label === "Subscriptions")?.amount ?? 0;
  const flexibleSpend = orderingOut + shopping + subscriptions;
  return { amount: Math.max(0, flexibleSpend * 0.12), hasEnoughData: flexibleSpend > 0 };
}

export function getRecommendations(transactions: Transaction[], period: SpendingPeriod) {
  const periodRows = filterByPeriod(transactions, period);
  const categoryRows = getAllCategoryRows(periodRows);
  const orderingOut = categoryRows.find((row) => row.label === "Ordering Out" || row.label === "Dining Out");
  const subscriptions = categoryRows.find((row) => row.label === "Subscriptions");
  const groceries = categoryRows.find((row) => row.label === "Groceries");
  const subscriptionMerchantCount = new Set(
    periodRows
      .filter((row) => row.direction === "expense" && row.category === "Subscriptions")
      .map((row) => row.merchant.toLowerCase())
  ).size;
  const recommendations: { id: string; title: string; body: string }[] = [];

  if (orderingOut?.amount) {
    recommendations.push({
      id: "Reduce Food Delivery",
      title: "Reduce Food Delivery",
      body: `You''ve spent QAR ${formatAmount(orderingOut.amount)} ordering out this period. Cutting back could save up to QAR ${formatAmount(orderingOut.amount * 0.14)}.`
    });
  }
  if (subscriptions?.amount) {
    recommendations.push({
      id: "Review Subscriptions",
      title: "Review Subscriptions",
      body: `You''re paying QAR ${formatAmount(subscriptions.amount)} across ${subscriptionMerchantCount} subscription merchant${subscriptionMerchantCount === 1 ? "" : "s"}. Review any you no longer use.`
    });
  }
  if (groceries?.amount) {
    recommendations.push({
      id: "Set a Grocery Budget",
      title: "Set a Grocery Budget",
      body: `You''ve spent QAR ${formatAmount(groceries.amount)} on groceries this period. Try setting a monthly limit around QAR ${formatAmount(groceries.amount * 0.9)}.`
    });
  }
  return recommendations;
}

export function groupTransactionsByMonth(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  [...transactions].sort((left, right) => right.date.localeCompare(left.date)).forEach((transaction) => {
    const month = getMonthLabel(transaction.date);
    groups.set(month, [...(groups.get(month) ?? []), transaction]);
  });
  return Array.from(groups.entries()).map(([month, rows]) => ({ month, count: rows.length, rows }));
}

export function getStatementSummaries(
  transactions: Transaction[],
  latestPeriod: StatementPeriodInfo | null
): StatementSummary[] {
  if (!transactions.length) return [];
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const id = transaction.statementId ?? `legacy:${transaction.date.slice(0, 7)}`;
    groups.set(id, [...(groups.get(id) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .map(([id, rows]) => {
      const sortedDates = rows.map((row) => row.date).sort();
      const totalIncome = rows
        .filter((row) => row.direction === "income")
        .reduce((sum, row) => sum + row.amount, 0);
      const totalExpenses = rows
        .filter((row) => row.direction === "expense")
        .reduce((sum, row) => sum + row.amount, 0);
      const period = getPeriodFromRows(rows, latestPeriod);
      const needsReview = rows.filter((row) => row.needsReview || row.confidence < 0.75).length;
      return {
        id,
        fileName: rows[0]?.statementFileName ?? `${getMonthLabel(sortedDates[0] ?? rows[0]?.date)} statement`,
        bank: rows[0]?.bank ?? "Unknown Bank",
        status: needsReview ? "review" : "processed",
        uploadedAt: rows[0]?.statementUploadedAt ?? `${sortedDates.at(-1) ?? rows[0]?.date}T00:00:00.000Z`,
        transactionCount: rows.length,
        totalIncome,
        totalExpenses,
        period,
        needsReview
      } satisfies StatementSummary;
    })
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

export function getLatestPeriodFromTransactions(transactions: Transaction[]) {
  return getStatementSummaries(transactions, null)[0]?.period ?? null;
}

export function filterByPeriod(transactions: Transaction[], period: SpendingPeriod) {
  const sorted = [...transactions].sort((left, right) => right.date.localeCompare(left.date));
  const currentMonth = sorted[0]?.date.slice(0, 7);
  if (!currentMonth || period === "Year") return transactions;
  if (period === "This Month") return transactions.filter((row) => row.date.startsWith(currentMonth));
  const date = new Date(`${currentMonth}-01T00:00:00`);
  date.setMonth(date.getMonth() - 1);
  const lastMonth = date.toISOString().slice(0, 7);
  return transactions.filter((row) => row.date.startsWith(lastMonth));
}

export function getMonthLabel(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Imported";
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

export function formatMonthRange(transactions: Transaction[]) {
  if (!transactions.length) return "No statements yet";
  const sorted = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  return `${getMonthLabel(sorted[0].date)} - ${getMonthLabel(sorted[sorted.length - 1].date)}`;
}

export function getDateRange(transactions: Transaction[]) {
  if (!transactions.length) return "No transactions";
  const sorted = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  return `${sorted[0].date} to ${sorted[sorted.length - 1].date}`;
}

export function normalizeCategoryLabel(category: string) {
  return category === "Ordering Out" ? "Dining Out" : category;
}

export function categoryTitleMatches(title: string, label: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  if (normalizedTitle.includes(normalizedLabel)) return true;
  if (label === "Dining Out" && normalizedTitle.includes("ordering out")) return true;
  if (label === "Ordering Out" && normalizedTitle.includes("dining out")) return true;
  return false;
}

export function formatPeriodDates(period: StatementPeriodInfo) {
  if (!period.startDate || !period.endDate) return "Unknown dates";
  return `${period.startDate} to ${period.endDate}`;
}

export function saveMerchantRule(transaction: Transaction, category: Transaction["category"]) {
  const pattern = normalizeMerchantKey(transaction.merchant);
  if (!pattern) return null;
  const savedRule = { pattern, merchant: transaction.merchant, category, subcategory: category };
  try {
    const current = JSON.parse(safeLocalStorageGet("finwise.merchantRules", "[]") ?? "[]") as MerchantRule[];
    const next = [savedRule, ...current.filter((rule) => rule.pattern !== pattern)];
    safeLocalStorageSet("finwise.merchantRules", JSON.stringify(next.slice(0, 200)));
  } catch {
    safeLocalStorageSet("finwise.merchantRules", JSON.stringify([savedRule]));
  }
  return savedRule;
}

export function getStoredMerchantRules(): MerchantRule[] {
  if (typeof window === "undefined") return [];
  try {
    const parsed = JSON.parse(safeLocalStorageGet("finwise.merchantRules", "[]") ?? "[]") as MerchantRule[];
    return Array.isArray(parsed)
      ? parsed.filter((rule) => typeof rule.pattern === "string" && categories.includes(rule.category))
      : [];
  } catch {
    return [];
  }
}

export function mergeMerchantRules(primary: MerchantRule[], fallback: MerchantRule[]) {
  const seen = new Set<string>();
  return [...primary, ...fallback].filter((rule) => {
    const key = normalizeMerchantKey(rule.pattern);
    if (!key || seen.has(key) || !categories.includes(rule.category)) return false;
    seen.add(key);
    return true;
  });
}

export function applySavedMerchantRules(
  transactions: Transaction[],
  rules: MerchantRule[] = getStoredMerchantRules()
) {
  if (!rules.length || !transactions.length) return transactions;
  const sortedRules = [...rules]
    .filter((rule) => rule.pattern && categories.includes(rule.category))
    .sort((left, right) => right.pattern.length - left.pattern.length);

  return transactions.map((transaction) => {
    if (isUserResolvedTransaction(transaction)) return transaction;
    const haystack = normalizeMerchantKey(`${transaction.merchant} ${transaction.descriptionRaw}`);
    const match = sortedRules.find((rule) => {
      const pattern = normalizeMerchantKey(rule.pattern);
      return pattern
        && (haystack.includes(pattern) || pattern.includes(normalizeMerchantKey(transaction.merchant)));
    });
    if (!match) return transaction;
    return {
      ...transaction,
      category: match.category,
      subcategory: match.subcategory ?? match.category,
      confidence: Math.max(transaction.confidence, 0.98),
      needsReview: false,
      categorySource: "user_rule" as const,
      reason: `Applied saved merchant rule "${match.pattern}".`
    };
  });
}

export function dedupe(transactions: Transaction[]) {
  const seen = new Set<string>();
  return transactions.filter((transaction) => {
    const key = transaction.duplicateHash
      || [transaction.date, transaction.descriptionRaw, transaction.amount, transaction.direction, transaction.bank].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function sanitizeTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => {
    const amountIsValid = Number.isFinite(transaction.amount)
      && transaction.amount > 0
      && transaction.amount < 1_000_000;
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(transaction.date);
    const merchantIsValid = transaction.merchant.trim().length > 0;
    const descriptionIsValid = !isBalanceLikeTransaction(transaction.descriptionRaw)
      && !isBalanceLikeTransaction(transaction.merchant);
    return amountIsValid && dateIsValid && merchantIsValid && descriptionIsValid;
  });
}

export function getUserDisplayName(user: User | null) {
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const metadataName = metadata?.full_name || metadata?.name;
  if (metadataName?.trim()) return toTitle(metadataName.trim().split(/\s+/)[0]);
  const emailName = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ");
  if (emailName?.trim()) return toTitle(emailName.trim().split(/\s+/)[0]);
  return "there";
}

export function formatAmount(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function formatDisplayAmount(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return formatAmount(value);
}

export function formatCompact(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return formatAmount(value);
}

export function toTitle(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMerchantTrend(amount: number, previousAmount: number | undefined, hasComparisonData: boolean) {
  if (!hasComparisonData) {
    return { change: undefined as string | undefined, up: undefined as boolean | undefined, isNew: false };
  }
  if (previousAmount === undefined || previousAmount === 0) {
    return { change: "New", up: undefined as boolean | undefined, isNew: true };
  }
  const delta = ((amount - previousAmount) / previousAmount) * 100;
  return { change: `${delta >= 0 ? "+" : ""}${delta.toFixed(0)}%`, up: delta >= 0, isNew: false };
}

function getAnchorMonth(transactions: Transaction[]) {
  if (!transactions.length) return null;
  return [...transactions].sort((left, right) => right.date.localeCompare(left.date))[0].date.slice(0, 7);
}

function shiftMonth(month: string, delta: number) {
  const date = new Date(`${month}-01T00:00:00`);
  date.setMonth(date.getMonth() + delta);
  return date.toISOString().slice(0, 7);
}

function getPeriodMonth(transactions: Transaction[], period: SpendingPeriod): string | null {
  if (period === "Year") return null;
  const anchor = getAnchorMonth(transactions);
  if (!anchor) return null;
  return period === "This Month" ? anchor : shiftMonth(anchor, -1);
}

function getPreviousPeriodMonth(transactions: Transaction[], period: SpendingPeriod): string | null {
  if (period === "Year") return null;
  const anchor = getAnchorMonth(transactions);
  if (!anchor) return null;
  return period === "This Month" ? shiftMonth(anchor, -1) : shiftMonth(anchor, -2);
}

function getShortMonth(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", { month: "short" });
}

function getShortMonthYear(month: string) {
  return new Date(`${month}-01T00:00:00`).toLocaleDateString("en-US", {
    month: "short",
    year: "2-digit"
  });
}

function getPeriodFromRows(
  rows: Transaction[],
  fallback: StatementPeriodInfo | null
): StatementPeriodInfo {
  const sorted = rows.map((row) => row.date).sort();
  const startDate = sorted[0] ?? fallback?.startDate ?? null;
  const endDate = sorted.at(-1) ?? fallback?.endDate ?? null;
  const label = rows[0]?.statementPeriodLabel ?? fallback?.label ?? getMonthLabel(startDate ?? "");
  return {
    startDate,
    endDate,
    days: startDate && endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime())
              / 86400000
          ) + 1
        )
      : fallback?.days ?? 0,
    label
  };
}

function isBalanceLikeTransaction(value: string) {
  return /\b(opening balance|closing balance|available balance|current balance|ledger balance|running balance|brought forward|carried forward|total debit|total credit|statement period|account number|iban)\b/i.test(value);
}
