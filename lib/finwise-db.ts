import { getSupabase } from "@/lib/supabase-client";
import type { MerchantLogoRecord, MerchantRule, Transaction } from "@/lib/types";

type StatementPeriodInfo = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

export type FinWiseCloudData = {
  transactions: Transaction[];
  latest_period: StatementPeriodInfo | null;
  merchant_rules: MerchantRule[];
};

type LegacyCloudData = {
  transactions: Transaction[] | null;
  latest_period: StatementPeriodInfo | null;
  merchant_rules: MerchantRule[] | null;
};

type TransactionRow = {
  id: string;
  statement_id: string | null;
  date: string;
  bank: string;
  description_raw: string;
  merchant: string;
  amount: number;
  direction: Transaction["direction"];
  currency: string;
  category: Transaction["category"];
  subcategory: string;
  confidence: number;
  reason: string;
  needs_review: boolean;
  category_source: Transaction["categorySource"];
  duplicate_hash: string;
};

type StatementRow = {
  id: string;
  file_name: string;
  bank: string;
  currency: string;
  status: string;
  transaction_count: number;
  total_income: number;
  total_expenses: number;
  period_start: string | null;
  period_end: string | null;
  period_days: number;
  period_label: string;
  file_hash: string | null;
  blob_url: string | null;
  uploaded_at: string;
};

type MerchantLogoRow = {
  id?: string;
  merchant_key: string;
  merchant_name: string;
  logo_url: string;
  source: MerchantLogoRecord["source"];
  confidence: number;
};

export async function loadFinWiseData(userId: string): Promise<FinWiseCloudData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const [{ data: transactionRows, error: transactionsError }, { data: statementRows }, { data: ruleRows }] = await Promise.all([
      supabase
        .from("transactions")
        .select("id,statement_id,date,bank,description_raw,merchant,amount,direction,currency,category,subcategory,confidence,reason,needs_review,category_source,duplicate_hash")
        .eq("user_id", userId)
        .order("date", { ascending: false }),
      supabase
        .from("statements")
        .select("id,file_name,bank,currency,status,transaction_count,total_income,total_expenses,period_start,period_end,period_days,period_label,file_hash,blob_url,uploaded_at")
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("merchant_rules")
        .select("id,pattern,merchant,category,subcategory")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
    ]);

    if (transactionsError) throw transactionsError;

    const statementsById = new Map(((statementRows ?? []) as StatementRow[]).map((row) => [row.id, row]));
    const transactions = ((transactionRows ?? []) as TransactionRow[]).map((row) => rowToTransaction(row, statementsById.get(row.statement_id ?? "")));
    if (transactions.length) {
      return {
        transactions,
        latest_period: statementRows?.[0] ? rowToPeriod(statementRows[0] as StatementRow) : null,
        merchant_rules: ((ruleRows ?? []) as MerchantRule[]).map((rule) => ({
          id: rule.id,
          pattern: rule.pattern,
          merchant: rule.merchant,
          category: rule.category,
          subcategory: rule.subcategory
        }))
      };
    }
  } catch {
    // Normalized tables may not exist until the SQL migration is applied.
  }

  return loadLegacyData(userId);
}

export async function saveFinWiseData(userId: string, transactions: Transaction[], latestPeriod: StatementPeriodInfo | null, merchantRules: MerchantRule[]) {
  const supabase = getSupabase();
  if (!supabase) return false;

  const legacySaved = await saveLegacyData(userId, transactions, latestPeriod, merchantRules);

  try {
    if (!transactions.length) {
      await supabase.from("transactions").delete().eq("user_id", userId);
      await supabase.from("statements").delete().eq("user_id", userId);
      return legacySaved;
    }

    const statements = getStatementRows(userId, transactions, latestPeriod);
    await supabase.from("transactions").delete().eq("user_id", userId);
    await supabase.from("statements").delete().eq("user_id", userId);

    if (statements.length) {
      const { error: statementError } = await supabase.from("statements").upsert(statements, { onConflict: "user_id,id" });
      if (statementError) throw statementError;
    }

    const transactionRows = transactions.map((transaction) => transactionToRow(userId, transaction, transaction.statementId ?? statements[0]?.id ?? null));
    const { error: transactionError } = await supabase
      .from("transactions")
      .upsert(transactionRows, { onConflict: "user_id,id" });
    if (transactionError) throw transactionError;

    if (merchantRules.length) {
      const { error: rulesError } = await supabase.from("merchant_rules").upsert(
        merchantRules.map((rule) => ({
          user_id: userId,
          pattern: rule.pattern,
          merchant: rule.merchant ?? rule.pattern,
          category: rule.category,
          subcategory: rule.subcategory ?? rule.category
        })),
        { onConflict: "user_id,pattern" }
      );
      if (rulesError) throw rulesError;
    }
  } catch {
    return legacySaved;
  }

  return true;
}

export async function loadMerchantLogoOverrides(userId: string): Promise<MerchantLogoRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  try {
    const { data, error } = await supabase
      .from("merchant_logos")
      .select("id,merchant_key,merchant_name,logo_url,source,confidence")
      .eq("user_id", userId)
      .order("updated_at", { ascending: false });

    if (error) throw error;
    return ((data ?? []) as MerchantLogoRow[]).map((row) => ({
      id: row.id,
      merchantKey: row.merchant_key,
      merchantName: row.merchant_name,
      logoUrl: row.logo_url,
      source: row.source,
      confidence: Number(row.confidence)
    }));
  } catch {
    return [];
  }
}

