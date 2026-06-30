import { getSupabase } from "@/lib/supabase-client";
import type {
  BudgetRecord,
  MerchantLogoRecord,
  DashboardMetrics,
  FinancialGoal,
  MerchantRule,
  Transaction,
  TransactionTombstone
} from "@/lib/types";

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
  tombstones: TransactionTombstone[];
  normalized: boolean;
  hasMore: boolean;
  nextOffset: number;
  metrics: DashboardMetrics;
};

export type FinWiseSyncOptions = {
  dirtyTransactionIds?: string[];
  deletedTransactions?: TransactionTombstone[];
  deletedStatementIds?: string[];
  deviceId?: string;
  forceFull?: boolean;
};

export type FinWiseSaveResult = {
  ok: boolean;
  remoteWins: Transaction[];
  usedLegacyFallback: boolean;
};

export type TransactionPage = {
  transactions: Transaction[];
  hasMore: boolean;
  nextOffset: number;
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
  client_updated_at?: string | null;
  updated_at?: string | null;
  device_id?: string | null;
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
  client_updated_at?: string | null;
  updated_at?: string | null;
  device_id?: string | null;
};

type MerchantLogoRow = {
  id?: string;
  merchant_key: string;
  merchant_name: string;
  logo_url: string;
  source: MerchantLogoRecord["source"];
  confidence: number;
};

type TombstoneRow = {
  transaction_id: string;
  statement_id: string | null;
  deleted_at: string;
  device_id: string | null;
};

type BudgetRow = {
  id?: string;
  category: BudgetRecord["category"];
  amount: number;
  currency: string;
  period: BudgetRecord["period"];
};

type GoalRow = {
  id: string;
  name: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  created_at: string;
};

const TRANSACTION_PAGE_SIZE = 100;
const WRITE_CHUNK_SIZE = 400;

const TRANSACTION_COLUMNS = "id,statement_id,date,bank,description_raw,merchant,amount,direction,currency,category,subcategory,confidence,reason,needs_review,category_source,duplicate_hash,client_updated_at,updated_at,device_id";
const STATEMENT_COLUMNS = "id,file_name,bank,currency,status,transaction_count,total_income,total_expenses,period_start,period_end,period_days,period_label,file_hash,blob_url,uploaded_at,client_updated_at,updated_at,device_id";

export async function loadFinWiseData(userId: string): Promise<FinWiseCloudData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const [transactionPage, statementResult, ruleResult, tombstoneResult, metrics] = await Promise.all([
      loadTransactionPage(userId, 0, TRANSACTION_PAGE_SIZE),
      supabase
        .from("statements")
        .select(STATEMENT_COLUMNS)
        .eq("user_id", userId)
        .order("uploaded_at", { ascending: false }),
      supabase
        .from("merchant_rules")
        .select("id,pattern,merchant,category,subcategory")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false }),
      supabase
        .from("transaction_tombstones")
        .select("transaction_id,statement_id,deleted_at,device_id")
        .eq("user_id", userId)
        .order("deleted_at", { ascending: false }),
      loadDashboardMetrics(userId)
    ]);

    if (statementResult.error) throw statementResult.error;
    if (ruleResult.error) throw ruleResult.error;
    if (tombstoneResult.error) throw tombstoneResult.error;

    const statementRows = (statementResult.data ?? []) as StatementRow[];
    return {
      transactions: transactionPage.transactions,
      latest_period: statementRows[0] ? rowToPeriod(statementRows[0]) : null,
      metrics: metrics.transactionCount || !transactionPage.transactions.length ? metrics : buildMetricsFromTransactions(transactionPage.transactions),
      merchant_rules: ((ruleResult.data ?? []) as MerchantRule[]).map((rule) => ({
        id: rule.id,
        pattern: rule.pattern,
        merchant: rule.merchant,
        category: rule.category,
        subcategory: rule.subcategory
      })),
      tombstones: ((tombstoneResult.data ?? []) as TombstoneRow[]).map(rowToTombstone),
      normalized: true,
      hasMore: transactionPage.hasMore,
      nextOffset: transactionPage.nextOffset,
    };
  } catch {
    return loadLegacyData(userId);
  }
}

