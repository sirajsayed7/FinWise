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
          <section className="rounded-[22px] bg-[var(--bg-surface)] px-5 py-8 text-center shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
            <p className="text-[15px] font-extrabold text-[var(--text-primary)]">No statements imported</p>
            <p className="mt-1 text-[13px] font-medium text-[var(--text-secondary)]">Upload a bank statement to start your dashboard.</p>
          </section>
        )}
      </div>
      {statements.length ? <button onClick={onClearUploads} className="mt-4 h-12 w-full rounded-[16px] bg-[var(--danger-soft)] text-[15px] font-extrabold text-[var(--danger)] ring-1 ring-[var(--danger-soft)]">Clear all imported statements</button> : null}
    </section>
  );
}

export function SettingsPage({ setActiveView, authEmail, syncStatus, onSignOut, onExportBackup, onRestoreBackup }: { setActiveView: (view: ActiveView) => void; authEmail: string | null; syncStatus: string; onSignOut: () => void; onExportBackup: () => void; onRestoreBackup: () => void }) {
  return (
    <section>
      <PageHeader title="Settings" subtitle="Manage privacy, categories, rules, and exports." />
      <div className="grid gap-3.5">
        <section className="rounded-[23px] replace_bg shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Account</h2>
          <div className="mt-3 grid gap-2">
            <FieldPreview label="Signed in as" value={authEmail ?? "Local mode"} />
            <FieldPreview label="Sync" value={syncStatus} />
          </div>
          {isSupabaseConfigured ? (
            <button onClick={onSignOut} className="mt-3 h-11 w-full rounded-[15px] bg-[var(--danger-soft)] text-[14px] font-extrabold text-[var(--danger)] ring-1 ring-[var(--danger-soft)]">Sign out</button>
          ) : (
            <p className="mt-3 rounded-[14px] bg-[var(--warning-soft)] p-3 text-[12px] font-semibold leading-relaxed text-[var(--warning)]">Add Supabase environment variables to enable hosted accounts.</p>
          )}
        </section>
        <section className="rounded-[23px] replace_bg shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">Data & Privacy</h2>
          <p className="mt-1 text-[12.5px] font-semibold leading-snug text-[var(--text-secondary)]">Original statements are deleted after processing unless private storage is enabled.</p>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <button onClick={onExportBackup} className="h-11 rounded-[15px] bg-[var(--accent)] text-[13px] font-extrabold text-white shadow-lg shadow-[var(--accent-glow)]">Export backup</button>
            <button onClick={onRestoreBackup} className="h-11 rounded-[15px] bg-[var(--bg-elevated)] text-[13px] font-extrabold text-[var(--text-primary)] ring-1 ring-[var(--border)]">Restore backup</button>
          </div>
        </section>
        <SettingsGroup title="Categories" items={["Manage category colors and icons", "Merchant rules", "Low-confidence review queue"]} />
        <button onClick={() => setActiveView("planning")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-[var(--bg-surface)] px-4 text-left shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
          <span className="text-[15px] font-extrabold">Budgets & financial goals</span>
          <ChevronIcon />
        </button>
        <button onClick={() => setActiveView("review")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-[var(--bg-surface)] px-4 text-left shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
          <span className="text-[15px] font-extrabold">Review queue</span>
          <ChevronIcon />
        </button>
        <button onClick={() => setActiveView("statements")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-[var(--bg-surface)] px-4 text-left shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
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
    <article className="rounded-[24px] replace_bg shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[var(--accent-soft)] text-[var(--accent)]"><StatementIcon /></div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 className="truncate text-[16.5px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{statement.fileName}</h2>
              <p className="mt-0.5 text-[12.5px] font-semibold text-[var(--text-secondary)]">{statement.bank} - {statement.period.label || "Detected period"}</p>
            </div>
            <span className={statement.status === "review" ? "shrink-0 rounded-full bg-[var(--warning-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--warning)]" : "shrink-0 rounded-full bg-[var(--success-soft)] px-2.5 py-1 text-[11px] font-extrabold text-[var(--success)]"}>
              {statement.status === "review" ? "Review" : "Processed"}
            </span>
          </div>
          <p className="mt-2 text-[12.5px] font-medium text-[var(--text-secondary)]">{periodText}</p>
          <div className="mt-3 grid grid-cols-3 gap-2">
            <MiniStatementMetric label="Transactions" value={statement.transactionCount.toString()} />
            <MiniStatementMetric label="Spent" value={`QAR ${formatCompact(statement.totalExpenses)}`} tone="red" />
            <MiniStatementMetric label="Income" value={`QAR ${formatCompact(statement.totalIncome)}`} tone="green" />
          </div>
          <div className="mt-3 flex items-center justify-between gap-3">
            <p className="text-[12px] font-semibold text-[var(--text-secondary)]">{statement.needsReview ? `${statement.needsReview} need review` : "No review needed"}</p>
            <button onClick={onDelete} className="rounded-full bg-[var(--danger-soft)] px-3 py-1.5 text-[12px] font-extrabold text-[var(--danger)] ring-1 ring-[var(--danger-soft)]">Delete</button>
          </div>
        </div>
      </div>
    </article>
  );
}

function MiniStatementMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" | "green" }) {
  const toneClass = tone === "red" ? "text-[var(--danger)]" : tone === "green" ? "text-[var(--success)]" : "text-[var(--text-primary)]";
  return (
    <div className="min-w-0 rounded-[14px] bg-[var(--bg-elevated)] px-2.5 py-2 ring-1 ring-[var(--border)]">
      <p className="truncate text-[10.5px] font-bold uppercase tracking-[0.04em] text-[var(--text-secondary)]">{label}</p>
      <p className={`mt-1 truncate text-[12.5px] font-extrabold tracking-[-0.02em] ${toneClass}`}>{value}</p>
    </div>
  );
}

function SettingsGroup({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-[23px] replace_bg shadow-[var(--shadow-card)] ring-1 ring-[var(--border)]">
      <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">{title}</h2>
      <div className="mt-2.5 divide-y divide-[var(--border)]">
        {items.map((item) => (
          <button key={item} className="flex w-full items-center justify-between gap-4 py-3 text-left text-[13.5px] font-semibold leading-snug text-[var(--text-primary)] min-[391px]:text-[14px]">
            {item}
            <ChevronIcon />
          </button>
        ))}
      </div>
    </section>
  );
}
