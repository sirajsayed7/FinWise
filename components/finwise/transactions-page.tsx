"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { toast } from "sonner";
import {
  CheckIcon, ChevronDownIcon, ChevronUpIcon, DotsIcon, FilterIcon, OpenIcon, SearchIcon, StatementIcon
} from "@/components/finwise/icons";
import { MerchantLogo } from "@/components/finwise/merchant-logo";
import { BottomSheet, CategoryCorrectionSheet } from "@/components/finwise/transaction-sheets";
import { AppTopBar, MetricCard, MiniMetric, PageHeader } from "@/components/finwise/ui";
import { categoryAvatarStyles } from "@/lib/dashboard-constants";
import { metricSummary } from "@/lib/analytics-metrics";
import type { ActiveView, TransactionSetter } from "@/lib/dashboard-types";
import {
  applyMerchantCorrection, applySavedMerchantRules, applySingleTransactionCorrection, formatAmount,
  formatMonthRange, getReviewReason, getReviewRows, getReviewStats, getStatementSummaries,
  getStoredMerchantRules, getSummary, groupTransactionsByMonth, isReviewTransaction,
  saveMerchantRule, shouldApplyMerchantCorrection
} from "@/lib/finance-view-model";
import type { DashboardMetrics, Transaction } from "@/lib/types";