export async function loadTransactionPage(
  userId: string,
  offset = 0,
  limit = 100
): Promise<TransactionPage> {
  const supabase = getSupabase();
  if (!supabase) return { transactions: [], hasMore: false, nextOffset: offset };

  const pageSize = Math.max(1, Math.min(limit, TRANSACTION_PAGE_SIZE));
  const [{ data, error }, { data: statements }] = await Promise.all([
    supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + pageSize),
    supabase
      .from("statements")
      .select(STATEMENT_COLUMNS)
      .eq("user_id", userId)
  ]);

  if (error) throw error;
  const rows = (data ?? []) as TransactionRow[];
  const statementMap = new Map(((statements ?? []) as StatementRow[]).map((row) => [row.id, row]));
  return {
    transactions: rows.slice(0, pageSize).map((row) =>
      rowToTransaction(row, statementMap.get(row.statement_id ?? ""))
    ),
    hasMore: rows.length > pageSize,
    nextOffset: offset + Math.min(rows.length, pageSize)
  };
}

export async function loadDashboardMetrics(userId: string): Promise<DashboardMetrics> {
  const supabase = getSupabase();
  if (!supabase) return emptyDashboardMetrics();
  const { data, error } = await supabase.rpc("get_finwise_dashboard_metrics");
  if (error) return emptyDashboardMetrics();
  const metrics = normalizeDashboardMetrics(data);
  if (!metrics.transactionCount && userId) return metrics;
  return metrics;
}

export async function deleteAllFinWiseData(userId: string) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const [{ error: transactionError }, { error: statementError }, { error: tombstoneError }] = await Promise.all([
    supabase.from("transactions").delete().eq("user_id", userId),
    supabase.from("statements").delete().eq("user_id", userId),
    supabase.from("transaction_tombstones").delete().eq("user_id", userId)
  ]);
  return !transactionError && !statementError && !tombstoneError;
}

export async function deleteStatementData(userId: string, statementId: string) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("statements").delete().eq("user_id", userId).eq("id", statementId);
  return !error;
}

export async function saveFinWiseData(
  userId: string,
  transactions: Transaction[],
  latestPeriod: StatementPeriodInfo | null,
  merchantRules: MerchantRule[],
  options: FinWiseSyncOptions = {}
): Promise<FinWiseSaveResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, remoteWins: [], usedLegacyFallback: false };

  try {
    const now = new Date().toISOString();
    const deviceId = options.deviceId ?? "unknown-device";
    const dirtyIds = options.forceFull || !options.dirtyTransactionIds
      ? new Set(transactions.map((transaction) => transaction.id))
      : new Set(options.dirtyTransactionIds);
    const dirtyTransactions = transactions.filter((transaction) => dirtyIds.has(transaction.id));
    const remoteWins: Transaction[] = [];

    const remoteRows = await loadRowsByIds(userId, Array.from(dirtyIds));
    const remoteById = new Map(remoteRows.map((row) => [row.id, row]));
    
    // IMPROVED: Enhanced conflict detection for optimistic locking
    // Compares updatedAt timestamps to detect concurrent modifications
    // Note: True optimistic locking would require database-level version tracking
    // Consider adding a 'version' column to transactions table for better concurrency control
    const writableTransactions = dirtyTransactions.filter((transaction) => {
      const remote = remoteById.get(transaction.id);
      if (!remote) return true;
      
      const localTime = Date.parse(transaction.updatedAt ?? now);
      const remoteTime = Date.parse(rowUpdatedAt(remote));
      
      // IMPROVED: Better conflict resolution - if remote is newer, keep it
      if (localTime >= remoteTime) return true;
      
      // Remote wins: add to conflicts list for client notification
      remoteWins.push(rowToTransaction(remote));
      return false;
    });

    const statements = getStatementRows(userId, transactions, latestPeriod, deviceId, now);
    for (const chunk of chunks(statements, WRITE_CHUNK_SIZE)) {
      const { error } = await supabase.from("statements").upsert(chunk, { onConflict: "user_id,id" });
      if (error) throw error;
    }

    const writableIds = writableTransactions.map((transaction) => transaction.id);
    if (writableIds.length) {
      for (const chunk of chunks(writableIds, WRITE_CHUNK_SIZE)) {
        const { error } = await supabase
          .from("transaction_tombstones")
          .delete()
          .eq("user_id", userId)
          .in("transaction_id", chunk);
        if (error) throw error;
      }

      const rows = writableTransactions.map((transaction) =>
        transactionToRow(
          userId,
          transaction,
          transaction.statementId ?? statements[0]?.id ?? null,
          deviceId,
          now
        )
      );
      for (const chunk of chunks(rows, WRITE_CHUNK_SIZE)) {
        const { error } = await supabase
          .from("transactions")
          .upsert(chunk, { onConflict: "user_id,id" });
        if (error) throw error;
      }
    }

    const acceptedTombstones = await resolveDeletions(
      userId,
      options.deletedTransactions ?? [],
      remoteById,
      remoteWins
    );
    if (acceptedTombstones.length) {
      for (const chunk of chunks(acceptedTombstones, WRITE_CHUNK_SIZE)) {
        const { error } = await supabase.from("transaction_tombstones").upsert(
          chunk.map((item) => ({
            user_id: userId,
            transaction_id: item.transactionId,
            statement_id: item.statementId ?? null,
            deleted_at: item.deletedAt,
            device_id: item.deviceId ?? deviceId
          })),
          { onConflict: "user_id,transaction_id" }
        );
        if (error) throw error;
      }
      for (const chunk of chunks(acceptedTombstones.map((item) => item.transactionId), WRITE_CHUNK_SIZE)) {
        const { error } = await supabase
          .from("transactions")
          .delete()
          .eq("user_id", userId)
          .in("id", chunk);
        if (error) throw error;
      }
    }

    const deletedStatementIds = options.deletedStatementIds ?? [];
    for (const chunk of chunks(deletedStatementIds, WRITE_CHUNK_SIZE)) {
      const { error } = await supabase
        .from("statements")
        .delete()
        .eq("user_id", userId)
        .in("id", chunk);
      if (error) throw error;
    }

    if (options.forceFull && transactions.length === 0) {
      const { error: transactionDeleteError } = await supabase
        .from("transactions")
        .delete()
        .eq("user_id", userId);
      if (transactionDeleteError) throw transactionDeleteError;
      const { error: statementDeleteError } = await supabase
        .from("statements")
        .delete()
        .eq("user_id", userId);
      if (statementDeleteError) throw statementDeleteError;
    }

    if (merchantRules.length) {
      for (const chunk of chunks(merchantRules, WRITE_CHUNK_SIZE)) {
        const { error } = await supabase.from("merchant_rules").upsert(
          chunk.map((rule) => ({
            user_id: userId,
            pattern: rule.pattern,
            merchant: rule.merchant ?? rule.pattern,
            category: rule.category,
            subcategory: rule.subcategory ?? rule.category
          })),
          { onConflict: "user_id,pattern" }
        );
        if (error) throw error;
      }
    }

    const { error: deviceError } = await supabase.from("sync_devices").upsert(
      {
        user_id: userId,
        device_id: deviceId,
        last_synced_at: now
      },
      { onConflict: "user_id,device_id" }
    );
    if (deviceError) throw deviceError;

    return {
      ok: true,
      remoteWins: dedupeById(remoteWins),
      usedLegacyFallback: false
    };
  } catch {
    const legacySaved = await saveLegacyData(userId, transactions, latestPeriod, merchantRules);
    return { ok: legacySaved, remoteWins: [], usedLegacyFallback: legacySaved };
  }
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

