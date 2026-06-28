"use client";

import { useMemo, useState, type ReactNode } from "react";
import dynamic from "next/dynamic";
import {
  ArrowDownIcon,
  ArrowUpIcon,
  BellIcon,
  CheckIcon,
  ChevronIcon,
  EyeIcon,
  ReceiptIcon,
  StatementIcon,
  TrendIcon,
  WalletIcon
} from "@/components/finwise/icons";
import { periods } from "@/lib/dashboard-constants";
import type { ActiveView, SpendingPeriod, StatementPeriodInfo, UploadHandler } from "@/lib/dashboard-types";
import { formatAmount, formatDisplayAmount, getSpendingRows, getSummary } from "@/lib/finance-view-model";
import type { Transaction } from "@/lib/types";

const SpendingPieChart = dynamic(() => import("@/components/charts/spending-pie-chart"), {
  ssr: false,
  loading: () => <div className="h-[184px] w-[184px] animate-pulse rounded-full bg-[#F1F5F9]" />
});

export function HomeDashboard({
  displayName,
  transactions,
  latestPeriod,
  uploadStatus,
  transactionCount,
  onUpload,
  setActiveView
}: {
  displayName: string;
  transactions: Transaction[];
  latestPeriod: StatementPeriodInfo | null;
  uploadStatus: string;
  transactionCount: number;
  onUpload: UploadHandler;
  setActiveView: (view: ActiveView) => void;
}) {
  const summary = useMemo(() => getSummary(transactions), [transactions]);

  return (
    <>
      <HomeHeader displayName={displayName} />
      <TotalBalanceCard balance={summary.balance} />
      <SummaryCards summary={summary} />
      <LatestStatementCard
        latestPeriod={latestPeriod}
        uploadStatus={uploadStatus}
        transactionCount={transactionCount}
        onUpload={onUpload}
        onOpen={() => setActiveView("statements")}
      />
      <SpendingOverviewCard transactions={transactions} onOpenCategories={() => setActiveView("insights")} />
      <TransactionsShortcut onOpen={() => setActiveView("transactions")} />
    </>
  );
}

function HomeHeader({ displayName }: { displayName: string }) {
  return (
    <header className="mb-[18px] flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[clamp(26px,7vw,30px)] font-extrabold leading-tight tracking-[-0.035em] text-[#11152D]">Good morning, {displayName}</h1>
        <p className="mt-1 text-[clamp(16px,4vw,17px)] font-medium leading-tight text-[#64708A]">Here&apos;s your financial overview</p>
      </div>
      <button aria-label="Notifications" className="relative grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white text-[#11152D] shadow-sm ring-1 ring-[rgba(15,23,42,0.06)]">
        <BellIcon />
        <span className="absolute right-2 top-2 h-2.5 w-2.5 rounded-full bg-[#6D3EF3] ring-2 ring-white" />
      </button>
    </header>
  );
}

