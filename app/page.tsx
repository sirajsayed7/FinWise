"use client";

import { useEffect, useMemo, useRef, useState, type ChangeEvent, type ReactNode } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import * as Dialog from "@radix-ui/react-dialog";
import { AnimatePresence, motion } from "framer-motion";
import { Area, AreaChart, CartesianGrid, Cell, Pie, PieChart, Tooltip, XAxis, YAxis } from "recharts";
import type { User } from "@supabase/supabase-js";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { categories } from "@/lib/categorization";
import { demoTransactions } from "@/lib/demo-data";
import { loadFinWiseData, saveFinWiseData, loadMerchantLogoOverrides, saveMerchantLogoOverrides } from "@/lib/finwise-db";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-client";
import type { MerchantLogoRecord, MerchantRule, Transaction } from "@/lib/types";
import { cn } from "@/lib/utils";

type ActiveView = "home" | "transactions" | "upload" | "insights" | "settings" | "statements";
type SpendingPeriod = "This Month" | "Last Month" | "Year";

type SpendingRow = {
  label: string;
  amount: number;
  percent: number;
  color: string;
};

type StatementPeriodInfo = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

type StatementSummary = {
  id: string;
  fileName: string;
  bank: string;
  status: "processed" | "failed" | "review";
  uploadedAt: string;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  period: StatementPeriodInfo;
  needsReview: number;
};

const authSchema = z.object({
  fullName: z.string().trim().max(60, "Name must be 60 characters or less.").optional(),
  email: z.string().trim().email("Enter a valid email address."),
  password: z.string().min(6, "Password must be at least 6 characters.")
});

type AuthFormFields = z.infer<typeof authSchema>;

const spendingByPeriod: Record<SpendingPeriod, SpendingRow[]> = {
  "This Month": [
    { label: "Groceries", amount: 2420.5, percent: 28.6, color: "#22C55E" },
    { label: "Dining Out", amount: 1850.75, percent: 21.9, color: "#F97316" },
    { label: "Shopping", amount: 1560.3, percent: 18.5, color: "#3B82F6" },
    { label: "Transport", amount: 1230.4, percent: 14.6, color: "#06B6D4" },
    { label: "Bills", amount: 1391.3, percent: 16.4, color: "#7C3AED" }
  ],
  "Last Month": [
    { label: "Groceries", amount: 2190.25, percent: 30.4, color: "#22C55E" },
    { label: "Dining Out", amount: 1420.1, percent: 19.7, color: "#F97316" },
    { label: "Shopping", amount: 1205.65, percent: 16.7, color: "#3B82F6" },
    { label: "Transport", amount: 980.2, percent: 13.6, color: "#06B6D4" },
    { label: "Bills", amount: 1412.45, percent: 19.6, color: "#7C3AED" }
  ],
  Year: [
    { label: "Groceries", amount: 14220.5, percent: 27.2, color: "#22C55E" },
    { label: "Dining Out", amount: 10940.75, percent: 20.9, color: "#F97316" },
    { label: "Shopping", amount: 9650.3, percent: 18.5, color: "#3B82F6" },
    { label: "Transport", amount: 7820.4, percent: 15, color: "#06B6D4" },
    { label: "Bills", amount: 9625.8, percent: 18.4, color: "#7C3AED" }
  ]
};

const periods: SpendingPeriod[] = ["This Month", "Last Month", "Year"];

const categoryColors: Record<string, string> = {
  Groceries: "#22C55E",
  "Ordering Out": "#F97316",
  "Restaurants & Cafes": "#FB923C",
  Transport: "#06B6D4",
  Fuel: "#F59E0B",
  Shopping: "#3B82F6",
  Malls: "#7C3AED",
  Bills: "#8B5CF6",
  Subscriptions: "#D946EF",
  Rent: "#64748B",
  Health: "#14B8A6",
  Entertainment: "#0EA5E9",
  "Cash Withdrawal": "#94A3B8",
  "Bank Transfer": "#64748B",
  "Salary / Income": "#10B981",
  Other: "#CBD5E1"
};

const categoryAvatarStyles: Record<string, string> = {
  Groceries: "bg-emerald-50 text-emerald-600",
  "Ordering Out": "bg-orange-500 text-white",
  "Restaurants & Cafes": "bg-orange-50 text-orange-600",
  Transport: "bg-cyan-50 text-cyan-600",
  Fuel: "bg-amber-50 text-amber-600",
  Shopping: "bg-blue-50 text-blue-600",
  Malls: "bg-violet-50 text-violet-600",
  Bills: "bg-purple-50 text-purple-600",
  Subscriptions: "bg-fuchsia-50 text-fuchsia-600",
  Rent: "bg-slate-100 text-slate-600",
  Health: "bg-teal-50 text-teal-600",
  Entertainment: "bg-sky-50 text-sky-600",
  "Cash Withdrawal": "bg-slate-100 text-slate-600",
  "Bank Transfer": "bg-slate-100 text-slate-600",
  "Salary / Income": "bg-emerald-50 text-emerald-600",
  Other: "bg-slate-100 text-slate-600"
};

const monthlyGroups = [
  {
    month: "June 2026",
    count: 42,
    rows: [
      { merchant: "Carrefour City Center Doha", detail: "Groceries and household items", category: "Groceries", amount: 156.75, direction: "expense", account: "QNB Visa **** 2456", logo: "C", color: "bg-blue-50 text-blue-600" },
      { merchant: "Talabat Food Delivery", detail: "Lunch order", category: "Dining Out", amount: 42.5, direction: "expense", account: "QNB Visa **** 2456", logo: "t", color: "bg-orange-500 text-white" },
      { merchant: "Salary Credit", detail: "June 2026 Salary", category: "Income", amount: 7500, direction: "income", account: "QNB Salary **** 9999", logo: "S", color: "bg-emerald-50 text-emerald-500" }
    ]
  },
  {
    month: "May 2026",
    count: 38,
    rows: [
      { merchant: "Uber Ride", detail: "Ride to West Bay", category: "Transport", amount: 28, direction: "expense", account: "QNB Visa **** 2456", logo: "U", color: "bg-slate-900 text-white" },
      { merchant: "Netflix Subscription", detail: "Premium Plan", category: "Subscriptions", amount: 42, direction: "expense", account: "QNB Visa **** 2456", logo: "N", color: "bg-red-50 text-red-600" }
    ]
  },
  {
    month: "April 2026",
    count: 35,
    rows: [
      { merchant: "Apple Services", detail: "iCloud+ 200GB", category: "Subscriptions", amount: 13.99, direction: "expense", account: "QNB Visa **** 2456", logo: "A", color: "bg-slate-100 text-slate-600" }
    ]
  }
];

const insightCategories = [
  { label: "Groceries", amount: 1927.4, percent: 22.8, color: "#6D35F5" },
  { label: "Ordering Out", amount: 1783.6, percent: 21.1, color: "#F97316" },
  { label: "Shopping", amount: 1378.75, percent: 16.3, color: "#94A3B8" },
  { label: "Transport", amount: 1073.6, percent: 12.7, color: "#22C55E" },
  { label: "Bills & Utilities", amount: 972.3, percent: 11.5, color: "#06B6D4" },
  { label: "Entertainment", amount: 608.6, percent: 7.2, color: "#0EA5E9" },
  { label: "Others", amount: 709, percent: 8.4, color: "#CBD5E1" }
];

const merchantInsights = [
  { merchant: "Carrefour", amount: 1245.5, change: "+35%", up: true, color: "bg-blue-50 text-blue-600" },
  { merchant: "Talabat", amount: 1102.3, change: "+32%", up: true, color: "bg-orange-500 text-white" },
  { merchant: "Lulu Hypermarket", amount: 897.45, change: "-5%", up: false, color: "bg-emerald-50 text-emerald-600" },
  { merchant: "Uber", amount: 542.2, change: "+12%", up: true, color: "bg-slate-900 text-white" }
];

const merchantLogoDomains = [
  { keywords: ["qnb"], domain: "qnb.com" },
  { keywords: ["doha bank", "dobank"], domain: "dohabank.com.qa" },
  { keywords: ["dukhan bank"], domain: "dukhanbank.com" },
  { keywords: ["qatar university", "mens campus", "men's campus", "men campus"], domain: "qu.edu.qa" },
  { keywords: ["reverse", "reversal", "refund"], domain: "dohabank.com.qa" },
  { keywords: ["carrefour"], domain: "carrefour.com" },
  { keywords: ["talabat"], domain: "talabat.com" },
  { keywords: ["lulu", "lulu hypermarket"], domain: "luluhypermarket.com" },
  { keywords: ["uber"], domain: "uber.com" },
  { keywords: ["netflix"], domain: "netflix.com" },
  { keywords: ["apple"], domain: "apple.com" },
  { keywords: ["amazon"], domain: "amazon.com" },
  { keywords: ["ooredoo"], domain: "ooredoo.qa" },
  { keywords: ["vodafone"], domain: "vodafone.qa" },
  { keywords: ["snoonu"], domain: "snoonu.com" },
  { keywords: ["monoprix"], domain: "monoprix.qa" },
  { keywords: ["woqod", "waqood", "petroleum", "petrol", "fuel"], domain: "woqod.com" },
  { keywords: ["tea time", "teatime", "team time"], domain: "teatime.qa" },
  { keywords: ["max fashion", "max"], domain: "maxfashion.com" },
  { keywords: ["new yorker", "newyorker"], domain: "newyorker.de" },
  { keywords: ["temu"], domain: "temu.com" },
  { keywords: ["karak mqanes", "mqanes"], domain: "karakmqanes.com" },
  { keywords: ["food world"], domain: "foodworldqatar.com" },
  { keywords: ["indian super market", "indian supermarket"], domain: "indiansupermarketqatar.com" },
  { keywords: ["eat time", "eattime", "eat time dukhan"], domain: "teatime.qa" },
  { keywords: ["jawahar"], domain: "jawaharrestaurant.com" },
  { keywords: ["starbucks"], domain: "starbucks.com" },
  { keywords: ["mcdonald"], domain: "mcdonalds.com" },
  { keywords: ["spotify"], domain: "spotify.com" },
  { keywords: ["youtube"], domain: "youtube.com" }
];

const trendRows = [
  { date: "Jun 1", amount: 900 },
  { date: "Jun 8", amount: 3400 },
  { date: "Jun 15", amount: 6100 },
  { date: "Jun 22", amount: 7600 },
  { date: "Jun 30", amount: 9450 }
];

type LocalSnapshot = {
  transactions: Transaction[];
  latestPeriod: StatementPeriodInfo | null;
  savedAt: string;
};

type PendingImport = {
  statementId?: string;
  fileName: string;
  period: StatementPeriodInfo | null;
  transactions: Transaction[];
};

type PendingTransactionPatch = Partial<Pick<Transaction, "date" | "merchant" | "category" | "amount" | "direction">>;

