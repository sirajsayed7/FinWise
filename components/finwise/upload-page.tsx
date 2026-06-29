"use client";

import { memo, useMemo, type ChangeEvent } from "react";
import { MerchantLogo } from "@/components/finwise/merchant-logo";
import { UploadIcon } from "@/components/finwise/icons";
import { FieldPreview, MiniMetric, PageHeader, StatusCard } from "@/components/finwise/ui";
import { categories } from "@/lib/categorization";
import { categoryAvatarStyles } from "@/lib/dashboard-constants";
import type { PendingImport, PendingTransactionPatch, StatementPeriodInfo } from "@/lib/dashboard-types";
import { formatDisplayAmount, getSummary } from "@/lib/finance-view-model";
import type { Transaction } from "@/lib/types";

export function UploadPage({
  latestPeriod,
  uploadStatus,
  onUpload,
  onClearUploads,
  hasUploads,
  pendingImport,
  onConfirmImport,
  onCancelImport,
  onRemovePendingTransaction,
  onUpdatePendingTransaction
}: {
  latestPeriod: StatementPeriodInfo | null;
  uploadStatus: string;
  onUpload: (event: ChangeEvent<HTMLInputElement>) => void;
  onClearUploads: () => void;
  hasUploads: boolean;
  pendingImport: PendingImport | null;
  onConfirmImport: () => void;
  onCancelImport: () => void;
  onRemovePendingTransaction: (transactionId: string) => void;
  onUpdatePendingTransaction: (transactionId: string, patch: PendingTransactionPatch) => void;
}) {
  return (
    <section>
      <PageHeader title="Upload Statement" subtitle="Upload a PDF, CSV, or Excel statement to import your transactions." />
      <label className="flex h-[190px] cursor-pointer flex-col items-center justify-center rounded-[24px] border border-dashed border-[#A78BFA] bg-white px-6 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] min-[391px]:h-[204px]">
        <div className="grid h-14 w-14 place-items-center rounded-full bg-violet-50 text-[#633EF2]"><UploadIcon /></div>
        <h2 className="mt-3 text-[18px] font-extrabold tracking-[-0.02em] min-[391px]:text-[19px]">Upload bank statement</h2>
        <p className="mt-1 text-[14px] font-medium text-[#64708A]">PDF, CSV, XLS, or XLSX</p>
        <span className="mt-4 rounded-full bg-[#633EF2] px-5 py-2.5 text-[14px] font-bold text-white shadow-lg shadow-[#633EF2]/20">Choose File</span>
        <input type="file" accept=".csv,.pdf,.xls,.xlsx,.txt" onChange={onUpload} className="sr-only" />
      </label>
      <div className="mt-4 rounded-[24px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
        <h3 className="text-[17px] font-extrabold">Statement details</h3>
        <div className="mt-3 grid gap-3">
          <FieldPreview label="Bank name" value={pendingImport?.bank ?? "Detected automatically"} />
          <FieldPreview label="Detected period" value={latestPeriod ? latestPeriod.label : "Detected after upload"} />
          <FieldPreview label="Currency" value={pendingImport?.currency ?? "Detected automatically"} />
        </div>
        <p className="mt-4 rounded-[16px] bg-emerald-50 p-3 text-[13px] font-semibold leading-snug text-emerald-700">Privacy default: the original statement is deleted after processing. FinWise stores only extracted transaction data.</p>
        {hasUploads ? (
          <button onClick={onClearUploads} className="mt-4 h-12 w-full rounded-[16px] bg-red-50 text-[15px] font-extrabold text-red-500 ring-1 ring-red-100">Clear imported data</button>
        ) : null}
      </div>
      {pendingImport ? (
        <ImportReviewCard
          pendingImport={pendingImport}
          onConfirm={onConfirmImport}
          onCancel={onCancelImport}
          onRemove={onRemovePendingTransaction}
          onUpdate={onUpdatePendingTransaction}
        />
      ) : null}
      <StatusCard title="Processing status" body={uploadStatus} />
    </section>
  );
}

