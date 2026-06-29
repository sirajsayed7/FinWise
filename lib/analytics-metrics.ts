import { categoryColors } from "@/lib/dashboard-constants";
import type { SpendingPeriod } from "@/lib/dashboard-types";
import type { BudgetRecord, DashboardMetrics, FinanceNotification, SpendingRow, Transaction } from "@/lib/types";

function periodMonths(metrics: DashboardMetrics, period: SpendingPeriod) {
  const latest = metrics.latestDate?.slice(0, 7);
  if (!latest) return [] as string[];
  if (period === "This Month") return [latest];
  const date = new Date(`${latest}-01T00:00:00Z`);
  if (period === "Last Month") { date.setUTCMonth(date.getUTCMonth() - 1); return [date.toISOString().slice(0, 7)]; }
  return metrics.monthlyExpenses.map((row) => row.month).sort().slice(-12);
}

export function metricSummary(metrics: DashboardMetrics) {
  return { income: metrics.totalIncome, expenses: metrics.totalExpenses, net: metrics.totalIncome - metrics.totalExpenses, balance: metrics.totalIncome - metrics.totalExpenses };
}

export function metricSpendingRows(metrics: DashboardMetrics, period: SpendingPeriod): SpendingRow[] {
  const months = new Set(periodMonths(metrics, period));
  const totals = new Map<string, number>();
  metrics.categoryTotals.filter((row) => months.has(row.month)).forEach((row) => totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount));
  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);
  return Array.from(totals, ([label, amount]) => ({ label: label === "Ordering Out" ? "Dining Out" : label, amount, percent: total ? Number((amount / total * 100).toFixed(1)) : 0, color: categoryColors[label] ?? categoryColors.Other })).sort((a, b) => b.amount - a.amount);
}

export function metricTrendRows(metrics: DashboardMetrics, period: SpendingPeriod) {
  const months = periodMonths(metrics, period);
  if (period === "Year") return metrics.monthlyExpenses.filter((row) => months.includes(row.month)).sort((a, b) => a.month.localeCompare(b.month)).map((row) => ({ date: row.month, amount: row.amount }));
  const month = months[0];
  if (!month) return [];
  const rows = metrics.dailyExpenses.filter((row) => row.date.startsWith(month));
  return [1, 8, 15, 22, 30].map((day) => ({ date: `${month.slice(5)}-${day}`, amount: rows.filter((row) => Number(row.date.slice(8, 10)) <= day).reduce((sum, row) => sum + row.amount, 0) }));
}

export function metricMerchantRows(metrics: DashboardMetrics, period: SpendingPeriod) {
  const months = new Set(periodMonths(metrics, period));
  const totals = new Map<string, { amount: number; count: number }>();
  metrics.merchantTotals.filter((row) => months.has(row.month)).forEach((row) => { const current = totals.get(row.merchant) ?? { amount: 0, count: 0 }; totals.set(row.merchant, { amount: current.amount + row.amount, count: current.count + row.count }); });
  return Array.from(totals, ([merchant, value]) => ({ merchant, ...value, change: undefined as string | undefined, up: undefined as boolean | undefined, isNew: false, color: "bg-violet-50 text-violet-600" })).sort((a, b) => b.amount - a.amount).slice(0, 10);
}

export function metricComparison(metrics: DashboardMetrics, period: SpendingPeriod) {
  const current = periodMonths(metrics, period)[0];
  if (!current || period === "Year") return { percentChange: null as number | null, hasData: false };
  const date = new Date(`${current}-01T00:00:00Z`); date.setUTCMonth(date.getUTCMonth() - 1);
  const previous = date.toISOString().slice(0, 7);
  const currentTotal = metrics.monthlyExpenses.find((row) => row.month === current)?.amount ?? 0;
  const previousTotal = metrics.monthlyExpenses.find((row) => row.month === previous)?.amount ?? 0;
  return previousTotal ? { percentChange: (currentTotal - previousTotal) / previousTotal * 100, hasData: true } : { percentChange: null, hasData: false };
}

export function buildFinanceNotifications(transactions: Transaction[], budgets: BudgetRecord[], metrics: DashboardMetrics): FinanceNotification[] {
  const notifications: FinanceNotification[] = [];
  const currentRows = metricSpendingRows(metrics, "This Month");
  for (const budget of budgets) {
    const spent = currentRows.find((row) => row.label === budget.category || (row.label === "Dining Out" && budget.category === "Ordering Out"))?.amount ?? 0;
    if (spent >= budget.amount * 0.8) notifications.push({ id: `budget-${budget.category}`, type: "budget", severity: spent > budget.amount ? "critical" : "warning", title: spent > budget.amount ? `${budget.category} budget exceeded` : `${budget.category} budget nearly reached`, body: `QAR ${spent.toFixed(2)} spent of QAR ${budget.amount.toFixed(2)}.` });
  }
  const expenses = transactions.filter((row) => row.direction === "expense");
  const average = expenses.length ? expenses.reduce((sum, row) => sum + row.amount, 0) / expenses.length : 0;
  expenses.filter((row) => row.amount > Math.max(500, average * 3)).slice(0, 3).forEach((row) => notifications.push({ id: `unusual-${row.id}`, type: "unusual", severity: "warning", title: "Unusual transaction", body: `${row.merchant}: QAR ${row.amount.toFixed(2)} on ${row.date}.` }));
  const recurring = new Map<string, number>();
  expenses.filter((row) => row.category === "Bills" || row.category === "Subscriptions").forEach((row) => recurring.set(row.merchant, (recurring.get(row.merchant) ?? 0) + 1));
  Array.from(recurring).filter(([, count]) => count >= 2).slice(0, 3).forEach(([merchant, count]) => notifications.push({ id: `recurring-${merchant}`, type: "recurring", severity: "info", title: "Recurring payment detected", body: `${merchant} appeared ${count} times in your loaded history.` }));
  return notifications;
}