export function TransactionsPage({ transactions, metrics, hasMoreRemote, isLoadingMore, onLoadMore, setTransactions, setActiveView, onClearUploads }: { transactions: Transaction[]; metrics: DashboardMetrics | null; hasMoreRemote: boolean; isLoadingMore: boolean; onLoadMore: () => void; setTransactions: (transactions: Transaction[] | ((current: Transaction[]) => Transaction[])) => void; setActiveView: (view: ActiveView) => void; onClearUploads: () => void }) {
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "June 2026": true, "May 2026": true, "April 2026": true });
  const [sheet, setSheet] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [visibleLimit, setVisibleLimit] = useState(100);
  const groups = useMemo(() => groupTransactionsByMonth(transactions), [transactions]);
  const loadMoreRef = useRef<HTMLDivElement | null>(null);
  const statements = useMemo(() => getStatementSummaries(transactions, null), [transactions]);
  const summary = useMemo(() => metrics ? metricSummary(metrics) : getSummary(transactions), [metrics, transactions]);
  const reviewRows = useMemo(() => getReviewRows(transactions), [transactions]);
  const reviewStats = useMemo(() => getReviewStats(transactions), [transactions]);

  const filteredGroups = useMemo(
    () =>
      groups
        .map((group) => ({
          ...group,
          rows: group.rows.filter((row) => {
            const haystack = `${row.merchant} ${row.descriptionRaw} ${row.category} ${row.bank}`.toLowerCase();
            const matchesSearch = haystack.includes(search.toLowerCase());
            const matchesChip =
              activeChip === "All" ||
              (activeChip === "Expenses" && row.direction === "expense") ||
              (activeChip === "Income" && row.direction === "income") ||
              (activeChip === "Needs Review" && isReviewTransaction(row)) ||
              (activeChip === "Transfers" && row.category === "Bank Transfer") ||
              row.category === activeChip;
            return matchesSearch && matchesChip;
          })
        }))
        .filter((group) => group.rows.length > 0),
    [groups, search, activeChip]
  );

  const filteredTransactionCount = useMemo(
    () => filteredGroups.reduce((total, group) => total + group.rows.length, 0),
    [filteredGroups]
  );
  const visibleGroups = useMemo(() => {
    let remaining = visibleLimit;
    return filteredGroups
      .map((group) => {
        const rows = group.rows.slice(0, Math.max(0, remaining));
        remaining -= rows.length;
        return { ...group, rows };
      })
      .filter((group) => group.rows.length > 0);
  }, [filteredGroups, visibleLimit]);
  const hasMoreVisibleTransactions = visibleLimit < filteredTransactionCount;

  useEffect(() => {
    setVisibleLimit(100);
  }, [activeChip, search]);

  useEffect(() => {
    if (!hasMoreRemote || isLoadingMore || hasMoreVisibleTransactions || !loadMoreRef.current) return;
    const observer = new IntersectionObserver((entries) => { if (entries[0]?.isIntersecting) onLoadMore(); }, { rootMargin: "280px" });
    observer.observe(loadMoreRef.current);
    return () => observer.disconnect();
  }, [hasMoreRemote, hasMoreVisibleTransactions, isLoadingMore, onLoadMore]);

  return (
    <section>
      <AppTopBar />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.045em] text-[var(--text-primary)] min-[391px]:text-[32px]">Transactions</h1>
          <p className="mt-2 max-w-[330px] text-[13.5px] font-medium leading-snug text-[var(--text-secondary)] min-[391px]:text-[14px]">Search and manage all imported transactions across every statement.</p>
        </div>
      </div>

      <section className="rounded-[22px] replace_bg.5 shadow-[var(--shadow-card)] ring-1 ring-[var(--border)] min-[391px]:p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)] min-[391px]:h-[52px] min-[391px]:w-[52px]"><StatementIcon /></div>
          <button onClick={() => setSheet("Statement selector")} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)] min-[391px]:text-[17px]">All Statements</h2>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-[var(--success-soft)] text-[var(--success)]"><CheckIcon /></span>
            </div>
            <p className="mt-0.5 text-[13px] font-medium text-[var(--text-secondary)]">{statements.length} statements processed</p>
            <p className="mt-1 text-[12px] font-semibold text-[var(--text-secondary)]">{formatMonthRange(transactions)}</p>
          </button>
          <button onClick={() => setSheet("Statement selector")} className="hidden h-11 items-center gap-2 rounded-[15px] bg-[var(--bg-surface)] px-3 text-[13px] font-bold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border)] min-[390px]:flex">
            All Statements
            <ChevronDownIcon />
          </button>
        </div>
      </section>

      <div className="mt-4 flex h-[50px] items-center gap-3 rounded-[17px] bg-[var(--bg-surface)] px-4 shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
        <SearchIcon />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchant, category, account, or note" className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:outline-none" />
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <div className="flex min-w-max gap-2">
            {["All", "Needs Review", "Expenses", "Income", "Transfers", "Groceries", "Ordering Out"].map((chip) => (
            <button key={chip} onClick={() => setActiveChip(chip)} className={chip === activeChip ? "h-10 rounded-[14px] bg-[var(--accent)] px-4 text-[13px] font-extrabold text-white shadow-lg shadow-[var(--accent-glow)]" : "h-10 rounded-[14px] bg-[var(--bg-surface)] px-4 text-[13px] font-bold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border)]"}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <div className="flex min-w-max gap-2">
          {["Date Range", "Statement", "Account", "Sort: Newest"].map((filter) => (
            <button key={filter} onClick={() => setSheet(filter)} className="flex h-10 items-center gap-2 rounded-[14px] bg-[var(--bg-surface)] px-3 text-[12.5px] font-bold text-[var(--text-primary)] shadow-sm ring-1 ring-[var(--border)]">
              <FilterIcon />
              {filter}
              <ChevronDownIcon />
            </button>
          ))}
        </div>
      </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MetricCard label="Transactions" value={(metrics?.transactionCount ?? transactions.length).toLocaleString("en-US")} helper="All time" />
          <MetricCard label="Total Spent" value={`QAR ${formatAmount(summary.expenses)}`} helper="All time" tone="red" />
          <MetricCard label="Total Income" value={`QAR ${formatAmount(summary.income)}`} helper="All time" tone="green" />
          <MetricCard label="Statements" value={(metrics?.statementCount ?? statements.length).toString()} helper="Processed" tone="purple" />
          <MetricCard label="Needs Review" value={(metrics?.needsReview ?? reviewStats.needsReview).toString()} helper={`${reviewStats.categorizedPercent}% categorized`} tone={(metrics?.needsReview ?? reviewStats.needsReview) ? "red" : "green"} />
          <MetricCard label="Rules" value={reviewStats.ruleCount.toString()} helper="Saved locally" tone="purple" />
        </div>

        {reviewRows.length ? (
          <section className="mt-4 rounded-[22px] replace_bg shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Review Queue</h2>
                <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">Correct these once. FinWise will learn the merchant rule.</p>
              </div>
              <button onClick={() => setActiveView("review")} className="rounded-full bg-[var(--warning-soft)] px-3 py-1.5 text-[12px] font-extrabold text-[var(--warning)]">{reviewRows.length}</button>
            </div>
            <div className="mt-3 divide-y ring-[var(--border)]">
              {reviewRows.slice(0, 4).map((row) => (
                <ReviewQueueRow key={row.id} row={row} onCorrect={() => setEditingTransaction(row)} />
              ))}
            </div>
            <button onClick={() => setActiveView("review")} className="mt-3 h-10 w-full rounded-[15px] bg-[var(--bg-elevated)] text-[13px] font-extrabold text-[var(--accent)] ring-1 ring-[var(--border)]">Review all transactions</button>
          </section>
        ) : null}

      <div className="mt-4 flex items-center justify-between px-1 text-[14px] font-extrabold text-[var(--accent)]">
        <button onClick={() => setActiveView("statements")} className="flex items-center gap-2"><OpenIcon />Manage statements</button>
        <button onClick={onClearUploads} className="flex items-center gap-1 text-[var(--danger)]">Clear imports</button>
      </div>

      <div className="mt-3 grid gap-4">
        {visibleGroups.length ? visibleGroups.map((group) => (
          <section key={group.month} className="overflow-hidden rounded-[22px] bg-[var(--bg-surface)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <button onClick={() => setExpanded((current) => ({ ...current, [group.month]: !current[group.month] }))} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{group.month}</h2>
              <span className="flex items-center gap-2 text-[12px] font-bold text-[var(--text-secondary)]">{group.count} transactions<ChevronUpIcon collapsed={!expanded[group.month]} /></span>
            </button>
            {expanded[group.month] ? (
              <TransactionRowsPanel rows={group.rows} onOpen={(row) => setSheet(`${row.merchant} details`)} onActions={(row) => setEditingTransaction(row)} />
            ) : null}
          </section>
        )) : (
          <section className="rounded-[22px] bg-[var(--bg-surface)] px-5 py-8 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <p className="text-[15px] font-extrabold text-[var(--text-primary)]">No imported transactions</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">Upload a bank statement to populate this page.</p>
          </section>
        )}
      </div>

      {hasMoreVisibleTransactions || hasMoreRemote ? (
        <button disabled={isLoadingMore} onClick={() => hasMoreVisibleTransactions ? setVisibleLimit((current) => current + 100) : onLoadMore()} className="mt-4 h-12 w-full rounded-[16px] bg-[var(--bg-surface)] text-[14px] font-extrabold text-[var(--text-primary)] shadow-[var(--shadow-card)] ring-1 ring-[var(--border)] disabled:opacity-60">
          {isLoadingMore ? "Loading older transactions..." : "Load 100 more transactions"}
        </button>
      ) : null}
      <div ref={loadMoreRef} className="h-px" aria-hidden="true" />
      <BottomSheet title={sheet} transactions={transactions} onClose={() => setSheet(null)} />
      <CategoryCorrectionSheet
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={(category, options) => {
          if (!editingTransaction) return;
          const rule = saveMerchantRule(editingTransaction, category);
          setTransactions((current) => {
            const next = options.applyAllMatching
              ? applyMerchantCorrection(current, editingTransaction, category, rule?.pattern)
              : applySingleTransactionCorrection(current, editingTransaction, category);
            const previous = current;
            window.setTimeout(() => {
              toast.success(`${editingTransaction.merchant} moved out of review`, {
                action: {
                  label: "Undo",
                  onClick: () => setTransactions(previous)
                }
              });
            }, 0);
            return next;
          });
          setEditingTransaction(null);
        }}
      />
    </section>
  );
}

export function ReviewWorkflowPage({ transactions, setTransactions, setActiveView }: { transactions: Transaction[]; setTransactions: (transactions: Transaction[] | ((current: Transaction[]) => Transaction[])) => void; setActiveView: (view: ActiveView) => void }) {
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const reviewRows = useMemo(() => getReviewRows(transactions), [transactions]);
  const similarCount = useMemo(() => editingTransaction ? transactions.filter((row) => shouldApplyMerchantCorrection(row, editingTransaction)).length : 0, [editingTransaction, transactions]);

  const applySavedRules = () => {
    setTransactions((current) => {
      const next = applySavedMerchantRules(current);
      const resolved = getReviewRows(current).length - getReviewRows(next).length;
      window.setTimeout(() => {
        if (resolved > 0) toast.success(`${resolved} transactions resolved from saved rules`);
        else toast.message("No saved rules matched the current review queue");
      }, 0);
      return next;
    });
  };

  return (
    <section>
      <PageHeader title="Review Queue" subtitle="Fix low-confidence transactions once. FinWise will remember the merchant rule." actionLabel="Back" onAction={() => setActiveView("transactions")} />

      <section className="rounded-[24px] bg-gradient-to-br from-violet-50 to-white p-4 shadow-[var(--shadow-card)] ring-1 ring-violet-100">
        <div className="grid grid-cols-3 gap-2">
          <MiniMetric label="Needs review" value={reviewRows.length.toString()} tone={reviewRows.length ? "red" : "green"} />
          <MiniMetric label="Rules" value={getStoredMerchantRules().length.toString()} />
          <MiniMetric label="Resolved" value={`${getReviewStats(transactions).categorizedPercent}%`} tone="green" />
        </div>
        <button onClick={applySavedRules} className="mt-3 h-11 w-full rounded-[15px] bg-[var(--accent)] text-[13px] font-extrabold text-white shadow-lg shadow-[var(--accent-glow)]">
          Apply saved rules to queue
        </button>
      </section>

      <div className="mt-4 grid gap-3">
        {reviewRows.length ? reviewRows.map((row) => (
          <article key={row.id} className="rounded-[20px] replace_bg.5 shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <div className="flex items-start gap-3">
              <span className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-[14px] font-extrabold ${categoryAvatarStyles[row.category] ?? categoryAvatarStyles.Other}`}>
                <MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1) || "?"} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[14px] font-extrabold text-[var(--text-primary)]">{row.merchant}</p>
                <p className="mt-0.5 text-[12px] font-semibold text-[var(--text-secondary)]">{row.date} - QAR {formatAmount(row.amount)}</p>
                <p className="mt-2 rounded-[14px] bg-[var(--warning-soft)] p-2 text-[11.5px] font-semibold leading-snug text-[var(--warning)]">
                  {getReviewReason(row)}
                </p>
              </div>
              <button onClick={() => setEditingTransaction(row)} className="rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-extrabold text-white shadow-md shadow-[var(--accent-glow)]">Fix</button>
            </div>
          </article>
        )) : (
          <section className="rounded-[24px] bg-[var(--bg-surface)] px-5 py-10 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <p className="text-[17px] font-extrabold text-[var(--text-primary)]">Review queue is clear</p>
            <p className="mt-1 text-[13px] font-semibold leading-snug text-[var(--text-secondary)]">Corrected merchant rules will be reused for future uploads.</p>
          </section>
        )}
      </div>

      <CategoryCorrectionSheet
        transaction={editingTransaction}
        similarCount={similarCount}
        onClose={() => setEditingTransaction(null)}
        onSave={(category, options) => {
          if (!editingTransaction) return;
          const rule = saveMerchantRule(editingTransaction, category);
          setTransactions((current) => {
            const previous = current;
            const next = options.applyAllMatching
              ? applyMerchantCorrection(current, editingTransaction, category, rule?.pattern)
              : applySingleTransactionCorrection(current, editingTransaction, category);
            window.setTimeout(() => {
              toast.success("Correction saved", {
                description: options.applyAllMatching ? "Matching merchant rows were updated." : "Only this transaction was updated.",
                action: {
                  label: "Undo",
                  onClick: () => setTransactions(previous)
                }
              });
            }, 0);
            return next;
          });
          setEditingTransaction(null);
        }}
      />
    </section>
  );
}

function TransactionListRow({ row, onOpen, onActions }: { row: Transaction; onOpen: () => void; onActions: () => void }) {
  const isIncome = row.direction === "income";
  const avatarClass = categoryAvatarStyles[row.category] ?? categoryAvatarStyles.Other;
  return (
    <div className="grid min-h-[76px] grid-cols-[44px_minmax(0,1fr)_auto_18px] items-center gap-3 px-4 py-3">
      <button onClick={onOpen} className={`grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-full text-[17px] font-extrabold ${avatarClass}`}>
        <MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1) || "T"} />
      </button>
      <button onClick={onOpen} className="min-w-0 text-left">
        <p className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-[var(--text-primary)]">{row.merchant}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-[var(--text-secondary)]">
          <span className="truncate">{row.date}</span>
          <span className={row.direction === "income" ? "shrink-0 rounded-[8px] bg-[var(--success-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--success)]" : "shrink-0 rounded-[8px] bg-[var(--accent-soft)] px-1.5 py-0.5 text-[10.5px] font-bold text-[var(--accent)]"}>{row.category}</span>
        </p>
        <p className="mt-0.5 truncate text-[10.5px] font-medium text-[var(--text-muted)]">{row.bank} - {row.categorySource}{row.needsReview ? " - Needs review" : ""}</p>
      </button>
      <button onClick={onOpen} className="text-right">
        <p className={isIncome ? "whitespace-nowrap text-[13.5px] font-extrabold text-[var(--success)] min-[391px]:text-[14px]" : "whitespace-nowrap text-[13.5px] font-extrabold text-[var(--danger)] min-[391px]:text-[14px]"}>{isIncome ? "+" : "-"}QAR {formatAmount(row.amount)}</p>
      </button>
      <button onClick={onActions} aria-label="Transaction actions" className="text-[var(--text-secondary)]"><DotsIcon /></button>
    </div>
  );
}

function TransactionRowsPanel({ rows, onOpen, onActions }: { rows: Transaction[]; onOpen: (row: Transaction) => void; onActions: (row: Transaction) => void }) {
  const parentRef = useRef<HTMLDivElement | null>(null);
  const shouldVirtualize = rows.length > 35;
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 77,
    overscan: 8
  });

  if (!shouldVirtualize) {
    return (
      <div className="divide-y ring-[var(--border)]">
        {rows.map((row) => (
          <TransactionListRow key={row.id} row={row} onOpen={() => onOpen(row)} onActions={() => onActions(row)} />
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="max-h-[620px] overflow-y-auto overscroll-contain">
      <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
        {virtualizer.getVirtualItems().map((item) => {
          const row = rows[item.index];
          return (
            <div
              key={row.id}
              className="absolute left-0 top-0 w-full border-b border-[var(--border)]"
              style={{ transform: `translateY(${item.start}px)` }}
            >
              <TransactionListRow row={row} onOpen={() => onOpen(row)} onActions={() => onActions(row)} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ReviewQueueRow({ row, onCorrect }: { row: Transaction; onCorrect: () => void }) {
  return (
    <div className="flex w-full items-center gap-3 py-2.5 text-left">
      <button type="button" onClick={onCorrect} className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-[14px] font-extrabold ${categoryAvatarStyles[row.category] ?? categoryAvatarStyles.Other}`} aria-label={`Fix ${row.merchant}`}>
        <MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1) || "?"} />
      </button>
      <button type="button" onClick={onCorrect} className="min-w-0 flex-1 text-left">
        <span className="block truncate text-[13.5px] font-extrabold text-[var(--text-primary)]">{row.merchant}</span>
        <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-[var(--text-secondary)]">{row.category} - {Math.round(row.confidence * 100)}% confidence</span>
      </button>
      <button type="button" onClick={onCorrect} className="shrink-0 rounded-full bg-[var(--accent)] px-3 py-1.5 text-[12px] font-extrabold text-white shadow-md shadow-[var(--accent-glow)] transition active:scale-[0.96]">
        Fix
      </button>
    </div>
  );
}