function ImportReviewCard({ pendingImport, onConfirm, onCancel, onRemove, onUpdate }: { pendingImport: PendingImport; onConfirm: () => void; onCancel: () => void; onRemove: (transactionId: string) => void; onUpdate: (transactionId: string, patch: PendingTransactionPatch) => void }) {
  const summary = useMemo(() => getSummary(pendingImport.transactions), [pendingImport.transactions]);
  const reviewCount = useMemo(
    () => pendingImport.transactions.filter((transaction) => transaction.needsReview).length,
    [pendingImport.transactions]
  );

  return (
    <section className="mt-4 w-full max-w-full overflow-hidden rounded-[24px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-extrabold uppercase tracking-[0.12em] text-[#6D35F5]">Review before saving</p>
          <h2 className="mt-1 truncate text-[18px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{pendingImport.fileName}</h2>
          <p className="mt-1 text-[12.5px] font-semibold text-[#64748B]">{pendingImport.period?.label ?? "Detected period"} - {pendingImport.transactions.length} transactions</p>
        </div>
        {reviewCount ? <span className="shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-600">{reviewCount} review</span> : null}
      </div>

      <div className="mt-3 grid grid-cols-3 gap-2">
        <MiniMetric label="Income" value={pendingImport.currency + " " + formatDisplayAmount(summary.income)} tone="green" />
        <MiniMetric label="Spent" value={pendingImport.currency + " " + formatDisplayAmount(summary.expenses)} tone="red" />
        <MiniMetric label="Net" value={pendingImport.currency + " " + formatDisplayAmount(summary.balance)} />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] font-bold">
        <span className="rounded-full bg-violet-50 px-2.5 py-1 text-violet-700">{pendingImport.bank}</span>
        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">{pendingImport.currency}</span>
        {pendingImport.diagnostics ? (
          <span className={pendingImport.diagnostics.confidence >= 0.75 ? "rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700" : "rounded-full bg-amber-50 px-2.5 py-1 text-amber-700"}>
            {Math.round(pendingImport.diagnostics.confidence * 100)}% parse confidence
          </span>
        ) : null}
      </div>
      {pendingImport.diagnostics?.warnings.length ? (
        <div className="mt-3 rounded-[14px] bg-amber-50 px-3 py-2 text-[11.5px] font-semibold leading-relaxed text-amber-800">
          {pendingImport.diagnostics.warnings.join(" ")}
        </div>
      ) : null}
      <div className="mt-3 max-h-[390px] w-full max-w-full overflow-x-hidden overflow-y-auto rounded-[18px] bg-[#F8FAFC] p-2 ring-1 ring-[#E2E8F0]">
        <div className="grid min-w-0 gap-2">
          {pendingImport.transactions.map((transaction, index) => (
            <PendingTransactionRow key={transaction.id} transaction={transaction} index={index} onRemove={onRemove} onUpdate={onUpdate} />
          ))}
        </div>
      </div>

      <div className="mt-4 grid grid-cols-[1fr_1.4fr] gap-2">
        <button onClick={onCancel} className="h-12 rounded-[16px] bg-[#F8FAFC] text-[14px] font-extrabold text-[#64748B] ring-1 ring-[#E2E8F0]">Discard</button>
        <button disabled={!pendingImport.transactions.length} onClick={onConfirm} className="h-12 rounded-[16px] bg-[#6D35F5] text-[14px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20 disabled:opacity-50">Confirm import</button>
      </div>
    </section>
  );
}

const PendingTransactionRow = memo(function PendingTransactionRow({
  transaction,
  index,
  onRemove,
  onUpdate
}: {
  transaction: Transaction;
  index: number;
  onRemove: (transactionId: string) => void;
  onUpdate: (transactionId: string, patch: PendingTransactionPatch) => void;
}) {
  return (
    <article className="min-w-0 overflow-hidden rounded-[16px] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className={`grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full text-[12px] font-extrabold ${categoryAvatarStyles[transaction.category] ?? categoryAvatarStyles.Other}`}>
            <MerchantLogo merchant={transaction.merchant} fallback={transaction.merchant.slice(0, 1)} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[12px] font-extrabold text-[#0F172A]">Row {index + 1}</span>
            <span className="block truncate text-[10.5px] font-bold text-[#94A3B8]">{transaction.descriptionRaw}</span>
          </span>
        </div>
        <button onClick={() => onRemove(transaction.id)} className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-red-50 text-[15px] font-extrabold text-red-500 ring-1 ring-red-100" aria-label={`Remove ${transaction.merchant}`}>
          x
        </button>
      </div>
      <div className="grid min-w-0 grid-cols-2 gap-2">
        <label className="grid min-w-0 gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">Date</span>
          <input inputMode="numeric" value={transaction.date} onChange={(event) => onUpdate(transaction.id, { date: event.target.value })} className="h-10 w-full min-w-0 rounded-[12px] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">Amount</span>
          <input type="number" min="0" step="0.01" value={transaction.amount} onChange={(event) => onUpdate(transaction.id, { amount: Number(event.target.value) })} className="h-10 w-full min-w-0 rounded-[12px] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
        </label>
        <label className="col-span-2 grid min-w-0 gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">Merchant</span>
          <input value={transaction.merchant} onChange={(event) => onUpdate(transaction.id, { merchant: event.target.value })} className="h-10 w-full min-w-0 rounded-[12px] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">Category</span>
          <select value={transaction.category} onChange={(event) => onUpdate(transaction.id, { category: event.target.value as Transaction["category"] })} className="h-10 w-full min-w-0 rounded-[12px] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]">
            {categories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
        </label>
        <label className="grid min-w-0 gap-1">
          <span className="text-[10px] font-extrabold uppercase tracking-[0.08em] text-[#94A3B8]">Type</span>
          <select value={transaction.direction} onChange={(event) => onUpdate(transaction.id, { direction: event.target.value as Transaction["direction"] })} className="h-10 w-full min-w-0 rounded-[12px] bg-[#F8FAFC] px-3 text-[12px] font-bold text-[#0F172A] outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]">
            <option value="expense">Expense</option>
            <option value="income">Income</option>
          </select>
        </label>
      </div>
    </article>
  );
});
