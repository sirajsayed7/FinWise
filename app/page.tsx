"use client";

import { useCallback, useEffect, useRef, useState, type ChangeEvent } from "react";
import dynamic from "next/dynamic";
import type { User } from "@supabase/supabase-js";
import { toast } from "sonner";
import { BottomNavigation } from "@/components/finwise/app-shell";
import { AuthScreen, LoadingScreen } from "@/components/finwise/auth-screen";
import { HomeDashboard } from "@/components/finwise/home-dashboard";
import type { ActiveView, PendingImport, PendingTransactionPatch, StatementPeriodInfo } from "@/lib/dashboard-types";
import { loadFinWiseData, loadMerchantLogoOverrides, saveFinWiseData, saveMerchantLogoOverrides } from "@/lib/finwise-db";
import {
  applyMerchantCorrection, applySavedMerchantRules, dedupe, getLatestPeriodFromTransactions,
  getStoredMerchantRules, getUserDisplayName, mergeMerchantRules, sanitizeTransactions, saveMerchantRule
} from "@/lib/finance-view-model";
import {
  hasPendingLocalSync,
  loadLocalSnapshot,
  markLocalSnapshotSynced,
  reconcileLocalAndCloud,
  saveLocalSnapshot
} from "@/lib/local-cache";
import { cacheMerchantLogoOverrides, mergeLogoOverrides, preloadMerchantLogos } from "@/lib/merchant-logos";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase-client";
import type { MerchantLogoRecord, MerchantRule, Transaction } from "@/lib/types";

function ViewLoading() {
  return <div className="h-40 animate-pulse rounded-[24px] bg-white shadow-sm ring-1 ring-[rgba(15,23,42,0.05)]" />;
}