export async function loadBudgets(userId: string): Promise<BudgetRecord[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase
    .from("budgets")
    .select("id,category,amount,currency,period")
    .eq("user_id", userId)
    .order("category");
  if (error) return [];
  return ((data ?? []) as BudgetRow[]).map((row) => ({
    id: row.id,
    category: row.category,
    amount: Number(row.amount),
    currency: row.currency,
    period: row.period
  }));
}

export async function saveBudget(userId: string, budget: BudgetRecord) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("budgets").upsert(
    {
      user_id: userId,
      category: budget.category,
      amount: budget.amount,
      currency: budget.currency,
      period: budget.period
    },
    { onConflict: "user_id,category,period" }
  );
  return !error;
}

export async function deleteBudget(
  userId: string,
  category: BudgetRecord["category"],
  period: BudgetRecord["period"]
) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase
    .from("budgets")
    .delete()
    .eq("user_id", userId)
    .eq("category", category)
    .eq("period", period);
  return !error;
}

export async function loadFinancialGoals(userId: string): Promise<FinancialGoal[]> {
  const supabase = getSupabase();
  if (!supabase) return [];
  const { data, error } = await supabase.from("financial_goals").select("id,name,target_amount,current_amount,target_date,created_at").eq("user_id", userId).order("created_at");
  if (error) return [];
  return ((data ?? []) as GoalRow[]).map((row) => ({
    id: row.id, name: row.name, targetAmount: Number(row.target_amount),
    currentAmount: Number(row.current_amount), targetDate: row.target_date, createdAt: row.created_at
  }));
}

export async function saveFinancialGoal(userId: string, goal: FinancialGoal) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("financial_goals").upsert({
    user_id: userId, id: goal.id, name: goal.name, target_amount: goal.targetAmount,
    current_amount: goal.currentAmount, target_date: goal.targetDate
  }, { onConflict: "user_id,id" });
  return !error;
}

