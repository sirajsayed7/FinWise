"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownIcon, ArrowUpIcon, BellIcon, CheckIcon, ChevronIcon,
  EyeIcon, ReceiptIcon, StatementIcon, TrendIcon, WalletIcon
} from "@/components/finwise/icons";
import { periods } from "@/lib/dashboard-constants";
import type { ActiveView, SpendingPeriod, StatementPeriodInfo, UploadHandler } from "@/lib/dashboard-types";
import { formatAmount, formatDisplayAmount, getSpendingRows, getSummary } from "@/lib/finance-view-model";
import { metricSpendingRows, metricSummary } from "@/lib/analytics-metrics";
import type { DashboardMetrics, Transaction } from "@/lib/types";

const SpendingPieChart = dynamic(() => import("@/components/charts/spending-pie-chart"), {
  ssr: false,
  loading: () => <div className="h-[184px] w-[184px] animate-pulse rounded-full" style={{ background: "var(--bg-elevated)" }} />
});

export function HomeDashboard({
  displayName, transactions, latestPeriod, uploadStatus, transactionCount,
  onUpload, metrics, notificationCount, setActiveView
}: {
  displayName: string; transactions: Transaction[]; latestPeriod: StatementPeriodInfo | null;
  uploadStatus: string; transactionCount: number; onUpload: UploadHandler;
  setActiveView: (view: ActiveView) => void; metrics: DashboardMetrics | null; notificationCount: number;
}) {
  const summary = useMemo(() => metrics ? metricSummary(metrics) : getSummary(transactions), [metrics, transactions]);
  return (
    <>
      <HomeHeader displayName={displayName} notificationCount={notificationCount} onNotifications={() => setActiveView("notifications")} />
      <TotalBalanceCard balance={summary.balance} asOf={metrics?.latestDate} />
      <SummaryCards summary={summary} />
      <LatestStatementCard latestPeriod={latestPeriod} uploadStatus={uploadStatus} transactionCount={transactionCount} onUpload={onUpload} onOpen={() => setActiveView("statements")} />
      <SpendingOverviewCard transactions={transactions} metrics={metrics} onOpenCategories={() => setActiveView("insights")} />
      <TransactionsShortcut onOpen={() => setActiveView("transactions")} />
    </>
  );
}

function HomeHeader({ displayName, notificationCount, onNotifications }: { displayName: string; notificationCount: number; onNotifications: () => void }) {
  return (
    <header className="mb-[18px] flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[clamp(26px,7vw,30px)] font-extrabold leading-tight tracking-[-0.035em]" style={{ color: "var(--text-primary)" }}>
          Good morning, {displayName}
        </h1>
        <p className="mt-1 text-[clamp(16px,4vw,17px)] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>
          Here&apos;s your financial overview
        </p>
      </div>
      <button onClick={onNotifications} aria-label={`Notifications, ${notificationCount} unread`} className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--bg-surface)", border: "1px solid var(--border)" }}>
        <BellIcon />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full ring-2" style={{ background: "var(--accent)" }} />
      </button>
    </header>
  );
}

function TotalBalanceCard({ balance, asOf }: { balance: number; asOf?: string | null }) {
  const [visible, setVisible] = useState(true);
  return (
    <section className="relative h-[150px] overflow-hidden rounded-[24px] px-[18px] py-[22px] text-white min-[391px]:h-[158px] min-[391px]:px-6"
      style={{ background: "var(--grad-hero)", boxShadow: "var(--shadow-hero)" }}>
      {/* decorative glow orb */}
      <div className="pointer-events-none absolute -bottom-16 left-12 h-48 w-72 rounded-[50%]" style={{ background: "rgba(255,255,255,0.07)" }} />
      <div className="pointer-events-none absolute -top-10 right-8 h-40 w-40 rounded-full" style={{ background: "rgba(255,255,255,0.05)" }} />
      <div className="relative flex h-full justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => setVisible((c) => !c)} className="flex items-center gap-2 text-[15px] font-bold text-white/90" aria-label="Hide or show total balance">
            Total Balance <EyeIcon />
          </button>
          <p className="mt-5 whitespace-nowrap text-[clamp(27px,6.9vw,39px)] font-extrabold leading-none tracking-[-0.06em]">
            {visible ? `QAR ${formatDisplayAmount(balance)}` : "QAR *******"}
          </p>
          <p className="mt-4 text-[14px] font-semibold text-white/80">As of {asOf ?? "your latest statement"}</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[17px] min-[391px]:h-16 min-[391px]:w-16" style={{ background: "rgba(255,255,255,0.15)", backdropFilter: "blur(8px)" }}>
          <TrendIcon />
        </div>
      </div>
    </section>
  );
}

