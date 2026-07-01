"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { ChevronIcon, RobotIcon, WalletIcon } from "@/components/finwise/icons";
import { MerchantLogo } from "@/components/finwise/merchant-logo";
import { BottomSheet } from "@/components/finwise/transaction-sheets";
import { AppTopBar, InsightPanel } from "@/components/finwise/ui";
import { metricComparison, metricMerchantRows, metricSpendingRows, metricTrendRows } from "@/lib/analytics-metrics";
import { periods } from "@/lib/dashboard-constants";
import type { SpendingPeriod } from "@/lib/dashboard-types";
import {
  buildTrendRows, filterByPeriod, formatAmount, getFlexibleSavingsOpportunity,
  getInsightCategories, getMerchantInsights, getPeriodComparison, getRecommendations
} from "@/lib/finance-view-model";
import type { DashboardMetrics, Transaction } from "@/lib/types";

const SpendingTrendChart = dynamic(() => import("@/components/charts/spending-trend-chart"), {
  ssr: false,
  loading: () => <div className="h-[160px] w-full animate-pulse rounded-[16px] bg-[var(--bg-elevated)]" />
});

export function InsightsPage({ transactions, metrics }: { transactions: Transaction[]; metrics: DashboardMetrics | null }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const [period, setPeriod] = useState<SpendingPeriod>("This Month");
  const viewportWidth = useAppViewportWidth();
  const trendChartWidth = Math.max(286, Math.min(360, viewportWidth - 74));
  const periodTransactions = useMemo(() => filterByPeriod(transactions, period), [transactions, period]);
  const dynamicTrendRows = useMemo(() => metrics ? metricTrendRows(metrics, period) : buildTrendRows(transactions, period), [metrics, transactions, period]);
  const dynamicInsightCategories = useMemo(() => metrics ? metricSpendingRows(metrics, period).map((row) => ({ ...row, label: row.label === "Dining Out" ? "Ordering Out" : row.label })) : getInsightCategories(transactions, period), [metrics, transactions, period]);
  const dynamicMerchantInsights = useMemo(() => metrics ? metricMerchantRows(metrics, period) : getMerchantInsights(transactions, period), [metrics, transactions, period]);
  const comparison = useMemo(() => metrics ? metricComparison(metrics, period) : getPeriodComparison(transactions, period), [metrics, transactions, period]);
  const savings = useMemo(() => getFlexibleSavingsOpportunity(transactions, period), [transactions, period]);
  const recommendations = useMemo(() => getRecommendations(transactions, period), [transactions, period]);
  const topCategory = dynamicInsightCategories[0];
  const periodCopy = period === "This Month" ? "this month" : period === "Last Month" ? "last month" : "this year";
  const periodEmptyMessage = transactions.length && !periodTransactions.length
    ? `No transactions found for ${periodCopy}. Try a different period or upload a new statement.`
    : undefined;

  return (
    <section>
      <AppTopBar />
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[31px] font-extrabold leading-none tracking-[-0.045em] text-[var(--text-primary)]">Analytics</h1>
          <p className="mt-2 text-[14px] font-medium leading-snug text-[var(--text-secondary)]">Smart analysis of your spending habits.</p>
        </div>
      </div>

      <div className="mb-4 grid h-10 grid-cols-3 rounded-[15px] bg-[var(--bg-elevated)] text-[12.5px] font-semibold text-[var(--text-secondary)] shadow-sm ring-1 ring-[var(--border)]">
        {periods.map((item) => (
          <button key={item} onClick={() => setPeriod(item)} className={item === period ? "rounded-[12px] bg-[var(--accent)] px-2 text-white shadow-md shadow-[var(--accent-glow)]" : "rounded-[12px] px-2"}>
            {item}
          </button>
        ))}
      </div>

      <section className="rounded-[24px] bg-[var(--accent-soft)] p-4 shadow-[0_10px_24px_rgba(109,53,245,0.075)] ring-1 ring-[var(--accent-border)] min-[391px]:p-[18px]">
        <div className="flex items-center gap-3">
          <RobotIcon />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-[var(--accent)]">AI Insight</p>
            {topCategory ? (
              <>
                <h2 className="mt-1 text-[17px] font-extrabold leading-[1.3] tracking-[-0.02em] text-[var(--text-primary)] min-[390px]:text-[18px]">{topCategory.label} is your top category.</h2>
                <p className="mt-1.5 text-[13px] font-medium leading-[1.45] text-[var(--text-secondary)]">You&apos;ve spent QAR {formatAmount(topCategory.amount)} here {periodCopy}. Review low-confidence transactions to improve future categorization.</p>
              </>
            ) : (
              <p className="mt-1.5 text-[13px] font-medium leading-[1.45] text-[var(--text-secondary)]">No spending found for {periodCopy} yet. Upload a statement or pick a different period to see insights here.</p>
            )}
          </div>
          {topCategory ? <button onClick={() => setSheet("AI insight details")} className="hidden h-10 shrink-0 rounded-[14px] border border-[var(--accent-border)] bg-[var(--bg-surface)]/70 px-4 text-[13px] font-extrabold text-[var(--accent)] min-[430px]:block">View Details</button> : null}
        </div>
        {topCategory ? <button onClick={() => setSheet("AI insight details")} className="mt-3 h-10 rounded-[14px] border border-[var(--accent-border)] bg-[var(--bg-surface)]/70 px-4 text-[13px] font-extrabold text-[var(--accent)] min-[430px]:hidden">View Details</button> : null}
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <InsightPanel
          title="Monthly Trend"
          aside={
            comparison.hasData && comparison.percentChange !== null ? (
              <span className={comparison.percentChange >= 0 ? "text-[13px] font-bold text-[var(--danger)] sm:text-[11px]" : "text-[13px] font-bold text-[var(--success)] sm:text-[11px]"}>
                {comparison.percentChange >= 0 ? "Up" : "Down"} {Math.abs(comparison.percentChange).toFixed(1)}% vs last month
              </span>
            ) : (
              <span className="text-[12px] font-semibold text-[var(--text-muted)] sm:text-[11px]">Not enough data yet</span>
            )
          }
        >
          {dynamicTrendRows.length ? (
            <div className="mt-3 flex h-[160px] justify-center overflow-hidden">
              <SpendingTrendChart data={dynamicTrendRows} width={trendChartWidth} height={160} formatValue={(value) => `QAR ${formatAmount(value)}`} />
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] bg-[var(--bg-elevated)] px-4 py-7 text-center text-[13px] font-semibold text-[var(--text-secondary)]">
              No spending trend for {periodCopy} yet.
            </div>
          )}
        </InsightPanel>

        <InsightPanel title="Top Spending Categories" aside={<button onClick={() => setSheet("All categories")} className="h-8 shrink-0 whitespace-nowrap rounded-[10px] border border-[var(--accent-border)] px-3 text-[12px] font-extrabold text-[var(--accent)]">View All</button>}>
          {dynamicInsightCategories.length ? (
            <div className="mt-3 space-y-2.5">
              {dynamicInsightCategories.slice(0, 5).map((item, index) => (
                <button key={item.label} onClick={() => setSheet(`${item.label} category`)} className="block w-full text-left">
                  <div className="grid grid-cols-[18px_12px_minmax(86px,112px)_minmax(46px,1fr)_78px] items-center gap-2">
                    <span className="text-[12px] font-bold text-[var(--text-primary)]">{index + 1}</span>
                    <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                    <span className="min-w-0 truncate text-[12.5px] font-semibold text-[var(--text-primary)] min-[391px]:text-[13px]">{item.label}</span>
                    <span className="h-1.5 rounded-full bg-[var(--bg-elevated)]">
                      <span className="block h-full rounded-full bg-[var(--accent)]" style={{ width: `${Math.min(100, item.percent * 3.2)}%` }} />
                    </span>
                    <span className="justify-self-end whitespace-nowrap text-[11.5px] font-medium text-[var(--text-secondary)] min-[391px]:text-[12px]">QAR {formatAmount(item.amount)}</span>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] bg-[var(--bg-elevated)] px-4 py-5 text-center text-[13px] font-semibold text-[var(--text-secondary)]">
              No categorized spending for {periodCopy} yet.
            </div>
          )}
        </InsightPanel>

        <InsightPanel title="Merchant Insights" aside={<button onClick={() => setSheet("Merchant insights")} className="h-8 rounded-[10px] border border-[var(--accent-border)] px-3 text-[12px] font-extrabold text-[var(--accent)]">View All</button>}>
          {dynamicMerchantInsights.length ? (
            <div className="mt-3 divide-y ring-[var(--border)]">
              {dynamicMerchantInsights.map((item) => (
                <button key={item.merchant} onClick={() => setSheet(`${item.merchant} insight`)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-[13px] font-extrabold ${item.color}`}>
                    <MerchantLogo merchant={item.merchant} fallback={item.merchant[0]} />
                  </span>
                  <span className="min-w-0 flex-1 text-[13px] font-bold text-[var(--text-primary)]">{item.merchant}</span>
                  <span className="text-right">
                    <span className="block whitespace-nowrap text-[12px] font-semibold text-[var(--text-primary)]">QAR {formatAmount(item.amount)}</span>
                    {item.change ? (
                      <span className={item.up ? "block text-[12px] font-bold text-[var(--danger)]" : item.up === false ? "block text-[12px] font-bold text-[var(--success)]" : "block text-[12px] font-bold text-[var(--accent)]"}>
                        {item.isNew ? "New" : `${item.up ? "Up" : "Down"} ${item.change.replace("+", "").replace("-", "")}`}
                      </span>
                    ) : null}
                  </span>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-3 rounded-[16px] bg-[var(--bg-elevated)] px-4 py-5 text-center text-[13px] font-semibold text-[var(--text-secondary)]">
              No merchant spending for {periodCopy} yet.
            </div>
          )}
        </InsightPanel>

        <InsightPanel title="Smart Recommendations">
          {recommendations.length ? (
            <div className="mt-2 divide-y ring-[var(--border)]">
              {recommendations.map((item) => (
                <button key={item.id} onClick={() => setSheet(item.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-[var(--accent-soft)] text-[var(--accent)]"><WalletIcon /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[12.5px] font-extrabold text-[var(--text-primary)]">{item.title}</span>
                    <span className="mt-0.5 block text-[11px] font-medium leading-snug text-[var(--text-secondary)]">{item.body}</span>
                  </span>
                  <ChevronIcon />
                </button>
              ))}
            </div>
          ) : (
            <div className="mt-2 rounded-[16px] bg-[var(--bg-elevated)] px-4 py-5 text-center text-[13px] font-semibold text-[var(--text-secondary)]">
              Not enough data yet for {periodCopy}. Upload more transactions or try a different period.
            </div>
          )}
        </InsightPanel>

        {savings.hasEnoughData ? (
          <section className="rounded-[22px] bg-[var(--success-soft)] p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)] ring-1 ring-emerald-100">
            <div className="flex items-start gap-4">
              <div className="min-w-0 flex-1">
                <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">Savings Opportunity</h2>
                <p className="mt-3 text-[13px] font-medium text-[var(--text-secondary)]">You could save up to</p>
                <p className="mt-1 text-[30px] font-extrabold tracking-[-0.04em] text-[var(--success)]">QAR {formatAmount(savings.amount)}</p>
                <p className="text-[15px] font-bold text-[var(--success)]">{periodCopy}</p>
                <p className="mt-2 text-[13px] font-medium leading-snug text-[var(--text-secondary)]">by optimizing your spending in key categories.</p>
              </div>
              <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-[var(--bg-surface)] text-[var(--success)] shadow-sm"><WalletIcon /></div>
            </div>
            <button onClick={() => setSheet("Savings opportunity")} className="mt-4 h-10 rounded-[13px] bg-[var(--bg-surface)] px-5 text-[13px] font-extrabold text-[var(--success)] ring-1 ring-emerald-200">See How</button>
          </section>
        ) : (
          <section className="rounded-[22px] bg-[var(--bg-elevated)] p-5 ring-1 ring-[var(--border)]">
            <h2 className="text-[15px] font-extrabold text-[var(--text-primary)]">Savings Opportunity</h2>
            <p className="mt-2 text-[13px] font-medium leading-snug text-[var(--text-secondary)]">Not enough flexible spending data for {periodCopy} yet. Upload more transactions to see a personalized savings estimate.</p>
          </section>
        )}
      </div>
      <BottomSheet title={sheet} transactions={periodTransactions} onClose={() => setSheet(null)} emptyMessage={periodEmptyMessage} />
    </section>
  );
}


function useAppViewportWidth() {
  const [width, setWidth] = useState(390);

  useEffect(() => {
    const updateWidth = () => {
      const next = Math.min(window.innerWidth, 440);
      setWidth((current) => (current === next ? current : next));
    };
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}
