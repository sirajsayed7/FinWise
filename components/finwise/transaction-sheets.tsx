"use client";

import { useEffect, useMemo, useState } from "react";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { MerchantLogo } from "@/components/finwise/merchant-logo";
import { FieldPreview, MiniMetric } from "@/components/finwise/ui";
import { categories } from "@/lib/categorization";
import { categoryAvatarStyles } from "@/lib/dashboard-constants";
import type { CorrectionOptions } from "@/lib/dashboard-types";
import {
  categoryTitleMatches,
  formatAmount,
  getAllCategoryRows,
  getAllMerchantRows,
  getDateRange,
  getSummary,
  normalizeCategoryLabel
} from "@/lib/finance-view-model";
import type { SpendingRow, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

export function CategoryCorrectionSheet({
  transaction,
  similarCount = 1,
  onClose,
  onSave
}: {
  transaction: Transaction | null;
  similarCount?: number;
  onClose: () => void;
  onSave: (category: Transaction["category"], options: CorrectionOptions) => void;
}) {
  const [applyAllMatching, setApplyAllMatching] = useState(true);

  useEffect(() => {
    if (transaction) setApplyAllMatching(true);
  }, [transaction]);

  return (
    <Dialog.Root open={Boolean(transaction)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {transaction ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-20 bg-slate-950/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.section
                className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] rounded-t-[28px] bg-[var(--bg-surface)] pb-[calc(18px+env(safe-area-inset-bottom))] shadow-2xl outline-none"
                initial={{ y: 36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 36, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--bg-overlay)]" />
                <Dialog.Title className="text-[20px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">Correct category</Dialog.Title>
                <Dialog.Description className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">{transaction.merchant}</Dialog.Description>
                <button
                  type="button"
                  onClick={() => setApplyAllMatching((current) => !current)}
                  className={cn(
                    "mt-3 flex min-h-[44px] w-full items-center justify-between gap-3 rounded-[16px] px-3 text-left text-[12px] font-extrabold ring-1 transition",
                    applyAllMatching ? "bg-[var(--accent-soft)] text-[var(--text-accent)] ring-[var(--accent-border)]" : "bg-[var(--bg-elevated)] text-[var(--text-secondary)] ring-[var(--border)]"
                  )}
                >
                  <span>Apply to all matching merchants</span>
                  <span className="rounded-full bg-[var(--bg-surface)] px-2 py-1 text-[11px] text-[var(--text-primary)] ring-1 ring-[var(--border)]">{applyAllMatching ? `${similarCount} rows` : "1 row"}</span>
                </button>
                <div className="mt-4 grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => onSave(category, { applyAllMatching })}
                      className={cn(
                        "min-h-10 rounded-[14px] px-3 text-[12px] font-extrabold transition active:scale-[0.98]",
                        category === transaction.category
                          ? "bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-glow)]"
                          : "bg-[var(--bg-elevated)] text-[var(--text-primary)] ring-1 ring-[var(--border)]"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <p className="mt-4 rounded-[14px] bg-[var(--success-soft)] p-3 text-[12px] font-semibold leading-snug text-[var(--success)]">Saving a correction also saves a merchant rule, so future uploads classify this merchant automatically.</p>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

export function BottomSheet({
  title,
  transactions,
  onClose,
  emptyMessage
}: {
  title: string | null;
  transactions: Transaction[];
  onClose: () => void;
  emptyMessage?: string;
}) {
  return (
    <Dialog.Root open={Boolean(title)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {title ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div className="fixed inset-0 z-20 bg-slate-950/25 backdrop-blur-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }} />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.section
                className="fixed inset-x-0 bottom-0 z-30 mx-auto max-h-[84vh] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-[var(--bg-surface)] pb-[calc(18px+env(safe-area-inset-bottom))] shadow-2xl outline-none"
                initial={{ y: 36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 36, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-[var(--bg-overlay)]" />
                <Dialog.Title className="text-[20px] font-extrabold tracking-[-0.03em] text-[var(--text-primary)]">{title}</Dialog.Title>
                <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1">
                  <SheetContent title={title} transactions={transactions} emptyMessage={emptyMessage} />
                </div>
                <Dialog.Close asChild>
                  <button className="mt-5 h-12 w-full rounded-[16px] bg-[var(--accent)] text-[15px] font-extrabold text-white shadow-lg shadow-[var(--accent-glow)] transition active:scale-[0.99]">Done</button>
                </Dialog.Close>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function SheetContent({ title, transactions, emptyMessage }: { title: string; transactions: Transaction[]; emptyMessage?: string }) {
  const categoryRows = useMemo(() => getAllCategoryRows(transactions), [transactions]);
  const merchants = useMemo(() => getAllMerchantRows(transactions), [transactions]);
  const summary = useMemo(() => getSummary(transactions), [transactions]);
  const selectedCategory = categoryRows.find((row) => categoryTitleMatches(title, row.label));
  const selectedMerchant = merchants.find((row) => title.toLowerCase().includes(row.merchant.toLowerCase()));
  const lowConfidence = useMemo(() => transactions.filter((row) => row.needsReview || row.confidence < 0.75).length, [transactions]);
  const groceries = categoryRows.find((row) => row.label === "Groceries");
  const orderingOut = categoryRows.find((row) => row.label === "Ordering Out" || row.label === "Dining Out");

  if (!transactions.length) {
    return <div className="rounded-[18px] bg-[var(--bg-elevated)] p-4 text-[13px] font-semibold leading-relaxed text-[var(--text-secondary)]">{emptyMessage ?? "Upload a statement first. This panel will then show real merchant, category, filter, and recommendation data from your transactions."}</div>;
  }
  if (title === "All categories") {
    return <div className="space-y-2.5">{categoryRows.map((row) => <CategorySheetRow key={row.label} row={row} />)}</div>;
  }
  if (title === "Merchant insights") {
    return <div className="divide-y ring-[var(--border)]">{merchants.slice(0, 12).map((row) => <MerchantSheetRow key={row.merchant} row={row} />)}</div>;
  }
  if (selectedCategory) {
    const rows = transactions.filter((row) => normalizeCategoryLabel(row.category) === selectedCategory.label && row.direction === "expense").slice(0, 8);
    return (
      <div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Spent" value={`QAR ${formatAmount(selectedCategory.amount)}`} tone="red" />
          <MiniMetric label="Share" value={`${selectedCategory.percent}%`} />
        </div>
        <div className="mt-3 divide-y ring-[var(--border)]">{rows.map((row) => <CompactTransactionRow key={row.id} row={row} />)}</div>
      </div>
    );
  }
  if (selectedMerchant || title.endsWith(" details")) {
    const merchantName = selectedMerchant?.merchant ?? title.replace(/\s+details$/i, "").replace(/\s+insight$/i, "");
    const rows = transactions.filter((row) => row.merchant.toLowerCase().includes(merchantName.toLowerCase())).slice(0, 8);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return (
      <div>
        <div className="flex items-center gap-3 rounded-[18px] bg-[var(--bg-elevated)] p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-[var(--accent-soft)] text-[16px] font-extrabold text-[var(--accent)]"><MerchantLogo merchant={merchantName} fallback={merchantName.slice(0, 1)} /></span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-[var(--text-primary)]">{merchantName}</p>
            <p className="text-[13px] font-semibold text-[var(--text-secondary)]">QAR {formatAmount(total)} across {rows.length} transactions</p>
          </div>
        </div>
        <div className="mt-3 divide-y ring-[var(--border)]">{rows.map((row) => <CompactTransactionRow key={row.id} row={row} />)}</div>
      </div>
    );
  }
  if (title === "Savings opportunity") {
    const flexibleSpend = (orderingOut?.amount ?? 0) + (categoryRows.find((row) => row.label === "Shopping")?.amount ?? 0) + (categoryRows.find((row) => row.label === "Subscriptions")?.amount ?? 0);
    const saving = Math.max(0, flexibleSpend * 0.12);
    return (
      <div className="rounded-[20px] bg-[var(--success-soft)] p-4 ring-1 ring-[var(--border)]">
        <p className="text-[13px] font-semibold text-[var(--success)]">Estimated monthly opportunity</p>
        <p className="mt-1 text-[30px] font-extrabold tracking-[-0.04em] text-[var(--success)]">QAR {formatAmount(saving)}</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">Based on ordering out, shopping, and subscriptions. Reduce the highest flexible categories by 10-15% to unlock this saving.</p>
      </div>
    );
  }
  if (title === "Set a Grocery Budget") {
    const current = groceries?.amount ?? 0;
    const suggested = current ? current * 0.9 : summary.expenses * 0.25;
    return (
      <div className="space-y-3">
        <MiniMetric label="Current grocery spend" value={`QAR ${formatAmount(current)}`} />
        <MiniMetric label="Suggested monthly budget" value={`QAR ${formatAmount(suggested)}`} tone="green" />
        <p className="rounded-[16px] bg-[var(--bg-elevated)] p-3 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">Budget saving is calculated from your imported grocery transactions. Manual editable budgets can be added next as persistent settings.</p>
      </div>
    );
  }
  if (title === "Reduce Food Delivery") {
    const amount = orderingOut?.amount ?? 0;
    return <RecommendationDetail amount={amount} saving={amount * 0.14} text="Try replacing two delivery orders per week with planned meals. FinWise will track Ordering Out after each upload." />;
  }
  if (title === "Review Subscriptions") {
    const amount = categoryRows.find((row) => row.label === "Subscriptions")?.amount ?? 0;
    return <RecommendationDetail amount={amount} saving={amount * 0.2} text="Review recurring merchants and cancel unused subscriptions. Subscription rows are detected from merchant rules and transaction wording." />;
  }
  if (title === "AI insight details") {
    const top = categoryRows[0];
    return (
      <div className="space-y-3">
        <MiniMetric label="Top category" value={top ? top.label : "None"} />
        <MiniMetric label="Needs review" value={lowConfidence.toString()} tone={lowConfidence ? "red" : "green"} />
        <p className="rounded-[16px] bg-[var(--accent-soft)] p-3 text-[13px] font-medium leading-relaxed text-[var(--text-accent)]">The categorizer uses saved merchant rules first, default rules second, then fallback inference. Correcting a category saves a merchant rule for future uploads.</p>
      </div>
    );
  }
  if (["Insight period", "Date Range", "Statement", "Account", "Sort: Newest", "Statement selector", "More transactions"].includes(title)) {
    return (
      <div className="space-y-2">
        <FieldPreview label="Transactions" value={transactions.length.toLocaleString("en-US")} />
        <FieldPreview label="Date range" value={getDateRange(transactions)} />
        <FieldPreview label="Total spent" value={`QAR ${formatAmount(summary.expenses)}`} />
        <p className="rounded-[16px] bg-[var(--bg-elevated)] p-3 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">Current controls are connected to the imported dataset. Persistent saved filter presets can be added once account-level storage is introduced.</p>
      </div>
    );
  }
  return (
    <div className="space-y-2">
      <FieldPreview label="Imported transactions" value={transactions.length.toLocaleString("en-US")} />
      <FieldPreview label="Income" value={`QAR ${formatAmount(summary.income)}`} />
      <FieldPreview label="Expenses" value={`QAR ${formatAmount(summary.expenses)}`} />
    </div>
  );
}

function CategorySheetRow({ row }: { row: SpendingRow }) {
  return (
    <div className="grid min-h-[42px] grid-cols-[minmax(0,1fr)_90px_44px] items-center gap-2 rounded-[14px] bg-[var(--bg-elevated)] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
        <span className="truncate text-[13px] font-bold text-[var(--text-primary)]">{row.label}</span>
      </div>
      <span className="justify-self-end whitespace-nowrap text-[12.5px] font-semibold text-[var(--text-primary)]">QAR {formatAmount(row.amount)}</span>
      <span className="justify-self-end text-[12.5px] font-bold text-[var(--text-secondary)]">{row.percent}%</span>
    </div>
  );
}

function MerchantSheetRow({ row }: { row: { merchant: string; amount: number; count: number; change?: string; up?: boolean; color?: string } }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-[14px] font-extrabold ${row.color ?? "bg-[var(--accent-soft)] text-violet-600"}`}><MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1)} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-extrabold text-[var(--text-primary)]">{row.merchant}</p>
        <p className="text-[12px] font-medium text-[var(--text-secondary)]">{row.count} transactions</p>
      </div>
      <div className="text-right">
        <p className="whitespace-nowrap text-[12.5px] font-bold text-[var(--text-primary)]">QAR {formatAmount(row.amount)}</p>
        {row.change ? <p className={row.up ? "text-[12px] font-bold text-[var(--danger)]" : "text-[12px] font-bold text-[var(--success)]"}>{row.up ? "Up" : "Down"} {row.change.replace("+", "").replace("-", "")}</p> : null}
      </div>
    </div>
  );
}

function CompactTransactionRow({ row }: { row: Transaction }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-[13px] font-extrabold ${categoryAvatarStyles[row.category] ?? categoryAvatarStyles.Other}`}><MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1)} /></span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[var(--text-primary)]">{row.merchant}</p>
        <p className="text-[11.5px] font-medium text-[var(--text-secondary)]">{row.date} - {row.category}</p>
      </div>
      <p className={row.direction === "income" ? "whitespace-nowrap text-[12.5px] font-extrabold text-[var(--success)]" : "whitespace-nowrap text-[12.5px] font-extrabold text-[var(--danger)]"}>{row.direction === "income" ? "+" : "-"}QAR {formatAmount(row.amount)}</p>
    </div>
  );
}

function RecommendationDetail({ amount, saving, text }: { amount: number; saving: number; text: string }) {
  return (
    <div className="space-y-3">
      <MiniMetric label="Current spend" value={`QAR ${formatAmount(amount)}`} />
      <MiniMetric label="Potential saving" value={`QAR ${formatAmount(Math.max(0, saving))}`} tone="green" />
      <p className="rounded-[16px] bg-[var(--bg-elevated)] p-3 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">{text}</p>
    </div>
  );
}
