"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { AlertTriangle, Bell, PiggyBank, Repeat2, Sparkles, Target, Trash2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AppTopBar, PageHeader } from "@/components/finwise/ui";
import { categories } from "@/lib/categorization";
import type { ActiveView } from "@/lib/dashboard-types";
import type { BudgetRecord, DashboardMetrics, FinanceNotification, FinancialGoal } from "@/lib/types";

const budgetSchema = z.object({ category: z.string().min(1), amount: z.number().positive(), period: z.enum(["monthly", "weekly"]) });
const goalSchema = z.object({ name: z.string().min(2).max(60), targetAmount: z.number().positive(), currentAmount: z.number().min(0), targetDate: z.string().optional() });
type BudgetForm = z.infer<typeof budgetSchema>;
type GoalForm = z.infer<typeof goalSchema>;

export function PlanningPage({ budgets, goals, metrics, setActiveView, onSaveBudget, onDeleteBudget, onSaveGoal, onDeleteGoal }: { budgets: BudgetRecord[]; goals: FinancialGoal[]; metrics: DashboardMetrics | null; setActiveView: (view: ActiveView) => void; onSaveBudget: (budget: BudgetRecord) => void; onDeleteBudget: (budget: BudgetRecord) => void; onSaveGoal: (goal: FinancialGoal) => void; onDeleteGoal: (id: string) => void }) {
  const budgetForm = useForm<BudgetForm>({ resolver: zodResolver(budgetSchema), defaultValues: { category: "Groceries", amount: 1000, period: "monthly" } });
  const goalForm = useForm<GoalForm>({ resolver: zodResolver(goalSchema), defaultValues: { name: "", targetAmount: 10000, currentAmount: 0, targetDate: "" } });
  return <section>
    <AppTopBar />
    <PageHeader title="Budgets & Goals" subtitle="Plan spending limits and track what you are building toward." />
    <div className="grid gap-4">
      <section className="fin-card">
        <div className="flex items-center gap-3"><span className="fin-icon bg-[var(--accent-soft)] text-violet-600"><PiggyBank size={22} /></span><div><h2 className="fin-title">Monthly budgets</h2><p className="fin-copy">Get alerted before a category crosses its limit.</p></div></div>
        <form className="mt-4 grid gap-3" onSubmit={budgetForm.handleSubmit((value) => onSaveBudget({ category: value.category as BudgetRecord["category"], amount: value.amount, period: value.period, currency: "QAR" }))}>
          <label className="fin-label">Category<select className="fin-input" {...budgetForm.register("category")}>{categories.filter((item) => item !== "Salary / Income").map((item) => <option key={item}>{item}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3"><label className="fin-label">Amount<input className="fin-input" inputMode="decimal" {...budgetForm.register("amount", { valueAsNumber: true })} /></label><label className="fin-label">Period<select className="fin-input" {...budgetForm.register("period")}><option value="monthly">Monthly</option><option value="weekly">Weekly</option></select></label></div>
          <button className="fin-primary" type="submit">Save budget</button>
        </form>
        <div className="mt-4 grid gap-2">{budgets.length ? budgets.map((budget) => { const spent = metrics?.categoryTotals.filter((row) => row.month === metrics.latestDate?.slice(0, 7) && row.category === budget.category).reduce((sum, row) => sum + row.amount, 0) ?? 0; const progress = Math.min(100, budget.amount ? spent / budget.amount * 100 : 0); return <article key={`${budget.category}-${budget.period}`} className="rounded-[17px] bg-[var(--bg-surface)] p-3 ring-1 ring-[var(--border)]"><div className="flex items-center justify-between gap-3"><div><p className="text-[14px] font-extrabold text-[var(--text-primary)]">{budget.category}</p><p className="text-[12px] font-semibold text-[var(--text-secondary)]">QAR {spent.toFixed(2)} of QAR {budget.amount.toFixed(2)}</p></div><button aria-label={`Delete ${budget.category} budget`} onClick={() => onDeleteBudget(budget)} className="fin-icon text-[var(--danger)]"><Trash2 size={18} /></button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[var(--bg-elevated)]"><div className={progress >= 100 ? "h-full bg-[var(--danger)]" : progress >= 80 ? "h-full bg-[var(--warning)]" : "h-full bg-violet-600"} style={{ width: `${progress}%` }} /></div></article>; }) : <Empty text="No budgets yet." />}</div>
      </section>
      <section className="fin-card">
        <div className="flex items-center gap-3"><span className="fin-icon bg-[var(--success-soft)] text-[var(--success)]"><Target size={22} /></span><div><h2 className="fin-title">Financial goals</h2><p className="fin-copy">Track savings targets with clear progress.</p></div></div>
        <form className="mt-4 grid gap-3" onSubmit={goalForm.handleSubmit((value) => { onSaveGoal({ id: crypto.randomUUID(), name: value.name, targetAmount: value.targetAmount, currentAmount: value.currentAmount, targetDate: value.targetDate || null }); goalForm.reset(); })}>
          <label className="fin-label">Goal name<input className="fin-input" placeholder="Emergency fund" {...goalForm.register("name")} /></label>
          <div className="grid grid-cols-2 gap-3"><label className="fin-label">Target<input className="fin-input" inputMode="decimal" {...goalForm.register("targetAmount", { valueAsNumber: true })} /></label><label className="fin-label">Saved<input className="fin-input" inputMode="decimal" {...goalForm.register("currentAmount", { valueAsNumber: true })} /></label></div>
          <label className="fin-label">Target date<input className="fin-input" type="date" {...goalForm.register("targetDate")} /></label>
          <button className="fin-primary" type="submit">Add goal</button>
        </form>
        <div className="mt-4 grid gap-2">{goals.length ? goals.map((goal) => { const progress = Math.min(100, goal.currentAmount / goal.targetAmount * 100); return <article key={goal.id} className="rounded-[17px] bg-[var(--success-soft)]/60 p-3 ring-1 ring-emerald-100"><div className="flex items-start justify-between"><div><p className="text-[14px] font-extrabold">{goal.name}</p><p className="text-[12px] font-semibold text-[var(--text-secondary)]">{progress.toFixed(0)}% ? QAR {goal.currentAmount.toFixed(2)} / {goal.targetAmount.toFixed(2)}</p></div><button aria-label={`Delete ${goal.name}`} onClick={() => onDeleteGoal(goal.id)} className="fin-icon text-[var(--danger)]"><Trash2 size={18} /></button></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-emerald-100"><div className="h-full bg-[var(--success-soft)]0" style={{ width: `${progress}%` }} /></div></article>; }) : <Empty text="No goals yet." />}</div>
      </section>
      <button className="fin-secondary" onClick={() => setActiveView("settings")}>Back to settings</button>
    </div>
  </section>;
}

export function NotificationsPage({ notifications, setActiveView }: { notifications: FinanceNotification[]; setActiveView: (view: ActiveView) => void }) {
  const icons = { budget: PiggyBank, recurring: Repeat2, unusual: AlertTriangle, sync: Sparkles };
  return <section><AppTopBar /><PageHeader title="Notifications" subtitle="Important activity from your financial data." /><div className="grid gap-3">{notifications.length ? notifications.map((item) => { const Icon = icons[item.type] ?? Bell; return <article key={item.id} className="fin-card flex items-start gap-3"><span className={item.severity === "critical" ? "fin-icon bg-[var(--danger-soft)] text-[var(--danger)]" : item.severity === "warning" ? "fin-icon bg-[var(--warning-soft)] text-[var(--warning)]" : "fin-icon bg-[var(--accent-soft)] text-violet-600"}><Icon size={21} /></span><div><h2 className="text-[15px] font-extrabold">{item.title}</h2><p className="mt-1 text-[13px] font-medium leading-relaxed text-[var(--text-secondary)]">{item.body}</p></div></article>; }) : <section className="fin-card py-10 text-center"><Bell className="mx-auto text-violet-500" /><h2 className="mt-3 fin-title">You are all caught up</h2><p className="fin-copy">New budget, recurring payment, and unusual spending alerts will appear here.</p></section>}</div><button className="fin-secondary mt-4" onClick={() => setActiveView("home")}>Back to home</button></section>;
}

function Empty({ text }: { text: string }) { return <p className="rounded-[16px] bg-[var(--bg-elevated)] px-4 py-5 text-center text-[13px] font-semibold text-[var(--text-muted)]">{text}</p>; }