function TotalBalanceCard({ balance }: { balance: number }) {
  const [visible, setVisible] = useState(true);
  return (
    <section className="relative h-[150px] overflow-hidden rounded-[24px] bg-gradient-to-br from-[#4F46E5] via-[#633EF2] to-[#7C3AED] px-[18px] py-[22px] text-white shadow-[0_18px_38px_rgba(99,62,242,0.23)] min-[391px]:h-[158px] min-[391px]:px-6">
      <div className="pointer-events-none absolute -bottom-20 left-20 h-48 w-80 rounded-[50%] bg-white/10" />
      <div className="relative flex h-full justify-between gap-4">
        <div className="min-w-0">
          <button onClick={() => setVisible((current) => !current)} className="flex items-center gap-2 text-[15px] font-bold text-white/90" aria-label="Hide or show total balance">
            Total Balance
            <EyeIcon />
          </button>
          <p className="mt-5 whitespace-nowrap text-[clamp(27px,6.9vw,39px)] font-extrabold leading-none tracking-[-0.06em]">{visible ? `QAR ${formatDisplayAmount(balance)}` : "QAR *******"}</p>
          <p className="mt-4 text-[14px] font-semibold text-white/85">As of July 1, 2026</p>
        </div>
        <div className="grid h-14 w-14 shrink-0 place-items-center rounded-[17px] bg-white/15 backdrop-blur min-[391px]:h-16 min-[391px]:w-16">
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

function SummaryCard({
  icon,
  tone,
  title,
  value
}: {
  icon: ReactNode;
  tone: "green" | "red" | "purple";
  title: string;
  value: string;
}) {
  const toneStyles = {
    green: { icon: "bg-emerald-50 text-emerald-500", label: "text-emerald-500" },
    red: { icon: "bg-rose-50 text-rose-500", label: "text-rose-500" },
    purple: { icon: "bg-violet-50 text-violet-600", label: "text-violet-600" }
  }[tone];

  return (
    <article className="flex h-[108px] min-w-0 flex-col overflow-hidden rounded-[19px] bg-white px-0.5 pb-1 pt-2.5 shadow-[0_8px_18px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:h-[112px] min-[391px]:rounded-[20px] min-[391px]:px-1">
      <div className={`grid h-[38px] w-[38px] place-items-center rounded-full [&_svg]:h-5 [&_svg]:w-5 min-[391px]:h-10 min-[391px]:w-10 ${toneStyles.icon}`}>{icon}</div>
      <h3 className="mt-1.5 whitespace-nowrap text-[11.25px] font-semibold leading-none tracking-[-0.012em] text-[#475569] min-[391px]:mt-2 min-[391px]:text-[12px]">{title}</h3>
      <div className="grid min-h-0 flex-1 grid-rows-[minmax(0,1fr)_auto] pt-1">
        <p className="self-center whitespace-nowrap text-[12.85px] font-extrabold leading-none tracking-[-0.068em] text-[#0F172A] min-[375px]:text-[13.85px] min-[391px]:text-[15.18px] min-[430px]:text-[15.42px]">{value}</p>
        <p className={`text-[10.5px] font-bold leading-none min-[391px]:text-[11.4px] ${toneStyles.label}`}>This Month</p>
      </div>
    </article>
  );
}

function LatestStatementCard({
  latestPeriod,
  uploadStatus,
  transactionCount,
  onUpload,
  onOpen
}: {
  latestPeriod: StatementPeriodInfo | null;
  uploadStatus: string;
  transactionCount: number;
  onUpload: UploadHandler;
  onOpen: () => void;
}) {
  const statusText = (uploadStatus === "42 transactions imported" ? `${transactionCount} transactions` : uploadStatus).replace(/\s+imported$/i, "");
  const periodText = latestPeriod?.startDate && latestPeriod.endDate
    ? `${latestPeriod.startDate} to ${latestPeriod.endDate}`
    : "Latest statement";

  return (
    <section className="mt-3.5 rounded-[22px] bg-white px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:px-[18px]">
      <div className="flex min-h-[64px] items-center gap-3">
        <label className="relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#C4B5FD] text-white min-[391px]:h-[58px] min-[391px]:w-[58px]" aria-label="Upload a statement">
          <StatementIcon />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#22C55E] text-white ring-2 ring-white"><CheckIcon /></span>
          <input type="file" accept=".csv,.pdf,.xls,.xlsx,.txt" onChange={onUpload} className="sr-only" />
        </label>
        <button onClick={onOpen} className="min-w-0 flex-1 text-left">
          <h2 className="text-[16px] font-extrabold leading-tight tracking-[-0.02em] min-[391px]:text-[17px]">Latest Statement</h2>
          <p className="mt-0.5 truncate text-[13px] font-medium leading-tight text-[#64708A]">{periodText}</p>
          <p className="truncate text-[14px] font-medium leading-tight text-[#64708A]">{statusText}</p>
        </button>
        <span className="inline-flex h-9 items-center rounded-full bg-emerald-50 px-3.5 text-[12px] font-bold text-emerald-600 min-[391px]:px-4">Processed</span>
        <button onClick={onOpen} aria-label="Open statement details" className="text-[#536180]"><ChevronIcon /></button>
      </div>
    </section>
  );
}

function SpendingOverviewCard({
  transactions,
  onOpenCategories
}: {
  transactions: Transaction[];
  onOpenCategories: () => void;
}) {
  const [period, setPeriod] = useState<SpendingPeriod>("This Month");
  const rows = useMemo(() => getSpendingRows(transactions, period), [transactions, period]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="mt-3.5 rounded-[23px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:p-[18px]">
      <h2 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#111827] min-[391px]:text-[22px]">Spending Overview</h2>
      <div className="mt-3 grid h-10 grid-cols-3 rounded-[15px] bg-[#F8FAFC] p-1 text-[12.5px] font-semibold text-[#64708A] ring-1 ring-[#E2E8F0] min-[391px]:text-[13.5px]">
        {periods.map((item) => (
          <button key={item} onClick={() => setPeriod(item)} className={item === period ? "rounded-[12px] bg-[#633EF2] px-2 text-white shadow-md shadow-[#633EF2]/25" : "rounded-[12px] px-2"}>
            {item}
          </button>
        ))}
      </div>
      <div className="mt-4 flex justify-center">
        <div className="relative h-[172px] w-[172px] min-[391px]:h-[184px] min-[391px]:w-[184px]">
          <SpendingPieChart rows={rows} />
          <div className="pointer-events-none absolute inset-0 grid place-items-center text-center">
            <div className="flex flex-col items-center justify-center">
              <span className="text-[12px] font-medium leading-none text-[#7B8498] min-[391px]:text-[13px]">Total Spent</span>
              <strong className="mt-2 whitespace-nowrap text-[15px] font-extrabold leading-none text-[#111827] min-[391px]:text-[16px]">QAR {formatAmount(total)}</strong>
            </div>
          </div>
        </div>
      </div>
      <div className="mt-4 space-y-1.5">
        {rows.length ? rows.map((row) => (
          <div key={row.label} className="grid min-h-[30px] grid-cols-[minmax(112px,1fr)_minmax(116px,132px)_46px] items-center gap-x-2 text-[13.5px] min-[391px]:grid-cols-[minmax(130px,1fr)_minmax(126px,142px)_48px] min-[391px]:text-[14.5px]">
            <div className="flex min-w-0 items-center gap-2">
              <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
              <span className="truncate font-semibold text-[#111827]">{row.label}</span>
            </div>
            <span className="justify-self-center whitespace-nowrap font-medium text-[#111827]">QAR {formatAmount(row.amount)}</span>
            <span className="justify-self-end text-[13px] font-medium text-[#64708A] min-[391px]:text-[14px]">{row.percent}%</span>
          </div>
        )) : (
          <div className="rounded-[16px] bg-[#F8FAFC] px-4 py-5 text-center text-[13px] font-semibold text-[#64748B]">Upload a statement to see your spending breakdown.</div>
        )}
      </div>
      <div className="mt-3 border-t border-[#E8ECF3] pt-1.5">
        <button onClick={onOpenCategories} className="flex h-10 w-full items-center justify-end gap-2 text-[14px] font-extrabold text-[#5A36ED] min-[391px]:text-[15px]">
          View all categories
          <ChevronIcon />
        </button>
      </div>
    </section>
  );
}

function TransactionsShortcut({ onOpen }: { onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="mt-4 flex min-h-[62px] items-center gap-3 rounded-[18px] bg-white px-4 py-3 text-left shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-50 text-[#633EF2]"><ReceiptIcon /></div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-[#111827]">View all transactions</p>
        <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#64708A]">Search and manage every imported transaction</p>
      </div>
      <ChevronIcon />
    </button>
  );
}