export async function deleteFinancialGoal(userId: string, goalId: string) {
  const supabase = getSupabase();
  if (!supabase) return false;
  const { error } = await supabase.from("financial_goals").delete().eq("user_id", userId).eq("id", goalId);
  return !error;
}


async function loadRowsByIds(userId: string, ids: string[]) {
  const supabase = getSupabase();
  if (!supabase || !ids.length) return [] as TransactionRow[];
  const rows: TransactionRow[] = [];
  for (const chunk of chunks(ids, WRITE_CHUNK_SIZE)) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("user_id", userId)
      .in("id", chunk);
    if (error) throw error;
    rows.push(...((data ?? []) as TransactionRow[]));
  }
  return rows;
}

async function resolveDeletions(
  userId: string,
  tombstones: TransactionTombstone[],
  knownRemoteRows: Map<string, TransactionRow>,
  remoteWins: Transaction[]
) {
  if (!tombstones.length) return [];
  const missingIds = tombstones
    .map((item) => item.transactionId)
    .filter((id) => !knownRemoteRows.has(id));
  const additionalRows = await loadRowsByIds(userId, missingIds);
  for (const row of additionalRows) knownRemoteRows.set(row.id, row);

  return tombstones.filter((item) => {
    const remote = knownRemoteRows.get(item.transactionId);
    if (!remote) return true;
    if (Date.parse(item.deletedAt) >= Date.parse(rowUpdatedAt(remote))) return true;
    remoteWins.push(rowToTransaction(remote));
    return false;
  });
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
    merchant_rules: data.merchant_rules ?? [],
    tombstones: [],
    normalized: false,
    hasMore: false,
    nextOffset: data.transactions?.length ?? 0,
    metrics: buildMetricsFromTransactions(data.transactions ?? [])
  };
}

async function saveLegacyData(
  userId: string,
  transactions: Transaction[],
  latestPeriod: StatementPeriodInfo | null,
  merchantRules: MerchantRule[]
) {
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
    duplicateHash: row.duplicate_hash,
    updatedAt: rowUpdatedAt(row)
  };
}

function transactionToRow(
  userId: string,
  transaction: Transaction,
  statementId: string | null,
  deviceId: string,
  now: string
) {
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
    duplicate_hash: transaction.duplicateHash,
    client_updated_at: transaction.updatedAt ?? now,
    device_id: deviceId
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

function rowToTombstone(row: TombstoneRow): TransactionTombstone {
  return {
    transactionId: row.transaction_id,
    statementId: row.statement_id ?? undefined,
    deletedAt: row.deleted_at,
    deviceId: row.device_id ?? undefined
  };
}

function rowUpdatedAt(row: TransactionRow) {
  return row.client_updated_at ?? row.updated_at ?? "1970-01-01T00:00:00.000Z";
}

function getStatementRows(
  userId: string,
  transactions: Transaction[],
  latestPeriod: StatementPeriodInfo | null,
  deviceId: string,
  now: string
) {
  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const id = transaction.statementId ?? getFallbackStatementId(latestPeriod);
    groups.set(id, [...(groups.get(id) ?? []), transaction]);
  }

  return Array.from(groups.entries()).map(([id, rows]) => {
    const sortedDates = rows.map((row) => row.date).sort();
    const totalIncome = rows
      .filter((row) => row.direction === "income")
      .reduce((sum, row) => sum + row.amount, 0);
    const totalExpenses = rows
      .filter((row) => row.direction === "expense")
      .reduce((sum, row) => sum + row.amount, 0);
    const startDate = sortedDates[0] ?? latestPeriod?.startDate ?? null;
    const endDate = sortedDates.at(-1) ?? latestPeriod?.endDate ?? null;
    const periodDays = startDate && endDate
      ? Math.max(
          1,
          Math.round(
            (new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime())
              / 86400000
          ) + 1
        )
      : latestPeriod?.days ?? 0;

    return {
      user_id: userId,
      id,
      file_name: rows[0]?.statementFileName ?? "Imported statement",
      bank: rows[0]?.bank ?? "Unknown Bank",
      currency: rows[0]?.currency ?? "QAR",
      status: rows.some((row) => row.needsReview) ? "review" : "processed",
      transaction_count: rows.length,
      total_income: totalIncome,
      total_expenses: totalExpenses,
      period_start: startDate,
      period_end: endDate,
      period_days: periodDays,
      period_label: rows[0]?.statementPeriodLabel ?? latestPeriod?.label ?? "",
      file_hash: id.length >= 32 ? id : null,
      blob_url: null,
      uploaded_at: rows[0]?.statementUploadedAt ?? now,
      client_updated_at: rows.reduce(
        (latest, row) => row.updatedAt && row.updatedAt > latest ? row.updatedAt : latest,
        now
      ),
      device_id: deviceId
    };
  });
}