export async function saveMerchantLogoOverrides(userId: string, logos: MerchantLogoRecord[]) {
  const supabase = getSupabase();
  if (!supabase || !logos.length) return false;

  try {
    const { error } = await supabase.from("merchant_logos").upsert(
      logos.map((logo) => ({
        user_id: userId,
        merchant_key: logo.merchantKey,
        merchant_name: logo.merchantName,
        logo_url: logo.logoUrl,
        source: logo.source,
        confidence: logo.confidence
      })),
      { onConflict: "user_id,merchant_key" }
    );

    return !error;
  } catch {
    return false;
  }
}

async function loadLegacyData(userId: string): Promise<FinWiseCloudData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  const { data, error } = await supabase
    .from("finwise_user_data")
    .select("transactions,latest_period,merchant_rules")
    .eq("user_id", userId)
    .maybeSingle<LegacyCloudData>();

  if (error) throw error;
  if (!data) return null;

  return {
    transactions: data.transactions ?? [],
    latest_period: data.latest_period ?? null,
    merchant_rules: data.merchant_rules ?? []
  };
}

async function saveLegacyData(userId: string, transactions: Transaction[], latestPeriod: StatementPeriodInfo | null, merchantRules: MerchantRule[]) {
  const supabase = getSupabase();
  if (!supabase) return false;

  const { error } = await supabase.from("finwise_user_data").upsert({
    user_id: userId,
    transactions,
    latest_period: latestPeriod,
    merchant_rules: merchantRules
  });

  return !error;
}

function rowToTransaction(row: TransactionRow, statement?: StatementRow): Transaction {
  return {
    id: row.id,
    statementId: row.statement_id ?? undefined,
    statementFileName: statement?.file_name,
    statementUploadedAt: statement?.uploaded_at,
    statementPeriodLabel: statement?.period_label,
    statementStatus: statement?.status as Transaction["statementStatus"] | undefined,
    date: row.date,
    bank: row.bank,
    descriptionRaw: row.description_raw,
    merchant: row.merchant,
    amount: Number(row.amount),
    direction: row.direction,
    currency: row.currency,
    category: row.category,
    subcategory: row.subcategory,
    confidence: Number(row.confidence),
    reason: row.reason,
    needsReview: row.needs_review,
    categorySource: row.category_source,
    duplicateHash: row.duplicate_hash
  };
}

function transactionToRow(userId: string, transaction: Transaction, statementId: string | null) {
  return {
    user_id: userId,
    id: transaction.id,
    statement_id: transaction.statementId ?? statementId,
    date: transaction.date,
    bank: transaction.bank,
    description_raw: transaction.descriptionRaw,
    merchant: transaction.merchant,
    amount: transaction.amount,
    direction: transaction.direction,
    currency: transaction.currency,
    category: transaction.category,
    subcategory: transaction.subcategory,
    confidence: transaction.confidence,
    reason: transaction.reason,
    needs_review: transaction.needsReview,
    category_source: transaction.categorySource,
    duplicate_hash: transaction.duplicateHash
  };
}

function rowToPeriod(row: StatementRow): StatementPeriodInfo {
  return {
    startDate: row.period_start,
    endDate: row.period_end,
    days: row.period_days,
    label: row.period_label
  };
}

function getStatementRows(userId: string, transactions: Transaction[], latestPeriod: StatementPeriodInfo | null) {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const id = transaction.statementId ?? getFallbackStatementId(latestPeriod);
    const rows = groups.get(id) ?? [];
    rows.push(transaction);
    groups.set(id, rows);
  }

  return Array.from(groups.entries()).map(([id, rows]) => {
    const sortedDates = rows.map((row) => row.date).sort();
    const summary = rows.reduce(
      (current, transaction) => {
        if (transaction.direction === "income") current.totalIncome += transaction.amount;
        else current.totalExpenses += transaction.amount;
        return current;
      },
      { totalIncome: 0, totalExpenses: 0 }
    );
    const periodDays = latestPeriod?.days ?? 0;

    return {
      user_id: userId,
      id,
      file_name: rows[0]?.statementFileName ?? "Imported statement",
      bank: rows[0]?.bank ?? "Unknown Bank",
      currency: rows[0]?.currency ?? "QAR",
      status: rows.some((row) => row.needsReview) ? "review" : "processed",
      transaction_count: rows.length,
      total_income: summary.totalIncome,
      total_expenses: summary.totalExpenses,
      period_start: sortedDates[0] ?? latestPeriod?.startDate ?? null,
      period_end: sortedDates.at(-1) ?? latestPeriod?.endDate ?? null,
      period_days: periodDays,
      period_label: rows[0]?.statementPeriodLabel ?? latestPeriod?.label ?? "",
      file_hash: id.length >= 32 ? id : null,
      blob_url: null,
      uploaded_at: rows[0]?.statementUploadedAt ?? new Date().toISOString()
    };
  });
}

function getFallbackStatementId(latestPeriod: StatementPeriodInfo | null) {
  const start = latestPeriod?.startDate ?? "unknown-start";
  const end = latestPeriod?.endDate ?? "unknown-end";
  return `statement:${start}:${end}`;
}