export default function FinWiseApp() {
  const [activeView, setActiveView] = useState<ActiveView>("home");
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [uploadStatus, setUploadStatus] = useState("No uploads yet");
  const [latestPeriod, setLatestPeriod] = useState<StatementPeriodInfo | null>(null);
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured);
  const [authUser, setAuthUser] = useState<User | null>(null);
  const [cloudLoaded, setCloudLoaded] = useState(!isSupabaseConfigured);
  const [syncStatus, setSyncStatus] = useState(isSupabaseConfigured ? "Connect your account" : "Local mode");
  const [pendingImport, setPendingImport] = useState<PendingImport | null>(null);
  const [merchantLogoOverrides, setMerchantLogoOverrides] = useState<MerchantLogoRecord[]>([]);
  const userChangedDataRef = useRef(false);
  const displayName = getUserDisplayName(authUser);
  const transactionCount = transactions.length;

  useEffect(() => {
    if (isSupabaseConfigured) return;
    const saved = window.localStorage.getItem("finwise.transactions");
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as Transaction[];
      if (Array.isArray(parsed) && parsed.length > 0) {
        const clean = dedupe(sanitizeTransactions(parsed));
        setTransactions(clean);
        setUploadStatus(clean.length ? `${clean.length} transactions` : "No uploads yet");
      }
      const savedPeriod = window.localStorage.getItem("finwise.latestPeriod");
      if (savedPeriod) setLatestPeriod(JSON.parse(savedPeriod) as StatementPeriodInfo);
    } catch {
      window.localStorage.removeItem("finwise.transactions");
      window.localStorage.removeItem("finwise.latestPeriod");
    }
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    window.localStorage.setItem("finwise.transactions", JSON.stringify(transactions));
    if (latestPeriod) window.localStorage.setItem("finwise.latestPeriod", JSON.stringify(latestPeriod));
  }, [transactions, latestPeriod]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setAuthUser(data.session?.user ?? null);
      setAuthReady(true);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthUser(session?.user ?? null);
      setAuthReady(true);
      setCloudLoaded(!session?.user);
      if (!session?.user) {
        setTransactions([]);
        setLatestPeriod(null);
        setUploadStatus("No uploads yet");
        setSyncStatus("Signed out");
      }
    });

    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !authUser) return;

    let cancelled = false;
    const localSnapshot = loadLocalSnapshot(authUser.id);
    if (localSnapshot?.transactions.length) {
      const cleanLocal = dedupe(sanitizeTransactions(localSnapshot.transactions));
      setTransactions(cleanLocal);
      setLatestPeriod(localSnapshot.latestPeriod);
      setUploadStatus(`${cleanLocal.length} transactions`);
    }

    setSyncStatus("Loading account data...");
    loadCloudData(authUser.id).then(async (data) => {
      if (cancelled) return;
      const clean = dedupe(sanitizeTransactions(data?.transactions ?? []));
      const localRules = data?.merchant_rules ?? [];
      const fallback = clean.length ? null : localSnapshot;
      const nextTransactions = clean.length ? clean : dedupe(sanitizeTransactions(fallback?.transactions ?? []));
      const nextPeriod = data?.latest_period ?? fallback?.latestPeriod ?? null;
      const logoOverrides = await loadMerchantLogoOverrides(authUser.id);
      setTransactions(nextTransactions);
      setLatestPeriod(nextPeriod);
      setMerchantLogoOverrides(logoOverrides);
      setUploadStatus(nextTransactions.length ? `${nextTransactions.length} transactions` : "No uploads yet");
      window.localStorage.setItem("finwise.merchantRules", JSON.stringify(localRules));
      cacheMerchantLogoOverrides(logoOverrides);
      setCloudLoaded(true);
      setSyncStatus(clean.length ? "Synced" : nextTransactions.length ? "Loaded from this device" : "Ready for first upload");
    }).catch(() => {
      if (cancelled) return;
      setCloudLoaded(true);
      setSyncStatus(localSnapshot?.transactions.length ? "Loaded from this device" : "Cloud sync unavailable");
    });

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authUser || !cloudLoaded) return;
    if (transactions.length || latestPeriod) {
      saveLocalSnapshot(authUser.id, transactions, latestPeriod);
    }
    if (!userChangedDataRef.current) return;
    saveCloudData(authUser.id, transactions, latestPeriod).then((ok) => {
      setSyncStatus(ok ? "Synced" : "Sync failed");
      if (ok) userChangedDataRef.current = false;
    });
  }, [transactions, latestPeriod, authUser, cloudLoaded]);

  useEffect(() => {
    if (!transactions.length) return;
    const merchants = Array.from(new Set(transactions.map((transaction) => transaction.merchant).filter(Boolean))).slice(0, 80);
    for (const merchant of merchants) {
      for (const url of getMerchantLogoUrls(merchant)) {
        const image = new Image();
        image.decoding = "async";
        image.src = url;
      }
    }
  }, [transactions]);

  function clearUploads() {
    userChangedDataRef.current = true;
    setTransactions([]);
    setLatestPeriod(null);
    setPendingImport(null);
    setUploadStatus("No uploads yet");
    window.localStorage.removeItem("finwise.transactions");
    window.localStorage.removeItem("finwise.latestPeriod");
    if (authUser) window.localStorage.removeItem(getLocalSnapshotKey(authUser.id));
    toast.success("Imported data cleared", {
      description: "Your dashboard is ready for a fresh statement."
    });
  }

  function clearStatement(statementId: string) {
    userChangedDataRef.current = true;
    const nextTransactions = transactions.filter((transaction) => transaction.statementId !== statementId);
    setTransactions(nextTransactions);
    const nextLatest = getLatestPeriodFromTransactions(nextTransactions);
    setLatestPeriod(nextLatest);
    if (nextLatest) window.localStorage.setItem("finwise.latestPeriod", JSON.stringify(nextLatest));
    else window.localStorage.removeItem("finwise.latestPeriod");
    setUploadStatus(nextTransactions.length ? `${nextTransactions.length} transactions` : "No uploads yet");
    toast.success("Statement removed", {
      description: nextTransactions.length ? `${nextTransactions.length} transactions remain.` : "No imported transactions remain."
    });
  }

  async function signOut() {
    const supabase = getSupabase();
    await supabase?.auth.signOut();
  }

  async function uploadStatement(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append("file", file);
    formData.append("bank", "QNB");
    formData.append("keepOriginal", "false");
    formData.append("rules", window.localStorage.getItem("finwise.merchantRules") ?? "[]");
    setUploadStatus("Uploading and categorizing...");

    let response: Response;
    let payload: {
      error?: string;
      transactions?: Transaction[];
      statement?: {
        id?: string;
        fileName?: string;
        fileHash?: string;
        status?: string;
        transactionCount?: number;
        period?: StatementPeriodInfo;
      };
    };
    try {
      response = await fetch("/api/statements", { method: "POST", body: formData });
      payload = await response.json();
    } catch {
      setUploadStatus("Upload failed. Please try again with a PDF, CSV, or Excel statement.");
      toast.error("Upload failed", {
        description: "Please try again with a PDF, CSV, or Excel statement."
      });
      return;
    }

    if (!response.ok) {
      setUploadStatus(payload.error ?? "Upload failed");
      toast.error("Upload failed", {
        description: payload.error ?? "The statement could not be processed."
      });
      return;
    }

    const imported = sanitizeTransactions(payload.transactions ?? []);
    const statementId = payload.statement?.id ?? imported[0]?.statementId;
    if (!imported.length) {
      setUploadStatus("No usable transactions found after filtering balances and summary rows.");
      toast.warning("No transactions found", {
        description: "FinWise filtered out balances and summary rows, but found no usable transactions."
      });
      event.target.value = "";
      return;
    }
    setPendingImport({
      statementId,
      fileName: payload.statement?.fileName ?? file.name,
      period: payload.statement?.period ?? null,
      transactions: imported
    });
    const duplicateExists = Boolean(statementId && transactions.some((transaction) => transaction.statementId === statementId));
    setUploadStatus(duplicateExists ? `${imported.length} transactions ready. Confirm to replace the existing statement.` : `${imported.length} transactions ready for review`);
    toast.success("Statement ready for review", {
      description: `${imported.length} transactions detected.`
    });
    event.target.value = "";
    setActiveView("upload");
  }

  function confirmPendingImport() {
    if (!pendingImport) return;
    const imported = sanitizeTransactions(pendingImport.transactions);
    const statementId = pendingImport.statementId ?? imported[0]?.statementId;
    userChangedDataRef.current = true;
    const nextLogoOverrides = mergeLogoOverrides(merchantLogoOverrides, imported);
    setMerchantLogoOverrides(nextLogoOverrides);
    cacheMerchantLogoOverrides(nextLogoOverrides);
    if (authUser) {
      saveMerchantLogoOverrides(authUser.id, nextLogoOverrides);
    }
    setTransactions((current) => {
      const nextTransactions = dedupe([...imported, ...current.filter((transaction) => transaction.statementId !== statementId)]);
      if (authUser) saveLocalSnapshot(authUser.id, nextTransactions, pendingImport.period);
      return nextTransactions;
    });
    setUploadStatus(`${imported.length} transactions saved`);
    toast.success("Import saved", {
      description: `${imported.length} transactions were added to your dashboard.`
    });
    if (pendingImport.period) {
      setLatestPeriod(pendingImport.period);
      window.localStorage.setItem("finwise.latestPeriod", JSON.stringify(pendingImport.period));
    }
    setPendingImport(null);
    setActiveView("transactions");
  }

  function removePendingTransaction(transactionId: string) {
    setPendingImport((current) => {
      if (!current) return current;
      const nextTransactions = current.transactions.filter((transaction) => transaction.id !== transactionId);
      return { ...current, transactions: nextTransactions };
    });
  }

  function updatePendingTransaction(transactionId: string, patch: PendingTransactionPatch) {
    setPendingImport((current) => {
      if (!current) return current;
      return {
        ...current,
        transactions: current.transactions.map((transaction) => {
          if (transaction.id !== transactionId) return transaction;
          const next = {
            ...transaction,
            ...patch,
            amount: patch.amount !== undefined ? Math.max(0, patch.amount) : transaction.amount,
            subcategory: patch.category ?? transaction.subcategory
          };
          return {
            ...next,
            merchant: next.merchant.trim() || transaction.merchant
          };
        })
      };
    });
  }

  function updateTransactions(next: Transaction[] | ((current: Transaction[]) => Transaction[])) {
    userChangedDataRef.current = true;
    setTransactions(next);
  }

  if (!authReady) {
    return <LoadingScreen />;
  }

  if (isSupabaseConfigured && !authUser) {
    return <AuthScreen />;
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] text-[#111827]">
      <div className="mx-auto flex min-h-screen w-full max-w-[440px] flex-col bg-[#FAFBFF] px-4 pb-[calc(108px+env(safe-area-inset-bottom))] pt-[calc(14px+env(safe-area-inset-top))] min-[391px]:px-[18px] sm:my-5 sm:rounded-[34px] sm:border sm:border-white sm:shadow-2xl sm:shadow-slate-300/50">
        {activeView === "home" ? (
          <HomeDashboard displayName={displayName} transactions={transactions} latestPeriod={latestPeriod} uploadStatus={uploadStatus} transactionCount={transactionCount} onUpload={uploadStatement} setActiveView={setActiveView} />
        ) : null}
        {activeView === "transactions" ? <TransactionsPage transactions={transactions} setTransactions={updateTransactions} setActiveView={setActiveView} onClearUploads={clearUploads} /> : null}
        {activeView === "upload" ? <UploadPage latestPeriod={latestPeriod} uploadStatus={uploadStatus} onUpload={uploadStatement} onClearUploads={clearUploads} hasUploads={transactionCount > 0} pendingImport={pendingImport} onConfirmImport={confirmPendingImport} onCancelImport={() => setPendingImport(null)} onRemovePendingTransaction={removePendingTransaction} onUpdatePendingTransaction={updatePendingTransaction} /> : null}
        {activeView === "insights" ? <InsightsPage transactions={transactions} /> : null}
        {activeView === "settings" ? <SettingsPage setActiveView={setActiveView} authEmail={authUser?.email ?? null} syncStatus={syncStatus} onSignOut={signOut} /> : null}
        {activeView === "statements" ? <StatementsPageV2 transactions={transactions} latestPeriod={latestPeriod} setActiveView={setActiveView} onClearUploads={clearUploads} onClearStatement={clearStatement} /> : null}
      </div>
      <BottomNavigation activeView={activeView} setActiveView={setActiveView} />
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="grid min-h-screen place-items-center bg-[#F8FAFC] px-5 text-[#0F172A]">
      <section className="w-full max-w-[420px] rounded-[28px] bg-white p-6 text-center shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)]">
        <div className="mx-auto mb-4 flex items-center justify-center gap-2">
          <LogoMark />
          <span className="text-[24px] font-extrabold tracking-[-0.035em]">FinWise</span>
        </div>
        <p className="text-[14px] font-semibold text-[#64748B]">Loading your secure workspace...</p>
      </section>
    </main>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [status, setStatus] = useState("");
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm<AuthFormFields>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      fullName: "",
      email: "",
      password: ""
    }
  });

  async function submitAuth(values: AuthFormFields) {
    const supabase = getSupabase();
    if (!supabase) return;
    setStatus("");

    const result = mode === "login"
      ? await supabase.auth.signInWithPassword({ email: values.email, password: values.password })
      : await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            emailRedirectTo: window.location.origin,
            data: {
              full_name: values.fullName?.trim() || values.email.split("@")[0]
            }
          }
        });

    if (result.error) {
      setStatus(result.error.message);
      return;
    }
    setStatus(mode === "signup" ? "Account created. Check your email if confirmation is enabled." : "Signed in.");
  }

  return (
    <main className="min-h-screen bg-[#F8FAFC] px-5 py-[calc(28px+env(safe-area-inset-top))] text-[#0F172A]">
      <section className="mx-auto flex min-h-[calc(100vh-56px)] w-full max-w-[430px] flex-col justify-center">
        <div className="mb-8 flex items-center gap-2.5">
          <LogoMark />
          <span className="text-[27px] font-extrabold tracking-[-0.04em]">FinWise</span>
        </div>
        <div className="rounded-[30px] bg-white p-6 shadow-[0_18px_44px_rgba(15,23,42,0.08)] ring-1 ring-[rgba(15,23,42,0.06)]">
          <p className="text-[13px] font-extrabold uppercase tracking-[0.14em] text-[#6D35F5]">Secure finance dashboard</p>
          <h1 className="mt-3 text-[32px] font-extrabold leading-tight tracking-[-0.055em]">{mode === "login" ? "Sign in to your account" : "Sign up for FinWise"}</h1>
          <p className="mt-2 text-[14px] font-medium leading-relaxed text-[#64748B]">Each account has its own statements, transactions, merchant rules, and saved logos.</p>

          <form onSubmit={handleSubmit(submitAuth)} className="mt-6 grid gap-3">
            {mode === "signup" ? (
              <label className="grid gap-1.5">
                <span className="text-[12px] font-bold text-[#475569]">Full name</span>
                <input {...register("fullName")} type="text" autoComplete="name" placeholder="Your name" className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
                {errors.fullName ? <span className="text-[11.5px] font-bold text-red-500">{errors.fullName.message}</span> : null}
              </label>
            ) : null}
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold text-[#475569]">Email</span>
              <input {...register("email")} type="email" autoComplete="email" className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
              {errors.email ? <span className="text-[11.5px] font-bold text-red-500">{errors.email.message}</span> : null}
            </label>
            <label className="grid gap-1.5">
              <span className="text-[12px] font-bold text-[#475569]">Password</span>
              <input {...register("password")} type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} className="h-12 rounded-[16px] bg-[#F8FAFC] px-4 text-[14px] font-semibold outline-none ring-1 ring-[#E2E8F0] focus:ring-[#6D35F5]" />
              {errors.password ? <span className="text-[11.5px] font-bold text-red-500">{errors.password.message}</span> : null}
            </label>
            {status ? <p className="rounded-[14px] bg-violet-50 p-3 text-[12px] font-semibold leading-relaxed text-[#5B21B6]">{status}</p> : null}
            <button disabled={isSubmitting} className="mt-2 h-12 rounded-[16px] bg-[#6D35F5] text-[15px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20 disabled:opacity-60">
              {isSubmitting ? "Please wait..." : mode === "login" ? "Log in" : "Create account"}
            </button>
          </form>

          <button
            onClick={() => {
              setMode(mode === "login" ? "signup" : "login");
              setStatus("");
              reset(undefined, { keepValues: true });
            }}
            className="mt-4 w-full text-center text-[13px] font-extrabold text-[#6D35F5]"
          >
            {mode === "login" ? "Create a new FinWise account" : "I already have an account"}
          </button>
        </div>
      </section>
    </main>
  );
}