function SummaryCards({ summary }: { summary: ReturnType<typeof getSummary> }) {
  return (
    <section className="mt-3.5 grid grid-cols-3 gap-1.5">
      <SummaryCard icon={<ArrowDownIcon />} tone="green" title="Total Income" value={`QAR ${formatDisplayAmount(summary.income)}`} />
      <SummaryCard icon={<ArrowUpIcon />} tone="red" title="Total Expenses" value={`QAR ${formatDisplayAmount(summary.expenses)}`} />
      <SummaryCard icon={<WalletIcon />} tone="purple" title="Net Savings" value={`QAR ${formatDisplayAmount(summary.net)}`} />
    </section>
  );
}

function SummaryCard({ icon, tone, title, value }: { icon: ReactNode; tone: "green" | "red" | "purple"; title: string; value: string }) {
  const iconBg = tone === "green" ? "var(--success-soft)" : tone === "red" ? "var(--danger-soft)" : "var(--accent-soft)";
  const iconColor = tone === "green" ? "var(--success)" : tone === "red" ? "var(--danger)" : "var(--accent)";
  const labelColor = iconColor;
  return (
    <article className="flex h-[108px] min-w-0 flex-col overflow-hidden rounded-[19px] px-0.5 pb-1 pt-2.5 min-[391px]:h-[112px] min-[391px]:rounded-[20px] min-[391px]:px-1"
      style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <div className="grid h-[38px] w-[38px] place-items-center rounded-full [&_svg]:h-5 [&_svg]:w-5 min-[391px]:h-10 min-[391px]:w-10" style={{ background: iconBg, color: iconColor }}>{icon}</div>
      <h3 className="mt-1.5 whitespace-nowrap text-[11.25px] font-semibold leading-none tracking-[-0.012em] min-[391px]:mt-2 min-[391px]:text-[12px]" style={{ color: "var(--text-secondary)" }}>{title}</h3>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] pt-1">
        <p className="self-center whitespace-nowrap text-[12.85px] font-extrabold leading-none tracking-[-0.068em] min-[375px]:text-[13.85px] min-[391px]:text-[15.18px] min-[430px]:text-[15.42px]" style={{ color: "var(--text-primary)" }}>{value}</p>
        <p className="text-[10.5px] font-bold leading-none min-[391px]:text-[11.4px]" style={{ color: labelColor }}>This Month</p>
      </div>
    </article>
  );
}

function LatestStatementCard({ latestPeriod, uploadStatus, transactionCount, onUpload, onOpen }: {
  latestPeriod: StatementPeriodInfo | null; uploadStatus: string; transactionCount: number; onUpload: UploadHandler; onOpen: () => void;
}) {
  const statusText = (uploadStatus === "42 transactions imported" ? `${transactionCount} transactions` : uploadStatus).replace(/\s+imported$/i, "");
  const periodText = latestPeriod?.startDate && latestPeriod.endDate
    ? `${latestPeriod.startDate} to ${latestPeriod.endDate}`
    : "Latest statement";

  return (
    <section className="mt-3.5 rounded-[22px] px-4 py-3.5 min-[391px]:px-[18px]" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <div className="flex min-h-[64px] items-center gap-3">
        <label className="relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full text-white min-[391px]:h-[58px] min-[391px]:w-[58px]"
          style={{ background: "linear-gradient(135deg, #7C3AED, #A78BFA)" }} aria-label="Upload a statement">
          <StatementIcon />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full text-white ring-2 ring-[var(--bg-base)]" style={{ background: "var(--success)" }}>
            <CheckIcon />
          </span>
          <input type="file" accept=".csv,.pdf,.xls,.xlsx,.txt" onChange={onUpload} className="sr-only" />
        </label>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h2 className="text-[16px] font-extrabold leading-tight tracking-[-0.02em] min-[391px]:text-[17px]" style={{ color: "var(--text-primary)" }}>Latest Statement</h2>
          <p className="mt-0.5 truncate text-[13px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>{periodText}</p>
          <p className="truncate text-[14px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>{statusText}</p>
        </button>
        <span className="inline-flex h-9 items-center rounded-full px-3.5 text-[12px] font-bold min-[391px]:px-4" style={{ background: "var(--success-soft)", color: "var(--success)" }}>Processed</span>
        <button onClick={onOpen} aria-label="Open statement details" style={{ color: "var(--text-secondary)" }}><ChevronIcon /></button>
      </div>
    </section>
  );
}