function getFallbackStatementId(latestPeriod: StatementPeriodInfo | null) {
  const start = latestPeriod?.startDate ?? "unknown-start";
  const end = latestPeriod?.endDate ?? "unknown-end";
  return `statement:${start}:${end}`;
}

function emptyDashboardMetrics(): DashboardMetrics {
  return { transactionCount: 0, statementCount: 0, needsReview: 0, totalIncome: 0, totalExpenses: 0, latestDate: null, categoryTotals: [], dailyExpenses: [], monthlyExpenses: [], merchantTotals: [] };
}

function normalizeDashboardMetrics(value: unknown): DashboardMetrics {
  const row = (value && typeof value === "object" ? value : {}) as Record<string, unknown>;
  const arrays = <T>(key: string) => Array.isArray(row[key]) ? row[key] as T[] : [];
  return {
    transactionCount: Number(row.transactionCount ?? 0),
    statementCount: Number(row.statementCount ?? 0),
    needsReview: Number(row.needsReview ?? 0),
    totalIncome: Number(row.totalIncome ?? 0),
    totalExpenses: Number(row.totalExpenses ?? 0),
    latestDate: typeof row.latestDate === "string" ? row.latestDate : null,
    categoryTotals: arrays<Record<string, unknown>>("categoryTotals").map((item) => ({ month: String(item.month), category: item.category as Transaction["category"], amount: Number(item.amount) })),
    dailyExpenses: arrays<Record<string, unknown>>("dailyExpenses").map((item) => ({ date: String(item.date), amount: Number(item.amount) })),
    monthlyExpenses: arrays<Record<string, unknown>>("monthlyExpenses").map((item) => ({ month: String(item.month), amount: Number(item.amount) })),
    merchantTotals: arrays<Record<string, unknown>>("merchantTotals").map((item) => ({ month: String(item.month), merchant: String(item.merchant), amount: Number(item.amount), count: Number(item.count) }))
  };
}

function buildMetricsFromTransactions(transactions: Transaction[]): DashboardMetrics {
  const metrics = emptyDashboardMetrics();
  metrics.transactionCount = transactions.length;
  metrics.statementCount = new Set(transactions.map((row) => row.statementId).filter(Boolean)).size;
  metrics.needsReview = transactions.filter((row) => row.needsReview || row.confidence < 0.75).length;
  metrics.latestDate = transactions.reduce<string | null>((latest, row) => !latest || row.date > latest ? row.date : latest, null);
  const categories = new Map<string, number>();
  const days = new Map<string, number>();
  const months = new Map<string, number>();
  const merchants = new Map<string, { amount: number; count: number }>();
  for (const row of transactions) {
    if (row.direction === "income") { metrics.totalIncome += row.amount; continue; }
    metrics.totalExpenses += row.amount;
    const month = row.date.slice(0, 7);
    const categoryKey = `${month}|${row.category}`;
    const merchantKey = `${month}|${row.merchant}`;
    categories.set(categoryKey, (categories.get(categoryKey) ?? 0) + row.amount);
    days.set(row.date, (days.get(row.date) ?? 0) + row.amount);
    months.set(month, (months.get(month) ?? 0) + row.amount);
    const merchant = merchants.get(merchantKey) ?? { amount: 0, count: 0 };
    merchants.set(merchantKey, { amount: merchant.amount + row.amount, count: merchant.count + 1 });
  }
  metrics.categoryTotals = Array.from(categories, ([key, amount]) => { const [month, category] = key.split("|"); return { month, category: category as Transaction["category"], amount }; });
  metrics.dailyExpenses = Array.from(days, ([date, amount]) => ({ date, amount }));
  metrics.monthlyExpenses = Array.from(months, ([month, amount]) => ({ month, amount }));
  metrics.merchantTotals = Array.from(merchants, ([key, value]) => { const [month, merchant] = key.split("|"); return { month, merchant, ...value }; });
  return metrics;
}

function chunks<T>(items: T[], size: number) {
  const result: T[][] = [];
  for (let index = 0; index < items.length; index += size) {
    result.push(items.slice(index, index + size));
  }
  return result;
}

function dedupeById(transactions: Transaction[]) {
  return Array.from(new Map(transactions.map((transaction) => [transaction.id, transaction])).values());
}
