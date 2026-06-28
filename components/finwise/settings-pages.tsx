"use client";

import { useMemo } from "react";
import { ChevronIcon, StatementIcon } from "@/components/finwise/icons";
import { FieldPreview, PageHeader } from "@/components/finwise/ui";
import type { ActiveView, StatementPeriodInfo, StatementSummary } from "@/lib/dashboard-types";
import { formatCompact, getStatementSummaries } from "@/lib/finance-view-model";
import { isSupabaseConfigured } from "@/lib/supabase-client";
import type { Transaction } from "@/lib/types";

export function StatementsPageV2({ transactions, latestPeriod, setActiveView, onClearUploads, onClearStatement }: { transactions: Transaction[]; latestPeriod: StatementPeriodInfo | null; setActiveView: (view: ActiveView) => void; onClearUploads: () => void; onClearStatement: (statementId: string) => void }) {
  const statements = useMemo(() => getStatementSummaries(transactions, latestPeriod), [transactions, latestPeriod]);

  return (
    <section>
      <PageHeader title="Statements" subtitle="View uploaded statement history and processing results." actionLabel="Upload" onAction={() => setActiveView("upload")} />
      <div className="grid gap-3.5">
        {statements.length ? statements.map((statement) => (
          <StatementHistoryCardV2
            key={statement.id}
            statement={statement}
            onDelete={() => {
              const shouldDelete = window.confirm(`Delete ${statement.fileName} and its ${statement.transactionCount} transactions?`);
              if (shouldDelete) onClearStatement(statement.id);
            }}
          />
        )) : (
          <section className="rounded-[22px] bg-white px-5 py-8 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
            <p className="text-[15px] font-extrabold text-[#0F172A]">No statements imported</p>
            <p className="mt-1 text-[13px] font-medium text-[#64748B]">Upload a bank statement to start your dashboard.</p>
          </section>
        )}
      </div>
      {statements.length ? <button onClick={onClearUploads} className="mt-4 h-12 w-full rounded-[16px] bg-red-50 text-[15px] font-extrabold text-red-500 ring-1 ring-red-100">Clear all imported statements</button> : null}
    </section>
  );
}

export function SettingsPage({ setActiveView, authEmail, syncStatus, onSignOut, onExportBackup, onRestoreBackup }: { setActiveView: (view: ActiveView) => void; authEmail: string | null; syncStatus: string; onSignOut: () => void; onExportBackup: () => void; onRestoreBackup: () => void }) {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Manage privacy, categories, rules, and exports." />
      <div className="grid gap-3.5">
        <section className="rounded-[23px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Account</h2>
          <div className="mt-3 grid gap-2">
            <FieldPreview label="Signed in as" value={authEmail ?? "Local mode"} />
            <FieldPreview label="Sync" value={syncStatus} />
          </div>
          {isSupabaseConfigured ? (
            <button onClick={onSignOut} className="mt-3 h-11 w-full rounded-[15px] bg-red-50 text-[14px] font-extrabold text-red-500 ring-1 ring-red-100">Sign out</button>
          ) : (
            <p className="mt-3 rounded-[14px] bg-amber-50 p-3 text-[12px] font-semibold leading-relaxed text-amber-700">Add Supabase environment variables to enable hosted accounts.</p>
          )}
        </section>
        <section className="rounded-[23px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Data & Privacy</h2>
          <p className="mt-1 text-[12.5px] font-semibold leading-snug text-[#64748B]">Original statements are deleted after processing unless private storage is enabled.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onExportBackup} className="h-11 rounded-[15px] bg-[#6D35F5] text-[13px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20">Export backup</button>
            <button onClick={onRestoreBackup} className="h-11 rounded-[15px] bg-[#F8FAFC] text-[13px] font-extrabold text-[#334155] ring-1 ring-[#E2E8F0]">Restore backup</button>
          </div>
        </section>
        <SettingsGroup title="Categories" items={["Manage category colors and icons", "Merchant rules", "Low-confidence review queue"]} />
        <button onClick={() => setActiveView("review")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-white px-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
          <span className="text-[15px] font-extrabold">Review queue</span>
          <ChevronIcon />
        </button>
        <button onClick={() => setActiveView("statements")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-white px-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
          <span className="text-[15px] font-extrabold">Statement history</span>
          <ChevronIcon />
        </button>
      </div>
    </section>
  );
}


function StatementHistoryCardV2({ statement, onDelete }: { statement: StatementSummary; onDelete: () => void }) {
  const periodText = statement.period.startDate && statement.period.endDate
    ? `${statement.period.startDate} to ${statement.period.endDate}`
    : "Dates unavailable";

  return (
    <article className="rounded-[24px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-50 text-[#633EF2]"><StatementIcon /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16.5px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{statement.fileName}</h2>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[#64748B]">{statement.bank} - {statement.period.label || "Detected period"}</p>
            </div>
            <span className={statement.status === "review" ? "shrink-0 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-extrabold text-amber-600" : "shrink-0 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-extrabold text-emerald-600"}>
              {statement.status === "review" ? "Review" : "Processed"}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] font-medium text-[#64748B]">{periodText}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStatementMetric label="Transactions" value={statement.transactionCount.toString()} />
            <MiniStatementMetric label="Spent" value={`QAR ${formatCompact(statement.totalExpenses)}`} tone="red" />
            <MiniStatementMetric label="Income" value={`QAR ${formatCompact(statement.totalIncome)}`} tone="green" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-[#64748B]">{statement.needsReview ? `${statement.needsReview} need review` : "No review needed"}</p>
            <button onClick={onDelete} className="rounded-full bg-red-50 px-3 py-1.5 text-[12px] font-extrabold text-red-500 ring-1 ring-red-100">Delete</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStatementMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" | "green" }) {
  const toneClass = tone === "red" ? "text-red-500" : tone === "green" ? "text-emerald-500" : "text-[#0F172A]";
  return (
    <div className="min-w-0 rounded-[14px] bg-[#F8FAFC] px-2.5 py-2 ring-1 ring-[#E2E8F0]">
      <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.04em] text-[#64748B]">{label}</p>
      <p className={`mt-1 truncate text-[12.5px] font-extrabold tracking-[-0.02em] ${toneClass}`}>{value}</p>
    </div>
  );
}

function SettingsGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[23px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">{title}</h2>
      <div className="mt-2.5 divide-y divide-[#E8ECF3]">
        {items.map((item) => (
          <button key={item} className="flex w-full items-center justify-between gap-4 py-3 text-left text-[13.5px] font-semibold leading-snug text-[#111827] min-[391px]:text-[14px]">
            {item}
            <ChevronIcon />
          </button>
        ))}
      </div>
    </section>
  );
}
