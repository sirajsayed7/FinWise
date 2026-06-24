import { openDB, type DBSchema } from "idb";
import type { Transaction } from "@/lib/types";

export type CachedStatementPeriodInfo = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

export type FinWiseLocalSnapshot = {
  transactions: Transaction[];
  latestPeriod: CachedStatementPeriodInfo | null;
  savedAt: string;
};

interface FinWiseCacheDB extends DBSchema {
  snapshots: {
    key: string;
    value: FinWiseLocalSnapshot;
  };
}

const DB_NAME = "finwise-local-cache";
const DB_VERSION = 1;
const LOCAL_USER_KEY = "local";

function canUseIndexedDB() {
  return typeof window !== "undefined" && "indexedDB" in window;
}

async function getDB() {
  if (!canUseIndexedDB()) return null;

  return openDB<FinWiseCacheDB>(DB_NAME, DB_VERSION, {
    upgrade(db) {
      if (!db.objectStoreNames.contains("snapshots")) {
        db.createObjectStore("snapshots");
      }
    }
  });
}

function snapshotKey(userId?: string | null) {
  return userId || LOCAL_USER_KEY;
}

export async function loadLocalSnapshot(userId?: string | null): Promise<FinWiseLocalSnapshot | null> {
  try {
    const db = await getDB();
    if (!db) return loadLegacySnapshot(userId);
    return (await db.get("snapshots", snapshotKey(userId))) ?? loadLegacySnapshot(userId);
  } catch {
    return loadLegacySnapshot(userId);
  }
}

export async function saveLocalSnapshot(userId: string | null | undefined, transactions: Transaction[], latestPeriod: CachedStatementPeriodInfo | null) {
  const snapshot: FinWiseLocalSnapshot = {
    transactions,
    latestPeriod,
    savedAt: new Date().toISOString()
  };

  try {
    const db = await getDB();
    if (!db) return saveLegacySnapshot(userId, snapshot);
    await db.put("snapshots", snapshot, snapshotKey(userId));
  } catch {
    saveLegacySnapshot(userId, snapshot);
  }
}

export async function clearLocalSnapshot(userId?: string | null) {
  try {
    const db = await getDB();
    if (db) await db.delete("snapshots", snapshotKey(userId));
  } catch {
    // Best effort cache cleanup.
  }

  if (typeof window !== "undefined") {
    window.localStorage.removeItem(getLegacySnapshotKey(userId));
    window.localStorage.removeItem("finwise.transactions");
    window.localStorage.removeItem("finwise.latestPeriod");
  }
}

function loadLegacySnapshot(userId?: string | null): FinWiseLocalSnapshot | null {
  if (typeof window === "undefined") return null;

  try {
    const rawSnapshot = window.localStorage.getItem(getLegacySnapshotKey(userId));
    if (rawSnapshot) {
      const parsed = JSON.parse(rawSnapshot) as FinWiseLocalSnapshot;
      if (Array.isArray(parsed.transactions)) return parsed;
    }

    const rawTransactions = window.localStorage.getItem("finwise.transactions");
    if (!rawTransactions) return null;
    const transactions = JSON.parse(rawTransactions) as Transaction[];
    const rawPeriod = window.localStorage.getItem("finwise.latestPeriod");
    return {
      transactions: Array.isArray(transactions) ? transactions : [],
      latestPeriod: rawPeriod ? (JSON.parse(rawPeriod) as CachedStatementPeriodInfo) : null,
      savedAt: new Date().toISOString()
    };
  } catch {
    return null;
  }
}

function saveLegacySnapshot(userId: string | null | undefined, snapshot: FinWiseLocalSnapshot) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(getLegacySnapshotKey(userId), JSON.stringify(snapshot));
  } catch {
    // Local backup is best-effort.
  }
}

function getLegacySnapshotKey(userId?: string | null) {
  return `finwise.snapshot.${snapshotKey(userId)}`;
}