function HomeDashboard({ displayName, transactions, latestPeriod, uploadStatus, transactionCount, onUpload, setActiveView }: { displayName: string; transactions: Transaction[]; latestPeriod: StatementPeriodInfo | null; uploadStatus: string; transactionCount: number; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; setActiveView: (view: ActiveView) => void }) {
  const summary = useMemo(() => getSummary(transactions), [transactions]);

  return (
    <>
      <HomeHeader displayName={displayName} />
      <TotalBalanceCard balance={summary.balance} />
      <SummaryCards summary={summary} />
      <LatestStatementCard latestPeriod={latestPeriod} uploadStatus={uploadStatus} transactionCount={transactionCount} onUpload={onUpload} onOpen={() => setActiveView("statements")} />
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

function SummaryCard({ icon, tone, title, value }: { icon: ReactNode; tone: "green" | "red" | "purple"; title: string; value: string }) {
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

function LatestStatementCard({ latestPeriod, uploadStatus, transactionCount, onUpload, onOpen }: { latestPeriod: StatementPeriodInfo | null; uploadStatus: string; transactionCount: number; onUpload: (event: ChangeEvent<HTMLInputElement>) => void; onOpen: () => void }) {
  const statusText = (uploadStatus === "42 transactions imported" ? `${transactionCount} transactions` : uploadStatus).replace(/\s+imported$/i, "");
  const periodText = latestPeriod?.startDate && latestPeriod.endDate ? `${latestPeriod.startDate} to ${latestPeriod.endDate}` : "Latest statement";

  return (
    <section className="mt-3.5 rounded-[22px] bg-white px-4 py-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:px-[18px]">
      <div className="flex min-h-[64px] items-center gap-3">
        <label className="relative grid h-14 w-14 shrink-0 cursor-pointer place-items-center rounded-full bg-gradient-to-br from-[#7C3AED] to-[#C4B5FD] text-white min-[391px]:h-[58px] min-[391px]:w-[58px]" aria-label="Upload a statement">
          <StatementIcon />
          <span className="absolute -bottom-1 -right-1 grid h-5 w-5 place-items-center rounded-full bg-[#22C55E] text-white ring-2 ring-white">
            <CheckIcon />
          </span>
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

function SpendingOverviewCard({ transactions, onOpenCategories }: { transactions: Transaction[]; onOpenCategories: () => void }) {
  const [period, setPeriod] = useState<SpendingPeriod>("This Month");
  const rows = useMemo(() => getSpendingRows(transactions, period), [transactions, period]);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);

  return (
    <section className="mt-3.5 rounded-[23px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:p-[18px]">
      <div>
        <h2 className="text-[21px] font-extrabold leading-[1.15] tracking-[-0.035em] text-[#111827] min-[391px]:text-[22px]">Spending Overview</h2>
        <div className="mt-3 grid h-10 grid-cols-3 rounded-[15px] bg-[#F8FAFC] p-1 text-[12.5px] font-semibold text-[#64708A] ring-1 ring-[#E2E8F0] min-[391px]:text-[13.5px]">
          {periods.map((item) => (
            <button key={item} onClick={() => setPeriod(item)} className={item === period ? "rounded-[12px] bg-[#633EF2] px-2 text-white shadow-md shadow-[#633EF2]/25" : "rounded-[12px] px-2"}>
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 flex justify-center">
        <div className="relative h-[172px] w-[172px] min-[391px]:h-[184px] min-[391px]:w-[184px]">
          <PieChart width={184} height={184} className="h-full w-full max-w-full" tabIndex={-1} accessibilityLayer={false}>
            <Pie data={rows} dataKey="amount" nameKey="label" innerRadius={62} outerRadius={82} paddingAngle={2} stroke="#FFFFFF" strokeWidth={3} isAnimationActive={false}>
              {rows.map((row) => (
                <Cell key={row.label} fill={row.color} />
              ))}
            </Pie>
          </PieChart>
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
          <div className="rounded-[16px] bg-[#F8FAFC] px-4 py-5 text-center text-[13px] font-semibold text-[#64748B]">
            Upload a statement to see your spending breakdown.
          </div>
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
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-violet-50 text-[#633EF2]">
        <ReceiptIcon />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-extrabold leading-tight tracking-[-0.02em] text-[#111827]">View all transactions</p>
        <p className="mt-0.5 truncate text-[12px] font-medium leading-tight text-[#64708A]">Search and manage every imported transaction</p>
      </div>
      <ChevronIcon />
    </button>
  );
}

function TransactionsPage({ transactions, setTransactions, setActiveView, onClearUploads }: { transactions: Transaction[]; setTransactions: (transactions: Transaction[] | ((current: Transaction[]) => Transaction[])) => void; setActiveView: (view: ActiveView) => void; onClearUploads: () => void }) {
  const [search, setSearch] = useState("");
  const [activeChip, setActiveChip] = useState("All");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({ "June 2026": true, "May 2026": true, "April 2026": true });
  const [sheet, setSheet] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const groups = useMemo(() => groupTransactionsByMonth(transactions), [transactions]);
  const statements = useMemo(() => getStatementSummaries(transactions, null), [transactions]);
  const summary = useMemo(() => getSummary(transactions), [transactions]);
  const reviewRows = useMemo(() => getReviewRows(transactions), [transactions]);
  const reviewStats = useMemo(() => getReviewStats(transactions), [transactions]);

  const filteredGroups = groups.map((group) => ({
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
  })).filter((group) => group.rows.length > 0);

  return (
    <section>
      <AppTopBar />
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[30px] font-extrabold leading-none tracking-[-0.045em] text-[#0F172A] min-[391px]:text-[32px]">Transactions</h1>
          <p className="mt-2 max-w-[330px] text-[13.5px] font-medium leading-snug text-[#64748B] min-[391px]:text-[14px]">Search and manage all imported transactions across every statement.</p>
        </div>
      </div>

      <section className="rounded-[22px] bg-white p-3.5 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)] min-[391px]:p-4">
        <div className="flex items-center gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-50 text-[#6D35F5] min-[391px]:h-[52px] min-[391px]:w-[52px]"><StatementIcon /></div>
          <button onClick={() => setSheet("Statement selector")} className="min-w-0 flex-1 text-left">
            <div className="flex items-center gap-2">
              <h2 className="text-[16px] font-extrabold tracking-[-0.02em] text-[#0F172A] min-[391px]:text-[17px]">All Statements</h2>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-emerald-50 text-emerald-500"><CheckIcon /></span>
            </div>
            <p className="mt-0.5 text-[13px] font-medium text-[#64748B]">{statements.length} statements processed</p>
            <p className="mt-1 text-[12px] font-semibold text-[#475569]">{formatMonthRange(transactions)}</p>
          </button>
          <button onClick={() => setSheet("Statement selector")} className="hidden h-11 items-center gap-2 rounded-[15px] bg-white px-3 text-[13px] font-bold text-[#0F172A] shadow-sm ring-1 ring-[#E2E8F0] min-[390px]:flex">
            All Statements
            <ChevronDownIcon />
          </button>
        </div>
      </section>

      <div className="mt-4 flex h-[50px] items-center gap-3 rounded-[17px] bg-white px-4 shadow-[0_8px_22px_rgba(15,23,42,0.04)] ring-1 ring-[#E2E8F0]">
        <SearchIcon />
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search merchant, category, account, or note" className="min-w-0 flex-1 bg-transparent text-[13.5px] font-medium text-[#0F172A] placeholder:text-[#64748B] focus:outline-none" />
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <div className="flex min-w-max gap-2">
            {["All", "Needs Review", "Expenses", "Income", "Transfers", "Groceries", "Ordering Out"].map((chip) => (
            <button key={chip} onClick={() => setActiveChip(chip)} className={chip === activeChip ? "h-10 rounded-[14px] bg-[#6D35F5] px-4 text-[13px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20" : "h-10 rounded-[14px] bg-white px-4 text-[13px] font-bold text-[#334155] shadow-sm ring-1 ring-[#E8ECF3]"}>
              {chip}
            </button>
          ))}
        </div>
      </div>

      <div className="-mx-4 mt-3 overflow-x-auto px-4 pb-1 scrollbar-thin">
        <div className="flex min-w-max gap-2">
          {["Date Range", "Statement", "Account", "Sort: Newest"].map((filter) => (
            <button key={filter} onClick={() => setSheet(filter)} className="flex h-10 items-center gap-2 rounded-[14px] bg-white px-3 text-[12.5px] font-bold text-[#334155] shadow-sm ring-1 ring-[#E8ECF3]">
              <FilterIcon />
              {filter}
              <ChevronDownIcon />
            </button>
          ))}
        </div>
      </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5">
          <MetricCard label="Transactions" value={transactions.length.toLocaleString("en-US")} helper="All time" />
          <MetricCard label="Total Spent" value={`QAR ${formatAmount(summary.expenses)}`} helper="All time" tone="red" />
          <MetricCard label="Total Income" value={`QAR ${formatAmount(summary.income)}`} helper="All time" tone="green" />
          <MetricCard label="Statements" value={statements.length.toString()} helper="Processed" tone="purple" />
          <MetricCard label="Needs Review" value={reviewStats.needsReview.toString()} helper={`${reviewStats.categorizedPercent}% categorized`} tone={reviewStats.needsReview ? "red" : "green"} />
          <MetricCard label="Rules" value={reviewStats.ruleCount.toString()} helper="Saved locally" tone="purple" />
        </div>

        {reviewRows.length ? (
          <section className="mt-4 rounded-[22px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Review Queue</h2>
                <p className="mt-0.5 text-[12.5px] font-semibold text-[#64748B]">Correct these once. FinWise will learn the merchant rule.</p>
              </div>
              <button onClick={() => setActiveChip("Needs Review")} className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-extrabold text-amber-600">{reviewRows.length}</button>
            </div>
            <div className="mt-3 divide-y divide-[#EEF2F7]">
              {reviewRows.slice(0, 4).map((row) => (
                <ReviewQueueRow key={row.id} row={row} onCorrect={() => setEditingTransaction(row)} />
              ))}
            </div>
          </section>
        ) : null}

      <div className="mt-4 flex items-center justify-between px-1 text-[14px] font-extrabold text-[#5A36ED]">
        <button onClick={() => setActiveView("statements")} className="flex items-center gap-2"><OpenIcon />Manage statements</button>
        <button onClick={onClearUploads} className="flex items-center gap-1 text-red-500">Clear imports</button>
      </div>

      <div className="mt-3 grid gap-4">
        {filteredGroups.length ? filteredGroups.map((group) => (
          <section key={group.month} className="overflow-hidden rounded-[22px] bg-white shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
            <button onClick={() => setExpanded((current) => ({ ...current, [group.month]: !current[group.month] }))} className="flex w-full items-center justify-between px-4 py-3 text-left">
              <h2 className="text-[18px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{group.month}</h2>
              <span className="flex items-center gap-2 text-[12px] font-bold text-[#64748B]">{group.count} transactions<ChevronUpIcon collapsed={!expanded[group.month]} /></span>
            </button>
            {expanded[group.month] ? (
              <div className="divide-y divide-[#EEF2F7]">
                {group.rows.map((row) => (
                  <TransactionListRow key={row.id} row={row} onOpen={() => setSheet(`${row.merchant} details`)} onActions={() => setEditingTransaction(row)} />
                ))}
              </div>
            ) : null}
          </section>
        )) : (
          <section className="rounded-[22px] bg-white px-5 py-8 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
            <p className="text-[15px] font-extrabold text-[#0F172A]">No imported transactions</p>
            <p className="mt-1 text-[13px] font-medium text-[#64748B]">Upload a bank statement to populate this page.</p>
          </section>
        )}
      </div>

      {filteredGroups.length ? <button onClick={() => setSheet("More transactions")} className="mt-4 h-12 w-full rounded-[16px] bg-white text-[14px] font-extrabold text-[#0F172A] shadow-[0_8px_22px_rgba(15,23,42,0.04)] ring-1 ring-[#E2E8F0]">Load more transactions</button> : null}
      <BottomSheet title={sheet} transactions={transactions} onClose={() => setSheet(null)} />
      <CategoryCorrectionSheet
        transaction={editingTransaction}
        onClose={() => setEditingTransaction(null)}
        onSave={(category) => {
          if (!editingTransaction) return;
            saveMerchantRule(editingTransaction, category);
            setTransactions((current) =>
              current.map((row) =>
                shouldApplyMerchantCorrection(row, editingTransaction)
                  ? {
                      ...row,
                      category,
                    subcategory: category,
                    confidence: 1,
                    needsReview: false,
                    categorySource: "user_rule",
                    reason: `Saved merchant rule for "${editingTransaction.merchant}".`
                  }
                : row
            )
          );
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
        <p className="truncate text-[14.5px] font-bold tracking-[-0.01em] text-[#0F172A]">{row.merchant}</p>
        <p className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[11.5px] font-medium text-[#64748B]">
          <span className="truncate">{row.date}</span>
          <span className={row.direction === "income" ? "shrink-0 rounded-[8px] bg-emerald-50 px-1.5 py-0.5 text-[10.5px] font-bold text-emerald-600" : "shrink-0 rounded-[8px] bg-violet-50 px-1.5 py-0.5 text-[10.5px] font-bold text-[#6D35F5]"}>{row.category}</span>
        </p>
        <p className="mt-0.5 truncate text-[10.5px] font-medium text-[#94A3B8]">{row.bank} - {row.categorySource}{row.needsReview ? " - Needs review" : ""}</p>
      </button>
      <button onClick={onOpen} className="text-right">
        <p className={isIncome ? "whitespace-nowrap text-[13.5px] font-extrabold text-emerald-500 min-[391px]:text-[14px]" : "whitespace-nowrap text-[13.5px] font-extrabold text-red-500 min-[391px]:text-[14px]"}>{isIncome ? "+" : "-"}QAR {formatAmount(row.amount)}</p>
      </button>
      <button onClick={onActions} aria-label="Transaction actions" className="text-[#64748B]"><DotsIcon /></button>
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
        <span className="block truncate text-[13.5px] font-extrabold text-[#0F172A]">{row.merchant}</span>
        <span className="mt-0.5 block truncate text-[11.5px] font-semibold text-[#64748B]">{row.category} - {Math.round(row.confidence * 100)}% confidence</span>
      </button>
      <button type="button" onClick={onCorrect} className="shrink-0 rounded-full bg-[#6D35F5] px-3 py-1.5 text-[12px] font-extrabold text-white shadow-md shadow-[#6D35F5]/20 transition active:scale-[0.96]">
        Fix
      </button>
    </div>
  );
}

function UploadPage({
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
          <FieldPreview label="Bank name" value="QNB" />
          <FieldPreview label="Detected period" value={latestPeriod ? latestPeriod.label : "Detected after upload"} />
          <FieldPreview label="Currency" value="QAR" />
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
  const summary = getSummary(pendingImport.transactions);
  const reviewCount = pendingImport.transactions.filter((transaction) => transaction.needsReview).length;

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
        <MiniMetric label="Income" value={`QAR ${formatDisplayAmount(summary.income)}`} tone="green" />
        <MiniMetric label="Spent" value={`QAR ${formatDisplayAmount(summary.expenses)}`} tone="red" />
        <MiniMetric label="Net" value={`QAR ${formatDisplayAmount(summary.balance)}`} />
      </div>

      <div className="mt-3 max-h-[390px] w-full max-w-full overflow-x-hidden overflow-y-auto rounded-[18px] bg-[#F8FAFC] p-2 ring-1 ring-[#E2E8F0]">
        <div className="grid min-w-0 gap-2">
          {pendingImport.transactions.map((transaction, index) => (
            <article key={transaction.id} className="min-w-0 overflow-hidden rounded-[16px] bg-white p-3 shadow-[0_8px_18px_rgba(15,23,42,0.035)] ring-1 ring-[rgba(15,23,42,0.055)]">
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

function InsightsPage({ transactions }: { transactions: Transaction[] }) {
  const [sheet, setSheet] = useState<string | null>(null);
  const viewportWidth = useAppViewportWidth();
  const trendChartWidth = Math.max(286, Math.min(360, viewportWidth - 74));
  const dynamicTrendRows = useMemo(() => buildTrendRows(transactions), [transactions]);
  const dynamicInsightCategories = useMemo(() => getInsightCategories(transactions), [transactions]);
  const dynamicMerchantInsights = useMemo(() => getMerchantInsights(transactions), [transactions]);
  const topCategory = dynamicInsightCategories[0];

  return (
    <section>
      <AppTopBar />
      <div className="mb-4 flex items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-[31px] font-extrabold leading-none tracking-[-0.045em] text-[#0F172A]">Analytics</h1>
          <p className="mt-2 text-[14px] font-medium leading-snug text-[#64748B]">Smart analysis of your spending habits.</p>
        </div>
        <button onClick={() => setSheet("Insight period")} className="flex h-11 shrink-0 items-center gap-2 rounded-[15px] bg-white px-3 text-[13px] font-bold text-[#334155] shadow-sm ring-1 ring-[#E2E8F0]">
          <CalendarIcon />
          This Month
          <ChevronDownIcon />
        </button>
      </div>

      <section className="rounded-[24px] bg-[#F3EDFF] p-4 shadow-[0_10px_24px_rgba(109,53,245,0.075)] ring-1 ring-[#EDE7FF] min-[391px]:p-[18px]">
        <div className="flex items-center gap-3">
          <RobotIcon />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] font-extrabold text-[#6D35F5]">AI Insight</p>
            <h2 className="mt-1 text-[17px] font-extrabold leading-[1.3] tracking-[-0.02em] text-[#0F172A] min-[390px]:text-[18px]">{topCategory?.label ?? "Spending"} is your top category.</h2>
            <p className="mt-1.5 text-[13px] font-medium leading-[1.45] text-[#475569]">You&apos;ve spent QAR {formatAmount(topCategory?.amount ?? 0)} here. Review low-confidence transactions to improve future categorization.</p>
          </div>
          <button onClick={() => setSheet("AI insight details")} className="hidden h-10 shrink-0 rounded-[14px] border border-[#C4B5FD] bg-white/70 px-4 text-[13px] font-extrabold text-[#5A36ED] min-[430px]:block">View Details</button>
        </div>
        <button onClick={() => setSheet("AI insight details")} className="mt-3 h-10 rounded-[14px] border border-[#C4B5FD] bg-white/70 px-4 text-[13px] font-extrabold text-[#5A36ED] min-[430px]:hidden">View Details</button>
      </section>

      <div className="mt-3 grid grid-cols-1 gap-3">
        <InsightPanel title="Monthly Trend" aside={<span className="text-[13px] font-bold text-emerald-500 sm:text-[11px]">Up 15.3% vs last month</span>}>
          <div className="mt-3 flex h-[160px] justify-center overflow-hidden">
            <AreaChart width={trendChartWidth} height={160} data={dynamicTrendRows} margin={{ top: 8, right: 2, left: -8, bottom: 0 }} tabIndex={-1} accessibilityLayer={false}>
              <defs>
                <linearGradient id="trendFill" x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="#6D35F5" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#6D35F5" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="#EEF2F7" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} interval="preserveStartEnd" tickMargin={7} padding={{ left: 4, right: 22 }} />
              <YAxis tick={{ fontSize: 10, fill: "#64748B" }} axisLine={false} tickLine={false} width={34} ticks={[0, 2000, 4000, 6000, 8000, 10000]} tickFormatter={(value) => (value === 0 ? "0" : `${Number(value) / 1000}K`)} />
              <Tooltip cursor={false} formatter={(value) => [`QAR ${formatAmount(Number(value))}`, "Spent"]} labelStyle={{ color: "#0F172A", fontWeight: 700 }} contentStyle={{ border: 0, borderRadius: 14, boxShadow: "0 12px 28px rgba(15,23,42,0.12)" }} wrapperStyle={{ outline: "none", border: 0 }} />
              <Area type="linear" dataKey="amount" stroke="#6D35F5" strokeWidth={3} fill="url(#trendFill)" activeDot={{ r: 5, fill: "#6D35F5", stroke: "#DDD6FE", strokeWidth: 5 }} dot={{ r: 3.4, fill: "#6D35F5", stroke: "#FFFFFF", strokeWidth: 2 }} />
            </AreaChart>
          </div>
        </InsightPanel>

        <InsightPanel title="Top Spending Categories" aside={<button onClick={() => setSheet("All categories")} className="h-8 shrink-0 whitespace-nowrap rounded-[10px] border border-[#C4B5FD] px-3 text-[12px] font-extrabold text-[#5A36ED]">View All</button>}>
          <div className="mt-3 space-y-2.5">
            {dynamicInsightCategories.slice(0, 5).map((item, index) => (
              <button key={item.label} onClick={() => setSheet(`${item.label} category`)} className="block w-full text-left">
                <div className="grid grid-cols-[18px_12px_minmax(86px,112px)_minmax(46px,1fr)_78px] items-center gap-2">
                  <span className="text-[12px] font-bold text-[#0F172A]">{index + 1}</span>
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: item.color }} />
                  <span className="min-w-0 truncate text-[12.5px] font-semibold text-[#334155] min-[391px]:text-[13px]">{item.label}</span>
                  <span className="h-1.5 rounded-full bg-slate-100">
                    <span className="block h-full rounded-full bg-[#6D35F5]" style={{ width: `${Math.min(100, item.percent * 3.2)}%` }} />
                  </span>
                  <span className="justify-self-end whitespace-nowrap text-[11.5px] font-medium text-[#64748B] min-[391px]:text-[12px]">QAR {formatAmount(item.amount)}</span>
                </div>
              </button>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Merchant Insights" aside={<button onClick={() => setSheet("Merchant insights")} className="h-8 rounded-[10px] border border-[#C4B5FD] px-3 text-[12px] font-extrabold text-[#5A36ED]">View All</button>}>
          <div className="mt-3 divide-y divide-[#EEF2F7]">
            {dynamicMerchantInsights.map((item) => (
              <button key={item.merchant} onClick={() => setSheet(`${item.merchant} insight`)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-[13px] font-extrabold ${item.color}`}>
                  <MerchantLogo merchant={item.merchant} fallback={item.merchant[0]} />
                </span>
                <span className="min-w-0 flex-1 text-[13px] font-bold text-[#0F172A]">{item.merchant}</span>
                <span className="text-right">
                  <span className="block whitespace-nowrap text-[12px] font-semibold text-[#334155]">QAR {formatAmount(item.amount)}</span>
                  <span className={item.up ? "block text-[12px] font-bold text-red-500" : "block text-[12px] font-bold text-emerald-500"}>{item.up ? "Up" : "Down"} {item.change.replace("+", "").replace("-", "")}</span>
                </span>
                <ChevronIcon />
              </button>
            ))}
          </div>
        </InsightPanel>

        <InsightPanel title="Smart Recommendations">
          <div className="mt-2 divide-y divide-[#EEF2F7]">
            {[
              ["Reduce Food Delivery", "Try cooking at home 2 more times a week to save up to QAR 395 this month."],
              ["Review Subscriptions", "You're paying for 3 active subscriptions. Review unused ones."],
              ["Set a Grocery Budget", "You've spent a total of QAR 937. Try setting a weekly limit."]
            ].map(([title, body]) => (
              <button key={title} onClick={() => setSheet(title)} className="flex w-full items-center gap-3 py-2.5 text-left">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[11px] bg-violet-50 text-[#6D35F5]"><WalletIcon /></span>
                <span className="min-w-0 flex-1">
                  <span className="block text-[12.5px] font-extrabold text-[#0F172A]">{title}</span>
                  <span className="mt-0.5 block text-[11px] font-medium leading-snug text-[#64748B]">{body}</span>
                </span>
                <ChevronIcon />
              </button>
            ))}
          </div>
        </InsightPanel>

        <section className="rounded-[22px] bg-emerald-50 p-5 shadow-[0_10px_26px_rgba(15,23,42,0.035)] ring-1 ring-emerald-100">
          <div className="flex items-start gap-4">
            <div className="min-w-0 flex-1">
              <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">Savings Opportunity</h2>
              <p className="mt-3 text-[13px] font-medium text-[#475569]">You could save up to</p>
              <p className="mt-1 text-[30px] font-extrabold tracking-[-0.04em] text-emerald-600">QAR 827.00</p>
              <p className="text-[15px] font-bold text-emerald-600">this month</p>
              <p className="mt-2 text-[13px] font-medium leading-snug text-[#475569]">by optimizing your spending in key categories.</p>
            </div>
            <div className="grid h-16 w-16 shrink-0 place-items-center rounded-[20px] bg-white text-emerald-600 shadow-sm"><WalletIcon /></div>
          </div>
          <button onClick={() => setSheet("Savings opportunity")} className="mt-4 h-10 rounded-[13px] bg-white px-5 text-[13px] font-extrabold text-emerald-700 ring-1 ring-emerald-200">See How</button>
        </section>
      </div>
      <BottomSheet title={sheet} transactions={transactions} onClose={() => setSheet(null)} />
    </section>
  );
}

function StatementsPage({ transactions, latestPeriod, setActiveView, onClearUploads }: { transactions: Transaction[]; latestPeriod: StatementPeriodInfo | null; setActiveView: (view: ActiveView) => void; onClearUploads: () => void }) {
  const groups = useMemo(() => groupTransactionsByMonth(transactions), [transactions]);
  return (
    <section>
      <PageHeader title="Statements" subtitle="View uploaded statement history and processing results." actionLabel="Upload" onAction={() => setActiveView("upload")} />
      <div className="grid gap-4">
        {groups.length ? groups.map((group) => (
          <StatementHistoryCard key={group.month} month={group.month} bank={latestPeriod ? `${latestPeriod.label} - ${formatPeriodDates(latestPeriod)}` : "Imported statement"} imported={`${group.count} transactions`} review={`${group.rows.filter((row) => row.needsReview).length} need review`} />
        )) : (
          <section className="rounded-[22px] bg-white px-5 py-8 text-center shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
            <p className="text-[15px] font-extrabold text-[#0F172A]">No statements imported</p>
            <p className="mt-1 text-[13px] font-medium text-[#64748B]">Upload a bank statement to start your dashboard.</p>
          </section>
        )}
      </div>
      {groups.length ? <button onClick={onClearUploads} className="mt-4 h-12 w-full rounded-[16px] bg-red-50 text-[15px] font-extrabold text-red-500 ring-1 ring-red-100">Clear all imported statements</button> : null}
    </section>
  );
}

function StatementsPageV2({ transactions, latestPeriod, setActiveView, onClearUploads, onClearStatement }: { transactions: Transaction[]; latestPeriod: StatementPeriodInfo | null; setActiveView: (view: ActiveView) => void; onClearUploads: () => void; onClearStatement: (statementId: string) => void }) {
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

function SettingsPage({ setActiveView, authEmail, syncStatus, onSignOut }: { setActiveView: (view: ActiveView) => void; authEmail: string | null; syncStatus: string; onSignOut: () => void }) {
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
        <SettingsGroup title="Data & Privacy" items={["Original statements are deleted after processing", "Keep original statements: Off", "Export extracted transaction data"]} />
        <SettingsGroup title="Categories" items={["Manage category colors and icons", "Merchant rules", "Low-confidence review queue"]} />
        <button onClick={() => setActiveView("statements")} className="flex min-h-[56px] items-center justify-between rounded-[20px] bg-white px-4 text-left shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
          <span className="text-[15px] font-extrabold">Statement history</span>
          <ChevronIcon />
        </button>
      </div>
    </section>
  );
}

function PageHeader({ title, subtitle, actionLabel, onAction }: { title: string; subtitle: string; actionLabel?: string; onAction?: () => void }) {
  return (
    <header className="mb-4 flex items-start justify-between gap-3 pt-1">
      <div className="min-w-0">
        <h1 className="text-[clamp(27px,7vw,31px)] font-extrabold leading-tight tracking-[-0.04em] text-[#11152D]">{title}</h1>
        <p className="mt-1 text-[15px] font-medium leading-snug text-[#64708A] min-[391px]:text-[15.5px]">{subtitle}</p>
      </div>
      {actionLabel ? <button onClick={onAction} className="shrink-0 rounded-full bg-[#633EF2] px-4 py-2 text-[13px] font-bold text-white">{actionLabel}</button> : null}
    </header>
  );
}

function AppTopBar() {
  return (
    <header className="mb-5 flex items-center justify-between pt-1">
      <div className="flex items-center gap-2.5">
        <LogoMark />
        <span className="text-[22px] font-extrabold tracking-[-0.035em] text-[#0F172A]">FinWise</span>
      </div>
      <div className="flex items-center gap-3">
        <button aria-label="Notifications" className="relative grid h-9 w-9 place-items-center rounded-full bg-white text-[#334155] ring-1 ring-[#E8ECF3]">
          <BellIcon />
          <span className="absolute right-1.5 top-1.5 h-2.5 w-2.5 rounded-full bg-[#6D35F5] ring-2 ring-white" />
        </button>
        <div className="grid h-10 w-10 place-items-center rounded-full bg-gradient-to-br from-amber-100 to-sky-100 text-[15px] font-extrabold text-[#0F172A] ring-2 ring-white">S</div>
      </div>
    </header>
  );
}

function MetricCard({ label, value, helper, tone = "slate" }: { label: string; value: string; helper: string; tone?: "slate" | "red" | "green" | "purple" }) {
  const valueClass = tone === "red" ? "text-red-500" : tone === "green" ? "text-emerald-500" : tone === "purple" ? "text-[#6D35F5]" : "text-[#0F172A]";
  return (
    <article className="min-h-[88px] rounded-[18px] bg-white p-3 shadow-[0_10px_22px_rgba(15,23,42,0.035)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <p className="text-[12px] font-bold uppercase tracking-[0.04em] text-[#64748B]">{label}</p>
      <p className={`mt-2 truncate text-[16px] font-extrabold tracking-[-0.03em] min-[391px]:text-[17px] ${valueClass}`}>{value}</p>
      <p className="mt-1.5 text-[12px] font-medium text-[#64748B]">{helper}</p>
    </article>
  );
}

function InsightPanel({ title, aside, children }: { title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-[22px] bg-white p-4 shadow-[0_10px_24px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.055)]">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-[17px] font-extrabold tracking-[-0.02em] text-[#0F172A]">{title}</h2>
        {aside}
      </div>
      {children}
    </section>
  );
}

function CategoryCorrectionSheet({ transaction, onClose, onSave }: { transaction: Transaction | null; onClose: () => void; onSave: (category: Transaction["category"]) => void }) {
  return (
    <Dialog.Root open={Boolean(transaction)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {transaction ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-20 bg-slate-950/25 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.section
                className="fixed inset-x-0 bottom-0 z-30 mx-auto w-full max-w-[430px] rounded-t-[28px] bg-white p-5 pb-[calc(18px+env(safe-area-inset-bottom))] shadow-2xl outline-none"
                initial={{ y: 36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 36, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
                <Dialog.Title className="text-[20px] font-extrabold tracking-[-0.03em] text-[#0F172A]">Correct category</Dialog.Title>
                <Dialog.Description className="mt-1 text-[13px] font-medium text-[#64748B]">{transaction.merchant}</Dialog.Description>
                <div className="mt-4 grid max-h-[320px] grid-cols-2 gap-2 overflow-y-auto pr-1">
                  {categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => onSave(category)}
                      className={cn(
                        "min-h-10 rounded-[14px] px-3 text-[12px] font-extrabold transition active:scale-[0.98]",
                        category === transaction.category
                          ? "bg-[#6D35F5] text-white shadow-lg shadow-[#6D35F5]/20"
                          : "bg-[#F8FAFC] text-[#334155] ring-1 ring-[#E2E8F0]"
                      )}
                    >
                      {category}
                    </button>
                  ))}
                </div>
                <p className="mt-4 rounded-[14px] bg-emerald-50 p-3 text-[12px] font-semibold leading-snug text-emerald-700">Saving a correction also saves a merchant rule, so future uploads classify this merchant automatically.</p>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function BottomSheet({ title, transactions, onClose }: { title: string | null; transactions: Transaction[]; onClose: () => void }) {
  return (
    <Dialog.Root open={Boolean(title)} onOpenChange={(open) => { if (!open) onClose(); }}>
      <AnimatePresence>
        {title ? (
          <Dialog.Portal forceMount>
            <Dialog.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-20 bg-slate-950/25 backdrop-blur-[2px]"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
              />
            </Dialog.Overlay>
            <Dialog.Content asChild>
              <motion.section
                className="fixed inset-x-0 bottom-0 z-30 mx-auto max-h-[84vh] w-full max-w-[430px] overflow-hidden rounded-t-[28px] bg-white p-5 pb-[calc(18px+env(safe-area-inset-bottom))] shadow-2xl outline-none"
                initial={{ y: 36, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 36, opacity: 0 }}
                transition={{ type: "spring", stiffness: 360, damping: 34 }}
              >
                <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-slate-200" />
                <Dialog.Title className="text-[20px] font-extrabold tracking-[-0.03em] text-[#0F172A]">{title}</Dialog.Title>
                <div className="mt-4 max-h-[58vh] overflow-y-auto pr-1">
                  <SheetContent title={title} transactions={transactions} />
                </div>
                <Dialog.Close asChild>
                  <button className="mt-5 h-12 w-full rounded-[16px] bg-[#6D35F5] text-[15px] font-extrabold text-white shadow-lg shadow-[#6D35F5]/20 transition active:scale-[0.99]">Done</button>
                </Dialog.Close>
              </motion.section>
            </Dialog.Content>
          </Dialog.Portal>
        ) : null}
      </AnimatePresence>
    </Dialog.Root>
  );
}

function SheetContent({ title, transactions }: { title: string; transactions: Transaction[] }) {
  const categories = getAllCategoryRows(transactions);
  const merchants = getAllMerchantRows(transactions);
  const summary = getSummary(transactions);
  const selectedCategory = categories.find((row) => categoryTitleMatches(title, row.label));
  const selectedMerchant = merchants.find((row) => title.toLowerCase().includes(row.merchant.toLowerCase()));
  const lowConfidence = transactions.filter((row) => row.needsReview || row.confidence < 0.75).length;
  const groceries = categories.find((row) => row.label === "Groceries");
  const orderingOut = categories.find((row) => row.label === "Ordering Out" || row.label === "Dining Out");

  if (!transactions.length) {
    return (
      <div className="rounded-[18px] bg-[#F8FAFC] p-4 text-[13px] font-semibold leading-relaxed text-[#64748B]">
        Upload a statement first. This panel will then show real merchant, category, filter, and recommendation data from your transactions.
      </div>
    );
  }

  if (title === "All categories") {
    return (
      <div className="space-y-2.5">
        {categories.map((row) => (
          <CategorySheetRow key={row.label} row={row} />
        ))}
      </div>
    );
  }

  if (title === "Merchant insights") {
    return (
      <div className="divide-y divide-[#EEF2F7]">
        {merchants.slice(0, 12).map((row) => (
          <MerchantSheetRow key={row.merchant} row={row} />
        ))}
      </div>
    );
  }

  if (selectedCategory) {
    const rows = transactions.filter((row) => normalizeCategoryLabel(row.category) === selectedCategory.label && row.direction === "expense").slice(0, 8);
    return (
      <div>
        <div className="grid grid-cols-2 gap-2">
          <MiniMetric label="Spent" value={`QAR ${formatAmount(selectedCategory.amount)}`} tone="red" />
          <MiniMetric label="Share" value={`${selectedCategory.percent}%`} />
        </div>
        <div className="mt-3 divide-y divide-[#EEF2F7]">
          {rows.map((row) => (
            <CompactTransactionRow key={row.id} row={row} />
          ))}
        </div>
      </div>
    );
  }

  if (selectedMerchant || title.endsWith(" details")) {
    const merchantName = selectedMerchant?.merchant ?? title.replace(/\s+details$/i, "").replace(/\s+insight$/i, "");
    const rows = transactions.filter((row) => row.merchant.toLowerCase().includes(merchantName.toLowerCase())).slice(0, 8);
    const total = rows.reduce((sum, row) => sum + row.amount, 0);
    return (
      <div>
        <div className="flex items-center gap-3 rounded-[18px] bg-[#F8FAFC] p-3">
          <span className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full bg-violet-50 text-[16px] font-extrabold text-[#6D35F5]">
            <MerchantLogo merchant={merchantName} fallback={merchantName.slice(0, 1)} />
          </span>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-extrabold text-[#0F172A]">{merchantName}</p>
            <p className="text-[13px] font-semibold text-[#64748B]">QAR {formatAmount(total)} across {rows.length} transactions</p>
          </div>
        </div>
        <div className="mt-3 divide-y divide-[#EEF2F7]">
          {rows.map((row) => (
            <CompactTransactionRow key={row.id} row={row} />
          ))}
        </div>
      </div>
    );
  }

  if (title === "Savings opportunity") {
    const flexibleSpend = (orderingOut?.amount ?? 0) + (categories.find((row) => row.label === "Shopping")?.amount ?? 0) + (categories.find((row) => row.label === "Subscriptions")?.amount ?? 0);
    const saving = Math.max(0, flexibleSpend * 0.12);
    return (
      <div className="rounded-[20px] bg-emerald-50 p-4 ring-1 ring-emerald-100">
        <p className="text-[13px] font-semibold text-emerald-700">Estimated monthly opportunity</p>
        <p className="mt-1 text-[30px] font-extrabold tracking-[-0.04em] text-emerald-600">QAR {formatAmount(saving)}</p>
        <p className="mt-2 text-[13px] font-medium leading-relaxed text-[#475569]">Based on ordering out, shopping, and subscriptions. Reduce the highest flexible categories by 10-15% to unlock this saving.</p>
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
        <p className="rounded-[16px] bg-[#F8FAFC] p-3 text-[13px] font-medium leading-relaxed text-[#64748B]">Budget saving is calculated from your imported grocery transactions. Manual editable budgets can be added next as persistent settings.</p>
      </div>
    );
  }

  if (title === "Reduce Food Delivery") {
    const amount = orderingOut?.amount ?? 0;
    return <RecommendationDetail amount={amount} saving={amount * 0.14} text="Try replacing two delivery orders per week with planned meals. FinWise will track Ordering Out after each upload." />;
  }

  if (title === "Review Subscriptions") {
    const amount = categories.find((row) => row.label === "Subscriptions")?.amount ?? 0;
    return <RecommendationDetail amount={amount} saving={amount * 0.2} text="Review recurring merchants and cancel unused subscriptions. Subscription rows are detected from merchant rules and transaction wording." />;
  }

  if (title === "AI insight details") {
    const top = categories[0];
    return (
      <div className="space-y-3">
        <MiniMetric label="Top category" value={top ? top.label : "None"} />
        <MiniMetric label="Needs review" value={lowConfidence.toString()} tone={lowConfidence ? "red" : "green"} />
        <p className="rounded-[16px] bg-violet-50 p-3 text-[13px] font-medium leading-relaxed text-[#5B21B6]">The categorizer uses saved merchant rules first, default rules second, then fallback inference. Correcting a category saves a merchant rule for future uploads.</p>
      </div>
    );
  }

  if (["Insight period", "Date Range", "Statement", "Account", "Sort: Newest", "Statement selector", "More transactions"].includes(title)) {
    return (
      <div className="space-y-2">
        <FieldPreview label="Transactions" value={transactions.length.toLocaleString("en-US")} />
        <FieldPreview label="Date range" value={getDateRange(transactions)} />
        <FieldPreview label="Total spent" value={`QAR ${formatAmount(summary.expenses)}`} />
        <p className="rounded-[16px] bg-[#F8FAFC] p-3 text-[13px] font-medium leading-relaxed text-[#64748B]">Current controls are connected to the imported dataset. Persistent saved filter presets can be added once account-level storage is introduced.</p>
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
    <div className="grid min-h-[42px] grid-cols-[minmax(0,1fr)_90px_44px] items-center gap-2 rounded-[14px] bg-[#F8FAFC] px-3">
      <div className="flex min-w-0 items-center gap-2">
        <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: row.color }} />
        <span className="truncate text-[13px] font-bold text-[#0F172A]">{row.label}</span>
      </div>
      <span className="justify-self-end whitespace-nowrap text-[12.5px] font-semibold text-[#334155]">QAR {formatAmount(row.amount)}</span>
      <span className="justify-self-end text-[12.5px] font-bold text-[#64748B]">{row.percent}%</span>
    </div>
  );
}

function MerchantSheetRow({ row }: { row: { merchant: string; amount: number; count: number; change?: string; up?: boolean; color?: string } }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-10 w-10 shrink-0 place-items-center overflow-hidden rounded-full text-[14px] font-extrabold ${row.color ?? "bg-violet-50 text-violet-600"}`}>
        <MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-extrabold text-[#0F172A]">{row.merchant}</p>
        <p className="text-[12px] font-medium text-[#64748B]">{row.count} transactions</p>
      </div>
      <div className="text-right">
        <p className="whitespace-nowrap text-[12.5px] font-bold text-[#334155]">QAR {formatAmount(row.amount)}</p>
        {row.change ? <p className={row.up ? "text-[12px] font-bold text-red-500" : "text-[12px] font-bold text-emerald-500"}>{row.up ? "Up" : "Down"} {row.change.replace("+", "").replace("-", "")}</p> : null}
      </div>
    </div>
  );
}

function CompactTransactionRow({ row }: { row: Transaction }) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className={`grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full text-[13px] font-extrabold ${categoryAvatarStyles[row.category] ?? categoryAvatarStyles.Other}`}>
        <MerchantLogo merchant={row.merchant} fallback={row.merchant.slice(0, 1)} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-bold text-[#0F172A]">{row.merchant}</p>
        <p className="text-[11.5px] font-medium text-[#64748B]">{row.date} - {row.category}</p>
      </div>
      <p className={row.direction === "income" ? "whitespace-nowrap text-[12.5px] font-extrabold text-emerald-500" : "whitespace-nowrap text-[12.5px] font-extrabold text-red-500"}>{row.direction === "income" ? "+" : "-"}QAR {formatAmount(row.amount)}</p>
    </div>
  );
}

function RecommendationDetail({ amount, saving, text }: { amount: number; saving: number; text: string }) {
  return (
    <div className="space-y-3">
      <MiniMetric label="Current spend" value={`QAR ${formatAmount(amount)}`} />
      <MiniMetric label="Potential saving" value={`QAR ${formatAmount(Math.max(0, saving))}`} tone="green" />
      <p className="rounded-[16px] bg-[#F8FAFC] p-3 text-[13px] font-medium leading-relaxed text-[#64748B]">{text}</p>
    </div>
  );
}

function MerchantLogo({ merchant, fallback }: { merchant: string; fallback: string }) {
  const [logoUrls, setLogoUrls] = useState<string[]>([]);
  const [logoIndex, setLogoIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const urls = getMerchantLogoUrls(merchant);
    setLogoUrls(urls);
    setLogoIndex(0);
    setLoaded(false);
  }, [merchant]);

  const logoUrl = logoUrls[logoIndex];
  const fallbackNode = (
    <span className={`grid h-full w-full place-items-center rounded-full text-[12px] font-extrabold ${getLogoFallbackClass(merchant)}`}>
      {getLogoFallbackText(merchant, fallback)}
    </span>
  );

  if (!logoUrl) return fallbackNode;

  return (
    <span className="relative block h-full w-full rounded-full">
      {fallbackNode}
      <img
        src={logoUrl}
        alt=""
        className={`absolute inset-0 h-full w-full rounded-full bg-white object-cover transition-opacity duration-200 ${loaded ? "opacity-100" : "opacity-0"}`}
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => {
          rememberBadLogoUrl(merchant, logoUrl);
          setLoaded(false);
          setLogoIndex((current) => current + 1);
        }}
      />
    </span>
  );
}

function MiniMetric({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "red" | "green" }) {
  const toneClass = tone === "green" ? "text-emerald-500" : tone === "red" ? "text-red-500" : "text-[#111827]";
  return (
    <div className="rounded-[18px] bg-white p-3 shadow-[0_10px_26px_rgba(15,23,42,0.04)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <p className="text-[11px] font-bold uppercase tracking-[0.04em] text-[#64708A]">{label}</p>
      <p className={`mt-1 truncate text-[14px] font-extrabold ${toneClass}`}>{value}</p>
    </div>
  );
}

function FieldPreview({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex h-12 items-center justify-between rounded-[16px] bg-[#F8FAFC] px-4 ring-1 ring-[#E2E8F0]">
      <span className="text-[13px] font-bold text-[#64708A]">{label}</span>
      <span className="text-[14px] font-extrabold text-[#111827]">{value}</span>
    </div>
  );
}

function StatusCard({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-4 rounded-[20px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <p className="text-[15px] font-extrabold">{title}</p>
      <p className="mt-1 text-[13px] font-medium text-[#64708A]">{body}</p>
    </div>
  );
}

function InsightCard({ title, body, action }: { title: string; body: string; action: string }) {
  return (
    <article className="rounded-[24px] bg-white p-5 shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <h2 className="text-[20px] font-extrabold tracking-[-0.03em] text-[#111827]">{title}</h2>
      <p className="mt-2 text-[14px] font-medium leading-relaxed text-[#64708A]">{body}</p>
      <button className="mt-4 text-[14px] font-extrabold text-[#633EF2]">{action}</button>
    </article>
  );
}

function StatementHistoryCard({ month, bank, imported, review }: { month: string; bank: string; imported: string; review: string }) {
  return (
    <article className="rounded-[24px] bg-white p-4 shadow-[0_10px_26px_rgba(15,23,42,0.045)] ring-1 ring-[rgba(15,23,42,0.06)]">
      <div className="flex items-start gap-3">
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-violet-50 text-[#633EF2]"><StatementIcon /></div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[17px] font-extrabold tracking-[-0.02em]">{month}</h2>
          <p className="text-[13px] font-medium text-[#64708A]">{bank}</p>
          <p className="mt-2 text-[13px] font-semibold text-[#111827]">{imported}</p>
          <p className="text-[13px] font-semibold text-amber-500">{review}</p>
          <p className="mt-2 inline-flex rounded-full bg-emerald-50 px-3 py-1.5 text-[12px] font-bold text-emerald-600">Original file deleted</p>
        </div>
      </div>
    </article>
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

function BottomNavigation({ activeView, setActiveView }: { activeView: ActiveView; setActiveView: (view: ActiveView) => void }) {
  return (
    <nav className="fixed inset-x-0 bottom-0 z-10 mx-auto w-full max-w-[430px] rounded-t-[26px] bg-white px-5 pb-[calc(10px+env(safe-area-inset-bottom))] pt-2.5 shadow-2xl shadow-slate-400/30 ring-1 ring-[rgba(15,23,42,0.06)] sm:bottom-5 sm:rounded-[26px]">
      <div className="grid grid-cols-5 items-end text-center text-[12px] font-medium text-[#536180] min-[391px]:text-[13px]">
        <NavItem label="Home" active={activeView === "home"} icon={<HomeIcon />} onClick={() => setActiveView("home")} />
        <NavItem label="Transactions" active={activeView === "transactions"} icon={<ReceiptIcon />} onClick={() => setActiveView("transactions")} />
        <NavItem label="Upload" active={activeView === "upload"} icon={<UploadIcon />} onClick={() => setActiveView("upload")} raised />
        <NavItem label="Analytics" active={activeView === "insights"} icon={<ChartIcon />} onClick={() => setActiveView("insights")} />
        <NavItem label="Settings" active={activeView === "settings" || activeView === "statements"} icon={<GearIcon />} onClick={() => setActiveView("settings")} dot />
      </div>
    </nav>
  );
}

function NavItem({ label, icon, active, onClick, dot, raised }: { label: string; icon: ReactNode; active?: boolean; onClick: () => void; dot?: boolean; raised?: boolean }) {
  return (
    <button onClick={onClick} className={active ? "relative text-[#5D36F0]" : "relative text-[#536180]"}>
      <div className={raised ? "relative mx-auto mb-0.5 grid h-9 w-9 -translate-y-1 place-items-center rounded-full bg-[#633EF2] text-white shadow-lg shadow-[#633EF2]/25" : "relative mx-auto mb-0.5 grid h-7 w-7 place-items-center min-[391px]:h-8 min-[391px]:w-8"}>
        {icon}
        {dot ? <span className="absolute right-0 top-0 h-2.5 w-2.5 rounded-full bg-[#5D36F0]" /> : null}
      </div>
      <span className={raised ? "-mt-1 block" : "block"}>{label}</span>
    </button>
  );
}

function getSummary(transactions: Transaction[]) {
  const income = transactions.filter((row) => row.direction === "income").reduce((sum, row) => sum + row.amount, 0);
  const expenses = transactions.filter((row) => row.direction === "expense").reduce((sum, row) => sum + row.amount, 0);
  return {
    income,
    expenses,
    net: income - expenses,
    balance: income - expenses
  };
}

function getReviewRows(transactions: Transaction[]) {
  return transactions
    .filter(isReviewTransaction)
    .sort((left, right) => left.confidence - right.confidence || right.date.localeCompare(left.date));
}

function getReviewStats(transactions: Transaction[]) {
  const needsReview = getReviewRows(transactions).length;
  const categorized = transactions.filter((transaction) => transaction.category !== "Other" && !isReviewTransaction(transaction)).length;
  let ruleCount = 0;
  try {
    ruleCount = typeof window === "undefined" ? 0 : (JSON.parse(window.localStorage.getItem("finwise.merchantRules") ?? "[]") as unknown[]).length;
  } catch {
    ruleCount = 0;
  }
  return {
    needsReview,
    categorizedPercent: transactions.length ? Math.round((categorized / transactions.length) * 100) : 0,
    ruleCount
  };
}

function isReviewTransaction(transaction: Transaction) {
  const merchantLooksMessy = transaction.merchant.length < 3 || /\b(unknown|payment|purchase|transaction|pos|card)\b/i.test(transaction.merchant) || /\d{5,}/.test(transaction.merchant);
  return transaction.needsReview || transaction.confidence < 0.75 || transaction.category === "Other" || merchantLooksMessy;
}

function shouldApplyMerchantCorrection(row: Transaction, edited: Transaction) {
  const rowMerchant = normalizeMerchantKey(row.merchant);
  const editedMerchant = normalizeMerchantKey(edited.merchant);
  if (!rowMerchant || !editedMerchant) return row.id === edited.id;
  return row.id === edited.id || rowMerchant === editedMerchant || rowMerchant.includes(editedMerchant) || editedMerchant.includes(rowMerchant);
}

function normalizeMerchantKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function getSpendingRows(transactions: Transaction[], period: SpendingPeriod): SpendingRow[] {
  const rows = filterByPeriod(transactions, period).filter((row) => row.direction === "expense");
  const totals = new Map<string, number>();
  rows.forEach((row) => totals.set(row.category, (totals.get(row.category) ?? 0) + row.amount));
  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  const spendingRows = Array.from(totals.entries())
    .map(([label, amount]) => ({
      label: label === "Ordering Out" ? "Dining Out" : label,
      amount,
      percent: total ? Number(((amount / total) * 100).toFixed(1)) : 0,
      color: categoryColors[label] ?? categoryColors.Other
    }))
    .sort((left, right) => right.amount - left.amount)
    .slice(0, 5);

  return spendingRows;
}

function getInsightCategories(transactions: Transaction[]) {
  const rows = getSpendingRows(transactions, "This Month");
  return rows.map((row) => ({ ...row, label: row.label === "Dining Out" ? "Ordering Out" : row.label }));
}

function getAllCategoryRows(transactions: Transaction[]) {
  const rows = transactions.filter((row) => row.direction === "expense");
  const totals = new Map<string, number>();
  rows.forEach((row) => {
    const label = normalizeCategoryLabel(row.category);
    totals.set(label, (totals.get(label) ?? 0) + row.amount);
  });
  const total = Array.from(totals.values()).reduce((sum, amount) => sum + amount, 0);

  return Array.from(totals.entries())
    .map(([label, amount]) => ({
      label,
      amount,
      percent: total ? Number(((amount / total) * 100).toFixed(1)) : 0,
      color: categoryColors[label] ?? categoryColors.Other
    }))
    .sort((left, right) => right.amount - left.amount);
}

function getMerchantInsights(transactions: Transaction[]) {
  const totals = new Map<string, number>();
  transactions.filter((row) => row.direction === "expense").forEach((row) => {
    totals.set(row.merchant, (totals.get(row.merchant) ?? 0) + row.amount);
  });

  const rows = Array.from(totals.entries())
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([merchant, amount]) => ({ merchant: toTitle(merchant), amount, count: transactions.filter((row) => row.merchant === merchant).length, change: "+0%", up: true, color: "bg-violet-50 text-violet-600" }));

  return rows.length ? rows : merchantInsights;
}

function getAllMerchantRows(transactions: Transaction[]) {
  const totals = new Map<string, { amount: number; count: number }>();
  transactions.filter((row) => row.direction === "expense").forEach((row) => {
    const merchant = toTitle(row.merchant);
    const current = totals.get(merchant) ?? { amount: 0, count: 0 };
    totals.set(merchant, { amount: current.amount + row.amount, count: current.count + 1 });
  });

  const rows = Array.from(totals.entries())
    .map(([merchant, value]) => ({ merchant, amount: value.amount, count: value.count, change: "+0%", up: true, color: "bg-violet-50 text-violet-600" }))
    .sort((left, right) => right.amount - left.amount);

  return rows.length ? rows : merchantInsights.map((row) => ({ ...row, count: 1 }));
}

function buildTrendRows(transactions: Transaction[]) {
  const expenseRows = transactions.filter((row) => row.direction === "expense").sort((left, right) => left.date.localeCompare(right.date));
  if (!expenseRows.length) return trendRows;

  const month = expenseRows[expenseRows.length - 1].date.slice(0, 7);
  const monthRows = expenseRows.filter((row) => row.date.startsWith(month));
  const checkpoints = [1, 8, 15, 22, 30];
  let cumulative = 0;

  return checkpoints.map((day) => {
    cumulative = monthRows
      .filter((row) => Number(row.date.slice(8, 10)) <= day)
      .reduce((sum, row) => sum + row.amount, 0);
    return { date: `${getShortMonth(month)} ${day}`, amount: cumulative };
  });
}

function groupTransactionsByMonth(transactions: Transaction[]) {
  const groups = new Map<string, Transaction[]>();
  [...transactions].sort((left, right) => right.date.localeCompare(left.date)).forEach((transaction) => {
    const month = getMonthLabel(transaction.date);
    groups.set(month, [...(groups.get(month) ?? []), transaction]);
  });

  return Array.from(groups.entries()).map(([month, rows]) => ({
    month,
    count: rows.length,
    rows
  }));
}

function getStatementSummaries(transactions: Transaction[], latestPeriod: StatementPeriodInfo | null): StatementSummary[] {
  if (!transactions.length) return [];

  const groups = new Map<string, Transaction[]>();
  for (const transaction of transactions) {
    const id = transaction.statementId ?? `legacy:${transaction.date.slice(0, 7)}`;
    groups.set(id, [...(groups.get(id) ?? []), transaction]);
  }

  return Array.from(groups.entries())
    .map(([id, rows]) => {
      const sortedDates = rows.map((row) => row.date).sort();
      const totalIncome = rows.filter((row) => row.direction === "income").reduce((sum, row) => sum + row.amount, 0);
      const totalExpenses = rows.filter((row) => row.direction === "expense").reduce((sum, row) => sum + row.amount, 0);
      const period = getPeriodFromRows(rows, latestPeriod);
      const needsReview = rows.filter((row) => row.needsReview || row.confidence < 0.75).length;

      return {
        id,
        fileName: rows[0]?.statementFileName ?? `${getMonthLabel(sortedDates[0] ?? rows[0]?.date)} statement`,
        bank: rows[0]?.bank ?? "Unknown Bank",
        status: needsReview ? "review" : "processed",
        uploadedAt: rows[0]?.statementUploadedAt ?? `${sortedDates.at(-1) ?? rows[0]?.date}T00:00:00.000Z`,
        transactionCount: rows.length,
        totalIncome,
        totalExpenses,
        period,
        needsReview
      } satisfies StatementSummary;
    })
    .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
}

function getPeriodFromRows(rows: Transaction[], fallback: StatementPeriodInfo | null): StatementPeriodInfo {
  const sorted = rows.map((row) => row.date).sort();
  const startDate = sorted[0] ?? fallback?.startDate ?? null;
  const endDate = sorted.at(-1) ?? fallback?.endDate ?? null;
  const label = rows[0]?.statementPeriodLabel ?? fallback?.label ?? getMonthLabel(startDate ?? "");
  return {
    startDate,
    endDate,
    days: startDate && endDate ? Math.max(1, Math.round((new Date(`${endDate}T00:00:00`).getTime() - new Date(`${startDate}T00:00:00`).getTime()) / 86400000) + 1) : fallback?.days ?? 0,
    label
  };
}

function getLatestPeriodFromTransactions(transactions: Transaction[]) {
  const latest = getStatementSummaries(transactions, null)[0];
  return latest?.period ?? null;
}

function filterByPeriod(transactions: Transaction[], period: SpendingPeriod) {
  const sorted = [...transactions].sort((left, right) => right.date.localeCompare(left.date));
  const currentMonth = sorted[0]?.date.slice(0, 7);
  if (!currentMonth || period === "Year") return transactions;
  if (period === "This Month") return transactions.filter((row) => row.date.startsWith(currentMonth));

  const date = new Date(`${currentMonth}-01T00:00:00`);
  date.setMonth(date.getMonth() - 1);
  const lastMonth = date.toISOString().slice(0, 7);
  return transactions.filter((row) => row.date.startsWith(lastMonth));
}

function getMonthLabel(date: string) {
  const parsed = new Date(`${date.slice(0, 10)}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return "Imported";
  return parsed.toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

function getShortMonth(month: string) {
  const parsed = new Date(`${month}-01T00:00:00`);
  return parsed.toLocaleDateString("en-US", { month: "short" });
}

function formatMonthRange(transactions: Transaction[]) {
  if (!transactions.length) return "No statements yet";
  const sorted = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  return `${getMonthLabel(sorted[0].date)} - ${getMonthLabel(sorted[sorted.length - 1].date)}`;
}

function getDateRange(transactions: Transaction[]) {
  if (!transactions.length) return "No transactions";
  const sorted = [...transactions].sort((left, right) => left.date.localeCompare(right.date));
  return `${sorted[0].date} to ${sorted[sorted.length - 1].date}`;
}

function normalizeCategoryLabel(category: string) {
  return category === "Ordering Out" ? "Dining Out" : category;
}

function categoryTitleMatches(title: string, label: string) {
  const normalizedTitle = title.toLowerCase();
  const normalizedLabel = label.toLowerCase();
  if (normalizedTitle.includes(normalizedLabel)) return true;
  if (label === "Dining Out" && normalizedTitle.includes("ordering out")) return true;
  if (label === "Ordering Out" && normalizedTitle.includes("dining out")) return true;
  return false;
}

function formatPeriodDates(period: StatementPeriodInfo) {
  if (!period.startDate || !period.endDate) return "Unknown dates";
  return `${period.startDate} to ${period.endDate}`;
}

async function loadCloudData(userId: string) {
  return loadFinWiseData(userId);
}

async function saveCloudData(userId: string, transactions: Transaction[], latestPeriod: StatementPeriodInfo | null) {
  let merchantRules: MerchantRule[] = [];
  try {
    merchantRules = JSON.parse(window.localStorage.getItem("finwise.merchantRules") ?? "[]") as MerchantRule[];
  } catch {
    merchantRules = [];
  }

  return saveFinWiseData(userId, transactions, latestPeriod, merchantRules);
}

function saveMerchantRule(transaction: Transaction, category: Transaction["category"]) {
  const pattern = normalizeMerchantKey(transaction.merchant);
  if (!pattern) return;

  try {
    const current = JSON.parse(window.localStorage.getItem("finwise.merchantRules") ?? "[]") as Array<{ pattern: string; merchant?: string; category: Transaction["category"]; subcategory?: string }>;
    const next = [{ pattern, merchant: transaction.merchant, category, subcategory: category }, ...current.filter((rule) => rule.pattern !== pattern)];
    window.localStorage.setItem("finwise.merchantRules", JSON.stringify(next.slice(0, 200)));
  } catch {
    window.localStorage.setItem("finwise.merchantRules", JSON.stringify([{ pattern, merchant: transaction.merchant, category, subcategory: category }]));
  }
}

function dedupe(transactions: Transaction[]) {
  const seen = new Set<string>();
  return transactions.filter((transaction) => {
    const key = transaction.duplicateHash || [transaction.date, transaction.descriptionRaw, transaction.amount, transaction.direction, transaction.bank].join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function sanitizeTransactions(transactions: Transaction[]) {
  return transactions.filter((transaction) => {
    const amountIsValid = Number.isFinite(transaction.amount) && transaction.amount > 0 && transaction.amount < 1_000_000;
    const dateIsValid = /^\d{4}-\d{2}-\d{2}$/.test(transaction.date);
    const merchantIsValid = transaction.merchant.trim().length > 0;
    const descriptionIsValid = !isBalanceLikeTransaction(transaction.descriptionRaw) && !isBalanceLikeTransaction(transaction.merchant);
    return amountIsValid && dateIsValid && merchantIsValid && descriptionIsValid;
  });
}

function isBalanceLikeTransaction(value: string) {
  return /\b(opening balance|closing balance|available balance|current balance|ledger balance|running balance|brought forward|carried forward|total debit|total credit|statement period|account number|iban)\b/i.test(value);
}

function isDemoDataset(transactions: Transaction[]) {
  return transactions.length > 0 && transactions.every((transaction) => transaction.id.startsWith("demo-"));
}

function getUserDisplayName(user: User | null) {
  const metadata = user?.user_metadata as { full_name?: string; name?: string } | undefined;
  const metadataName = metadata?.full_name || metadata?.name;
  if (metadataName?.trim()) return toTitle(metadataName.trim().split(/\s+/)[0]);

  const emailName = user?.email?.split("@")[0]?.replace(/[._-]+/g, " ");
  if (emailName?.trim()) return toTitle(emailName.trim().split(/\s+/)[0]);

  return "there";
}

function loadLocalSnapshot(userId: string): LocalSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.localStorage.getItem(getLocalSnapshotKey(userId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as LocalSnapshot;
    if (!Array.isArray(parsed.transactions)) return null;
    return parsed;
  } catch {
    window.localStorage.removeItem(getLocalSnapshotKey(userId));
    return null;
  }
}

function saveLocalSnapshot(userId: string, transactions: Transaction[], latestPeriod: StatementPeriodInfo | null) {
  if (typeof window === "undefined") return;

  try {
    const snapshot: LocalSnapshot = {
      transactions,
      latestPeriod,
      savedAt: new Date().toISOString()
    };
    window.localStorage.setItem(getLocalSnapshotKey(userId), JSON.stringify(snapshot));
  } catch {
    // Local backup is best-effort; Supabase remains the source of truth.
  }
}

function getLocalSnapshotKey(userId: string) {
  return `finwise.snapshot.${userId}`;
}

function useAppViewportWidth() {
  const [width, setWidth] = useState(390);

  useEffect(() => {
    const updateWidth = () => setWidth(Math.min(window.innerWidth, 440));
    updateWidth();
    window.addEventListener("resize", updateWidth);
    return () => window.removeEventListener("resize", updateWidth);
  }, []);

  return width;
}

function formatAmount(value: number) {
  return value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatDisplayAmount(value: number) {
  const absolute = Math.abs(value);
  if (absolute >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(2)}B`;
  if (absolute >= 1_000_000) return `${(value / 1_000_000).toFixed(2)}M`;
  return formatAmount(value);
}

function formatCompact(value: number) {
  if (value >= 1000) return `${Math.round(value / 1000)}k`;
  return formatAmount(value);
}

function toTitle(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getMerchantLogoUrls(merchant: string) {
  const key = getLogoStorageKey(merchant);
  const badUrls = getBadLogoUrls(merchant);
  const override = getCachedMerchantLogoOverride(merchant);
  if (override && !badUrls.includes(override.logoUrl)) return [override.logoUrl];

  if (typeof window !== "undefined") {
    try {
      const cached = window.localStorage.getItem(key);
      if (cached) {
        const urls = (JSON.parse(cached) as string[]).filter((url) => !badUrls.includes(url));
        if (urls.length) return urls;
      }
    } catch {
      // Ignore storage failures; logo fallback still works.
    }
  }

  const urls = getKnownMerchantLogoUrls(merchant).filter((url) => !badUrls.includes(url));
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(key, JSON.stringify(urls));
    } catch {
      // Ignore storage failures; image can still load for this session.
    }
  }
  return urls;
}

function getKnownMerchantLogoUrls(merchant: string) {
  const normalized = normalizeLogoKey(merchant);
  const match = merchantLogoDomains.find((item) => item.keywords.some((keyword) => normalized.includes(normalizeLogoKey(keyword))));
  if (!match) return [];
  return [
    `https://logo.clearbit.com/${match.domain}`,
    `https://www.google.com/s2/favicons?domain=${match.domain}&sz=128`
  ];
}

function cacheMerchantLogoOverrides(logos: MerchantLogoRecord[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem("finwise.logoOverrides", JSON.stringify(logos));
  } catch {
    // Logo persistence should never block app data.
  }
}

function getCachedMerchantLogoOverride(merchant: string) {
  if (typeof window === "undefined") return null;
  try {
    const logos = JSON.parse(window.localStorage.getItem("finwise.logoOverrides") ?? "[]") as MerchantLogoRecord[];
    const key = getMerchantLogoKey(merchant);
    return logos.find((logo) => logo.merchantKey === key) ?? null;
  } catch {
    return null;
  }
}

function mergeLogoOverrides(current: MerchantLogoRecord[], transactions: Transaction[]) {
  const byKey = new Map(current.map((logo) => [logo.merchantKey, logo]));
  for (const transaction of transactions) {
    const merchantKey = getMerchantLogoKey(transaction.merchant);
    if (!merchantKey || byKey.has(merchantKey)) continue;
    const logoUrl = getKnownMerchantLogoUrls(transaction.merchant)[0];
    if (!logoUrl) continue;
    byKey.set(merchantKey, {
      merchantKey,
      merchantName: transaction.merchant,
      logoUrl,
      source: "known_domain",
      confidence: 0.86
    });
  }
  return Array.from(byKey.values());
}

function rememberBadLogoUrl(merchant: string, url: string) {
  if (typeof window === "undefined") return;

  try {
    const key = getBadLogoStorageKey(merchant);
    const current = JSON.parse(window.localStorage.getItem(key) ?? "[]") as string[];
    if (!current.includes(url)) {
      window.localStorage.setItem(key, JSON.stringify([...current, url].slice(-12)));
    }
  } catch {
    // Broken storage should never block the transaction list.
  }
}

function getBadLogoUrls(merchant: string) {
  if (typeof window === "undefined") return [];

  try {
    return JSON.parse(window.localStorage.getItem(getBadLogoStorageKey(merchant)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

function getLogoStorageKey(merchant: string) {
  return `finwise.logo.${getMerchantLogoKey(merchant) || "unknown"}`;
}

function getBadLogoStorageKey(merchant: string) {
  return `${getLogoStorageKey(merchant)}.bad`;
}

function normalizeLogoKey(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").replace(/\s+/g, " ").trim();
}

function getMerchantLogoKey(merchant: string) {
  return normalizeLogoKey(merchant).replace(/\s+/g, "-");
}

function getLogoFallbackText(merchant: string, fallback: string) {
  const normalized = normalizeLogoKey(merchant) || normalizeLogoKey(fallback) || "fw";
  const words = normalized.split(" ").filter(Boolean);
  if (words.length >= 2) return `${words[0][0]}${words[1][0]}`.toUpperCase();
  return normalized.slice(0, 2).toUpperCase();
}

const logoFallbackClasses = [
  "bg-violet-50 text-violet-700",
  "bg-emerald-50 text-emerald-700",
  "bg-sky-50 text-sky-700",
  "bg-orange-50 text-orange-700",
  "bg-rose-50 text-rose-700",
  "bg-slate-100 text-slate-700"
];

function getLogoFallbackClass(merchant: string) {
  const normalized = normalizeLogoKey(merchant);
  const hash = Array.from(normalized).reduce((total, char) => total + char.charCodeAt(0), 0);
  return logoFallbackClasses[hash % logoFallbackClasses.length];
}

function makeConicGradient(rows: SpendingRow[]) {
  let start = 0;
  const stops = rows.map((row) => {
    const end = start + row.percent;
    const segment = `${row.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });
  return `conic-gradient(${stops.join(", ")})`;
}

function IconShell({ children, className = "h-5 w-5" }: { children: ReactNode; className?: string }) {
  return <svg aria-hidden="true" viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round">{children}</svg>;
}

function BellIcon() { return <IconShell><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></IconShell>; }
function LogoMark() { return <svg aria-hidden="true" viewBox="0 0 28 28" className="h-8 w-8"><rect x="3" y="15" width="5" height="10" rx="2.5" fill="#38BDF8" /><rect x="11.5" y="9" width="5" height="16" rx="2.5" fill="#6D35F5" /><rect x="20" y="3" width="5" height="22" rx="2.5" fill="#D946EF" /></svg>; }
function RobotIcon() { return <svg aria-hidden="true" viewBox="0 0 72 72" className="h-[64px] w-[64px] shrink-0"><circle cx="36" cy="39" r="25" fill="#EDE9FE" /><path d="M23 32c0-8 6-14 13-14s13 6 13 14v11c0 8-6 13-13 13s-13-5-13-13V32Z" fill="#5B21B6" /><rect x="18" y="34" width="36" height="20" rx="10" fill="#6D35F5" /><circle cx="29" cy="44" r="3.5" fill="white" /><circle cx="43" cy="44" r="3.5" fill="white" /><path d="M36 18v-7" stroke="#6D35F5" strokeWidth="3" strokeLinecap="round" /><circle cx="36" cy="9" r="3" fill="#6D35F5" /><path d="M18 42h-4M58 42h-4" stroke="#6D35F5" strokeWidth="4" strokeLinecap="round" /></svg>; }
function EyeIcon() { return <IconShell className="h-5 w-5"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></IconShell>; }
function TrendIcon() { return <IconShell className="h-7 w-7"><path d="m5 15 5-5 4 4 5-7" /><path d="M15 7h4v4" /></IconShell>; }
function ArrowDownIcon() { return <IconShell><path d="M12 4v15" /><path d="m6 13 6 6 6-6" /></IconShell>; }
function ArrowUpIcon() { return <IconShell><path d="M12 20V5" /><path d="m6 11 6-6 6 6" /></IconShell>; }
function WalletIcon() { return <IconShell><path d="M4 7h16v12H4z" /><path d="M16 12h4" /></IconShell>; }
function StatementIcon() { return <IconShell className="h-7 w-7"><path d="M7 3h8l4 4v14H7z" /><path d="M15 3v5h5" /><path d="M10 13h6" /><path d="M10 17h4" /></IconShell>; }
function CheckIcon() { return <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="m3 8 3 3 7-7" /></svg>; }
function ChevronIcon() { return <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 text-[#536180]" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m9 18 6-6-6-6" /></svg>; }
function HomeIcon() { return <IconShell><path d="m3 11 9-8 9 8" /><path d="M5 10v10h14V10" /></IconShell>; }
function ReceiptIcon() { return <IconShell><path d="M7 3h10v18l-2-1-2 1-2-1-2 1-2-1z" /><path d="M9 8h6" /><path d="M9 12h6" /></IconShell>; }
function UploadIcon() { return <IconShell><path d="M12 16V4" /><path d="m7 9 5-5 5 5" /><path d="M5 20h14" /></IconShell>; }
function ChartIcon() { return <IconShell><path d="M6 20V10" /><path d="M12 20V4" /><path d="M18 20v-7" /></IconShell>; }
function GearIcon() { return <IconShell><circle cx="12" cy="12" r="3" /><path d="M19.4 15a8 8 0 0 0 .1-2l2-1.5-2-3.5-2.4 1a8 8 0 0 0-1.7-1L15 5.5h-4L10.6 8a8 8 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a8 8 0 0 0 .1 2l-2.1 1.5 2 3.5 2.4-1a8 8 0 0 0 1.7 1l.4 2.5h4l.4-2.5a8 8 0 0 0 1.7-1l2.4 1 2-3.5z" /></IconShell>; }
function SearchIcon() { return <IconShell className="h-4 w-4"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></IconShell>; }
function ChevronDownIcon() { return <IconShell className="h-4 w-4"><path d="m6 9 6 6 6-6" /></IconShell>; }
function ChevronUpIcon({ collapsed }: { collapsed?: boolean }) { return <IconShell className={collapsed ? "h-4 w-4 rotate-180" : "h-4 w-4"}><path d="m18 15-6-6-6 6" /></IconShell>; }
function FilterIcon() { return <IconShell className="h-4 w-4"><path d="M4 6h16" /><path d="M7 12h10" /><path d="M10 18h4" /></IconShell>; }
function CalendarIcon() { return <IconShell className="h-4 w-4"><path d="M8 2v4" /><path d="M16 2v4" /><path d="M3 10h18" /><rect x="3" y="4" width="18" height="18" rx="3" /></IconShell>; }
function OpenIcon() { return <IconShell className="h-4 w-4"><path d="M14 3h7v7" /><path d="m10 14 11-11" /><path d="M21 14v5a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5" /></IconShell>; }
function DotsIcon() { return <IconShell className="h-4 w-4"><path d="M12 5h.01" /><path d="M12 12h.01" /><path d="M12 19h.01" /></IconShell>; }
