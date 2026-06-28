import { getSupabase } from "@/lib/supabase-client";
import type {
  BudgetRecord,
  MerchantLogoRecord,
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

const TRANSACTION_PAGE_SIZE = 500;
const WRITE_CHUNK_SIZE = 400;

const TRANSACTION_COLUMNS = "id,statement_id,date,bank,description_raw,merchant,amount,direction,currency,category,subcategory,confidence,reason,needs_review,category_source,duplicate_hash,client_updated_at,updated_at,device_id";
const STATEMENT_COLUMNS = "id,file_name,bank,currency,status,transaction_count,total_income,total_expenses,period_start,period_end,period_days,period_label,file_hash,blob_url,uploaded_at,client_updated_at,updated_at,device_id";

export async function loadFinWiseData(userId: string): Promise<FinWiseCloudData | null> {
  const supabase = getSupabase();
  if (!supabase) return null;

  try {
    const [transactionRows, statementResult, ruleResult, tombstoneResult] = await Promise.all([
      loadAllTransactionRowsPaged(userId),
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
        .order("deleted_at", { ascending: false })
    ]);

    if (statementResult.error) throw statementResult.error;
    if (ruleResult.error) throw ruleResult.error;
    if (tombstoneResult.error) throw tombstoneResult.error;

    const statementRows = (statementResult.data ?? []) as StatementRow[];
    const statementsById = new Map(statementRows.map((row) => [row.id, row]));
    return {
      transactions: transactionRows.map((row) =>
        rowToTransaction(row, statementsById.get(row.statement_id ?? ""))
      ),
      latest_period: statementRows[0] ? rowToPeriod(statementRows[0]) : null,
      merchant_rules: ((ruleResult.data ?? []) as MerchantRule[]).map((rule) => ({
        id: rule.id,
        pattern: rule.pattern,
        merchant: rule.merchant,
        category: rule.category,
        subcategory: rule.subcategory
      })),
      tombstones: ((tombstoneResult.data ?? []) as TombstoneRow[]).map(rowToTombstone),
      normalized: true
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
    const writableTransactions = dirtyTransactions.filter((transaction) => {
      const remote = remoteById.get(transaction.id);
      if (!remote) return true;
      const localTime = Date.parse(transaction.updatedAt ?? now);
      const remoteTime = Date.parse(rowUpdatedAt(remote));
      if (localTime >= remoteTime) return true;
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

async function loadAllTransactionRowsPaged(userId: string) {
  const supabase = getSupabase();
  if (!supabase) return [] as TransactionRow[];
  const rows: TransactionRow[] = [];
  let offset = 0;

  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select(TRANSACTION_COLUMNS)
      .eq("user_id", userId)
      .order("date", { ascending: false })
      .order("id", { ascending: false })
      .range(offset, offset + TRANSACTION_PAGE_SIZE - 1);
    if (error) throw error;
    const page = (data ?? []) as TransactionRow[];
    rows.push(...page);
    if (page.length < TRANSACTION_PAGE_SIZE) break;
    offset += page.length;
  }
  return rows;
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
    normalized: false
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