function SpendingOverviewCard({ transactions, metrics, onOpenCategories }: {
  transactions: Transaction[]; onOpenCategories: () => void; metrics: DashboardMetrics | null;
}) {
  const [period, setPeriod] = useState<SpendingPeriod>("This Month");
  const rows = useMemo(() => metrics ? metricSpendingRows(metrics, period).slice(0, 5) : getSpendingRows(transactions, period), [metrics, transactions, period]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="mt-3.5 rounded-[23px] p-4 min-[391px]:p-[18px]" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <h2 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.035em] min-[391px]:text-[22px]" style={{ color: "var(--text-primary)" }}>Spending Overview</h2>
      {/* period tabs */}
      <div className="mt-3 grid h-10 grid-cols-3 rounded-[15px] p-1 text-[12.5px] font-semibold min-[391px]:text-[13.5px]" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border)" }}>
        {periods.map((item) => (
          <button key={item} onClick={() => setPeriod(item)} className="rounded-[12px] px-2 transition"
            style={item === period
              ? { background: "var(--accent)", color: "#fff", boxShadow: "0 4px 12px var(--accent-glow)" }
              : { color: "var(--text-secondary)" }}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <div className="relative h-[172px] w-[172px] min-[391px]:h-[184px] min-[391px]:w-[184px]">
          <SpendingPieChart rows={rows} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="flex flex-col items-center justify-center">
              <span className="text-[12px] font-medium leading-none min-[391px]:text-[13px]" style={{ color: "var(--text-muted)" }}>Total Spent</span>
              <strong className="mt-2 whitespace-nowrap text-[15px] font-extrabold leading-none min-[391px]:text-[16px]" style={{ color: "var(--text-primary)" }}>QAR {formatAmount(total)}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="grid min-h-[30px] grid-cols-[minmax(112px,1fr)_minmax(116px,132px)_46px] items-center gap-x-2 text-[13.5px] min-[391px]:grid-cols-[minmax(130px,1fr)_minmax(126px,142px)_48px] min-[391px]:text-[14.5px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate font-semibold" style={{ color: "var(--text-primary)" }}>{row.label}</span>
            </div>
            <span className="justify-self-center whitespace-nowrap font-medium" style={{ color: "var(--text-primary)" }}>QAR {formatAmount(row.amount)}</span>
            <span className="justify-self-end text-[13px] font-medium min-[391px]:text-[14px]" style={{ color: "var(--text-secondary)" }}>{row.percent}%</span>
          </div>
        )) : (
          <div className="rounded-[16px] px-4 py-5 text-center text-[13px] font-semibold" style={{ background: "var(--bg-elevated)", color: "var(--text-muted)" }}>
            Upload a statement to see your spending breakdown.
          </div>
        )}
      </div>
      <div className="mt-3 border-t pt-1.5" style={{ borderColor: "var(--border)" }}>
        <button onClick={onOpenCategories} className="flex h-10 w-full items-center justify-end gap-2 text-[14px] font-extrabold min-[391px]:text-[15px]" style={{ color: "var(--accent)" }}>
          View all categories <ChevronIcon />
        </button>
      </div>
    </section>
  );
}

function TransactionsShortcut({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="mt-4 flex min-h-[62px] w-full min-w-0 items-center gap-3 rounded-[18px] px-4 py-3 text-left" style={{ background: "var(--bg-surface)", boxShadow: "var(--shadow-card)", border: "1px solid var(--border)" }}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}><ReceiptIcon /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight tracking-[-0.02em]" style={{ color: "var(--text-primary)" }}>View all transactions</p>
        <p className="mt-0.5 truncate text-[12px] font-medium leading-tight" style={{ color: "var(--text-secondary)" }}>Search and manage every imported transaction</p>
      </div>
      <ChevronIcon />
    </button>
  );
}