const InsightsPage = dynamic(() => import("@/components/finwise/insights-page").then((module) => module.InsightsPage), { ssr: false, loading: ViewLoading });
const SettingsPage = dynamic(() => import("@/components/finwise/settings-pages").then((module) => module.SettingsPage), { ssr: false, loading: ViewLoading });
const StatementsPageV2 = dynamic(() => import("@/components/finwise/settings-pages").then((module) => module.StatementsPageV2), { ssr: false, loading: ViewLoading });
const TransactionsPage = dynamic(() => import("@/components/finwise/transactions-page").then((module) => module.TransactionsPage), { ssr: false, loading: ViewLoading });
const ReviewWorkflowPage = dynamic(() => import("@/components/finwise/transactions-page").then((module) => module.ReviewWorkflowPage), { ssr: false, loading: ViewLoading });
const UploadPage = dynamic(() => import("@/components/finwise/upload-page").then((module) => module.UploadPage), { ssr: false, loading: ViewLoading });



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
  const [localCacheReady, setLocalCacheReady] = useState(isSupabaseConfigured);
  const userChangedDataRef = useRef(false);
  const forceFullSyncRef = useRef(false);
  const syncGenerationRef = useRef(0);
  const [syncRetryTick, setSyncRetryTick] = useState(0);
  const restoreInputRef = useRef<HTMLInputElement | null>(null);
  const displayName = getUserDisplayName(authUser);
  const transactionCount = transactions.length;

  useEffect(() => {
    if (isSupabaseConfigured) return;

    let cancelled = false;
    loadLocalSnapshot(null).then((snapshot) => {
      if (cancelled || !snapshot?.transactions.length) return;
      const clean = applySavedMerchantRules(dedupe(sanitizeTransactions(snapshot.transactions)));
      setTransactions(clean);
      setLatestPeriod(snapshot.latestPeriod);
      setUploadStatus(clean.length ? `${clean.length} transactions` : "No uploads yet");
    }).finally(() => {
      if (!cancelled) setLocalCacheReady(true);
    });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (isSupabaseConfigured) return;
    if (!localCacheReady) return;
    if (!transactions.length && !latestPeriod) return;
    void saveLocalSnapshot(null, transactions, latestPeriod);
  }, [transactions, latestPeriod, localCacheReady]);

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
    const retry = () => setSyncRetryTick((current) => current + 1);
    const retryWhenVisible = () => {
      if (document.visibilityState === "visible") retry();
    };
    window.addEventListener("online", retry);
    document.addEventListener("visibilitychange", retryWhenVisible);
    return () => {
      window.removeEventListener("online", retry);
      document.removeEventListener("visibilitychange", retryWhenVisible);
    };
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured || !authUser) return;

    let cancelled = false;

    async function loadCachedThenCloud() {
      const localSnapshot = await loadLocalSnapshot(authUser!.id);
      if (cancelled) return;

      if (localSnapshot?.transactions.length) {
        const cleanLocal = applySavedMerchantRules(dedupe(sanitizeTransactions(localSnapshot.transactions)));
        setTransactions(cleanLocal);
        setLatestPeriod(localSnapshot.latestPeriod);
        setUploadStatus(`${cleanLocal.length} transactions`);
        setSyncStatus(hasPendingLocalSync(localSnapshot) ? "Saved on this device" : "Loaded from this device");
      } else {
        setSyncStatus("Loading account data...");
      }

      try {
        const data = await loadFinWiseData(authUser!.id);
        if (cancelled) return;

        const cleanCloud = dedupe(sanitizeTransactions(data?.transactions ?? []));
        const reconciled = reconcileLocalAndCloud(
          localSnapshot,
          cleanCloud,
          data?.latest_period ?? null,
          data?.tombstones ?? []
        );
        const localRules = mergeMerchantRules(data?.merchant_rules ?? [], getStoredMerchantRules());
        const nextTransactions = applySavedMerchantRules(
          dedupe(sanitizeTransactions(reconciled.transactions)),
          localRules
        );
        const nextPeriod = reconciled.latestPeriod;
        const logoOverrides = await loadMerchantLogoOverrides(authUser!.id);
        if (cancelled) return;

        forceFullSyncRef.current = Boolean(data && !data.normalized);
        userChangedDataRef.current = reconciled.hasPendingSync || forceFullSyncRef.current;
        setTransactions(nextTransactions);
        setLatestPeriod(nextPeriod);
        setMerchantLogoOverrides(logoOverrides);
        setUploadStatus(nextTransactions.length ? `${nextTransactions.length} transactions` : "No uploads yet");
        window.localStorage.setItem("finwise.merchantRules", JSON.stringify(localRules));
        cacheMerchantLogoOverrides(logoOverrides);
        if (!reconciled.hasPendingSync && data?.normalized) {
          await saveLocalSnapshot(authUser!.id, nextTransactions, nextPeriod, { replaceFromCloud: true });
        }
        if (cancelled) return;
        setCloudLoaded(true);
        setSyncStatus(
          reconciled.hasPendingSync || forceFullSyncRef.current
            ? "Syncing device changes..."
            : nextTransactions.length
              ? "Synced"
              : "Ready for first upload"
        );
      } catch {
        if (cancelled) return;
        setCloudLoaded(true);
        userChangedDataRef.current = hasPendingLocalSync(localSnapshot);
        setSyncStatus(localSnapshot?.transactions.length ? "Offline - using device data" : "Cloud sync unavailable");
      }
    }

    void loadCachedThenCloud();

    return () => {
      cancelled = true;
    };
  }, [authUser]);

  useEffect(() => {
    if (!isSupabaseConfigured || !authUser || !cloudLoaded) return;

    const generation = ++syncGenerationRef.current;
    const timer = window.setTimeout(() => {
      void syncPendingChanges();
    }, 450);

    async function syncPendingChanges() {
      const snapshot = await saveLocalSnapshot(
        authUser!.id,
        transactions,
        latestPeriod,
        { markDirty: userChangedDataRef.current }
      );
      const forceFull = forceFullSyncRef.current;
      if (!hasPendingLocalSync(snapshot) && !forceFull) return;

      setSyncStatus("Syncing...");
      const result = await saveFinWiseData(
        authUser!.id,
        snapshot.transactions,
        snapshot.latestPeriod,
        getStoredMerchantRules(),
        {
          dirtyTransactionIds: snapshot.sync.dirtyTransactionIds,
          deletedTransactions: snapshot.sync.deletedTransactions,
          deletedStatementIds: snapshot.sync.deletedStatementIds,
          deviceId: snapshot.sync.deviceId,
          forceFull
        }
      );
      if (generation !== syncGenerationRef.current) return;

      if (!result.ok) {
        setSyncStatus("Saved on device - waiting for connection");
        return;
      }
      if (result.usedLegacyFallback) {
        forceFullSyncRef.current = true;
        setSyncStatus("Database migration required");
        return;
      }

      const remoteIds = new Set(result.remoteWins.map((transaction) => transaction.id));
      const resolvedTransactions = result.remoteWins.length
        ? dedupe([
            ...result.remoteWins,
            ...snapshot.transactions.filter((transaction) => !remoteIds.has(transaction.id))
          ])
        : snapshot.transactions;

      if (result.remoteWins.length) {
        setTransactions(resolvedTransactions);
        toast.message("Cloud changes were newer", {
          description: `${result.remoteWins.length} transaction conflict${result.remoteWins.length === 1 ? "" : "s"} resolved safely.`
        });
      }
      await markLocalSnapshotSynced(
        authUser!.id,
        resolvedTransactions,
        snapshot.latestPeriod
      );
      userChangedDataRef.current = false;
      forceFullSyncRef.current = false;
      setSyncStatus("Synced");
    }

    return () => window.clearTimeout(timer);
  }, [transactions, latestPeriod, authUser, cloudLoaded, syncRetryTick]);

  useEffect(() => {
    if (!transactions.length) return;
    return preloadMerchantLogos(transactions.map((transaction) => transaction.merchant));
  }, [transactions]);

  function clearUploads() {
    const previousTransactions = transactions;
    const previousPeriod = latestPeriod;
    userChangedDataRef.current = true;
    setTransactions([]);
    setLatestPeriod(null);
    setPendingImport(null);
    setUploadStatus("No uploads yet");
    toast.success("Imported data cleared", {
      description: "Your dashboard is ready for a fresh statement.",
      action: previousTransactions.length
        ? {
            label: "Undo",
            onClick: () => {
              userChangedDataRef.current = true;
              setTransactions(previousTransactions);
              setLatestPeriod(previousPeriod);
              setUploadStatus(`${previousTransactions.length} transactions`);
            }
          }
        : undefined
    });
  }

  function clearStatement(statementId: string) {
    const removedTransactions = transactions.filter((transaction) => transaction.statementId === statementId);
    if (!removedTransactions.length) return;
    const previousPeriod = latestPeriod;
    userChangedDataRef.current = true;
    const nextTransactions = transactions.filter((transaction) => transaction.statementId !== statementId);
    setTransactions(nextTransactions);
    const nextLatest = getLatestPeriodFromTransactions(nextTransactions);
    setLatestPeriod(nextLatest);
    setUploadStatus(nextTransactions.length ? `${nextTransactions.length} transactions` : "No uploads yet");
    toast.success("Statement removed", {
      description: nextTransactions.length ? `${nextTransactions.length} transactions remain.` : "No imported transactions remain.",
      action: {
        label: "Undo",
        onClick: () => {
          const restored = dedupe([...removedTransactions, ...nextTransactions]);
          userChangedDataRef.current = true;
          setTransactions(restored);
          setLatestPeriod(previousPeriod ?? getLatestPeriodFromTransactions(restored));
          setUploadStatus(`${restored.length} transactions`);
        }
      }
    });
  }

  function exportBackup() {
    const backup = {
      version: 1,
      exportedAt: new Date().toISOString(),
      latestPeriod,
      transactions,
      merchantRules: getStoredMerchantRules(),
      merchantLogoOverrides
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `finwise-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
    toast.success("Backup exported");
  }

  async function restoreBackup(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as {
        transactions?: Transaction[];
        latestPeriod?: StatementPeriodInfo | null;
        merchantRules?: MerchantRule[];
        merchantLogoOverrides?: MerchantLogoRecord[];
      };
      const restoredTransactions = applySavedMerchantRules(dedupe(sanitizeTransactions(parsed.transactions ?? [])), parsed.merchantRules ?? []);
      if (!restoredTransactions.length) throw new Error("No transactions found in backup.");
      userChangedDataRef.current = true;
      setTransactions(restoredTransactions);
      setLatestPeriod(parsed.latestPeriod ?? getLatestPeriodFromTransactions(restoredTransactions));
      setMerchantLogoOverrides(parsed.merchantLogoOverrides ?? []);
      cacheMerchantLogoOverrides(parsed.merchantLogoOverrides ?? []);
      if (parsed.merchantRules) {
        window.localStorage.setItem("finwise.merchantRules", JSON.stringify(parsed.merchantRules.slice(0, 200)));
      }
      setUploadStatus(`${restoredTransactions.length} transactions restored`);
      toast.success("Backup restored", {
        description: `${restoredTransactions.length} transactions loaded.`
      });
    } catch (error) {
      toast.error("Restore failed", {
        description: error instanceof Error ? error.message : "Choose a valid FinWise backup file."
      });
    }
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
    if (duplicateExists) {
      toast.warning("Duplicate statement detected", {
        description: "Confirming this import will replace the older copy instead of duplicating it."
      });
    } else {
      toast.success("Statement ready for review", {
        description: `${imported.length} transactions detected.`
      });
    }
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
      return nextTransactions;
    });
    setUploadStatus(`${imported.length} transactions saved`);
    toast.success("Import saved", {
      description: `${imported.length} transactions were added to your dashboard.`
    });
    if (pendingImport.period) {
      setLatestPeriod(pendingImport.period);
    }
    setPendingImport(null);
    setActiveView("transactions");
  }

  const removePendingTransaction = useCallback((transactionId: string) => {
    setPendingImport((current) => {
      if (!current) return current;
      const nextTransactions = current.transactions.filter((transaction) => transaction.id !== transactionId);
      return { ...current, transactions: nextTransactions };
    });
  }, []);

  const updatePendingTransaction = useCallback((transactionId: string, patch: PendingTransactionPatch) => {
    setPendingImport((current) => {
      if (!current) return current;
      const editedTransaction = current.transactions.find((transaction) => transaction.id === transactionId);
      const savedRule = editedTransaction && patch.category ? saveMerchantRule({ ...editedTransaction, ...patch }, patch.category) : null;
      const nextTransactions = current.transactions.map((transaction) => {
        if (transaction.id !== transactionId) return transaction;
        const next = {
          ...transaction,
          ...patch,
          amount: patch.amount !== undefined ? Math.max(0, patch.amount) : transaction.amount,
          subcategory: patch.category ?? transaction.subcategory,
          confidence: patch.category ? 1 : transaction.confidence,
          needsReview: patch.category ? false : transaction.needsReview,
          categorySource: patch.category ? ("user_rule" as const) : transaction.categorySource,
          reason: patch.category ? `Saved merchant rule for "${transaction.merchant}".` : transaction.reason
        };
        return {
          ...next,
          merchant: next.merchant.trim() || transaction.merchant
        };
      });
      return {
        ...current,
        transactions: editedTransaction && patch.category
          ? applyMerchantCorrection(nextTransactions, editedTransaction, patch.category, savedRule?.pattern)
          : nextTransactions
      };
    });
  }, []);

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
        {activeView === "settings" ? <SettingsPage setActiveView={setActiveView} authEmail={authUser?.email ?? null} syncStatus={syncStatus} onSignOut={signOut} onExportBackup={exportBackup} onRestoreBackup={() => restoreInputRef.current?.click()} /> : null}
        {activeView === "statements" ? <StatementsPageV2 transactions={transactions} latestPeriod={latestPeriod} setActiveView={setActiveView} onClearUploads={clearUploads} onClearStatement={clearStatement} /> : null}
        {activeView === "review" ? <ReviewWorkflowPage transactions={transactions} setTransactions={updateTransactions} setActiveView={setActiveView} /> : null}
        <input ref={restoreInputRef} type="file" accept="application/json,.json" className="hidden" onChange={restoreBackup} />
      </div>
      <BottomNavigation activeView={activeView} setActiveView={setActiveView} />
    </main>
  );
}
