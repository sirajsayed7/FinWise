import { openDB, type DBSchema } from "idb";
import type { Transaction, TransactionTombstone } from "@/lib/types";

export type CachedStatementPeriodInfo = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

export type FinWiseSyncState = {
  deviceId: string;
  dirtyTransactionIds: string[];
  deletedTransactions: TransactionTombstone[];
  deletedStatementIds: string[];
  lastSyncedAt: string | null;
};

export type FinWiseLocalSnapshot = {
  transactions: Transaction[];
  latestPeriod: CachedStatementPeriodInfo | null;
  savedAt: string;
  sync: FinWiseSyncState;
};

export type SaveLocalSnapshotOptions = {
  markDirty?: boolean;
  replaceFromCloud?: boolean;
};

export type ReconciledSnapshot = {
  transactions: Transaction[];
  latestPeriod: CachedStatementPeriodInfo | null;
  hasPendingSync: boolean;
};

interface FinWiseCacheDB extends DBSchema {
  snapshots: {
    key: string;
    value: FinWiseLocalSnapshot;
  };
}

const DB_NAME = "finwise-local-cache";
const DB_VERSION = 2;
const LOCAL_USER_KEY = "local";
const DEVICE_ID_KEY = "finwise.deviceId";

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

export function getDeviceId() {
  if (typeof window === "undefined") return "server";
  const current = window.localStorage.getItem(DEVICE_ID_KEY);
  if (current) return current;
  const generated = globalThis.crypto?.randomUUID?.()
    ?? `device-${Date.now()}-${Math.random().toString(36).slice(2)}`;
  window.localStorage.setItem(DEVICE_ID_KEY, generated);
  return generated;
}

export async function loadLocalSnapshot(userId?: string | null): Promise<FinWiseLocalSnapshot | null> {
  try {
    const db = await getDB();
    const snapshot = db
      ? await db.get("snapshots", snapshotKey(userId))
      : loadLegacySnapshot(userId);
    return snapshot ? normalizeSnapshot(snapshot) : loadLegacySnapshot(userId);
  } catch {
    return loadLegacySnapshot(userId);
  }
}

export async function saveLocalSnapshot(
  userId: string | null | undefined,
  transactions: Transaction[],
  latestPeriod: CachedStatementPeriodInfo | null,
  options: SaveLocalSnapshotOptions = {}
): Promise<FinWiseLocalSnapshot> {
  const existing = await loadLocalSnapshot(userId);
  const now = new Date().toISOString();
  const deviceId = existing?.sync.deviceId ?? getDeviceId();
  const nextTransactions = transactions.map((transaction) => ({ ...transaction }));
  const nextSync = options.replaceFromCloud
    ? emptySyncState(deviceId, now)
    : existing?.sync ?? emptySyncState(deviceId, null);

  if (options.markDirty) {
    const previousById = new Map((existing?.transactions ?? []).map((transaction) => [transaction.id, transaction]));
    const nextById = new Map(nextTransactions.map((transaction) => [transaction.id, transaction]));
    const dirtyIds = new Set(nextSync.dirtyTransactionIds);
    const deletedById = new Map(nextSync.deletedTransactions.map((item) => [item.transactionId, item]));

    for (const transaction of nextTransactions) {
      const previous = previousById.get(transaction.id);
      if (!previous || transactionFingerprint(previous) !== transactionFingerprint(transaction)) {
        transaction.updatedAt = now;
        dirtyIds.add(transaction.id);
      }
      if (dirtyIds.has(transaction.id) && !transaction.updatedAt) {
        transaction.updatedAt = existing?.savedAt ?? now;
      }
      deletedById.delete(transaction.id);
    }

    for (const previous of previousById.values()) {
      if (nextById.has(previous.id)) continue;
      dirtyIds.delete(previous.id);
      deletedById.set(previous.id, {
        transactionId: previous.id,
        statementId: previous.statementId,
        deletedAt: now,
        deviceId
      });
    }

    const previousStatementIds = new Set(
      (existing?.transactions ?? []).map((transaction) => transaction.statementId).filter(Boolean) as string[]
    );
    const nextStatementIds = new Set(
      nextTransactions.map((transaction) => transaction.statementId).filter(Boolean) as string[]
    );
    const deletedStatementIds = new Set(nextSync.deletedStatementIds);
    for (const id of previousStatementIds) {
      if (!nextStatementIds.has(id)) deletedStatementIds.add(id);
    }
    for (const id of nextStatementIds) deletedStatementIds.delete(id);

    nextSync.dirtyTransactionIds = Array.from(dirtyIds);
    nextSync.deletedTransactions = Array.from(deletedById.values());
    nextSync.deletedStatementIds = Array.from(deletedStatementIds);
  }

  const snapshot: FinWiseLocalSnapshot = {
    transactions: nextTransactions,
    latestPeriod,
    savedAt: now,
    sync: nextSync
  };
  await writeSnapshot(userId, snapshot);
  return snapshot;
}

export async function markLocalSnapshotSynced(
  userId: string | null | undefined,
  transactions: Transaction[],
  latestPeriod: CachedStatementPeriodInfo | null,
  syncedAt = new Date().toISOString()
) {
  const snapshot: FinWiseLocalSnapshot = {
    transactions,
    latestPeriod,
    savedAt: syncedAt,
    sync: emptySyncState(getDeviceId(), syncedAt)
  };
  await writeSnapshot(userId, snapshot);
  return snapshot;
}

export function hasPendingLocalSync(snapshot: FinWiseLocalSnapshot | null | undefined) {
  return Boolean(
    snapshot
      && (
        snapshot.sync.dirtyTransactionIds.length
        || snapshot.sync.deletedTransactions.length
        || snapshot.sync.deletedStatementIds.length
      )
  );
}

export function reconcileLocalAndCloud(
  localSnapshot: FinWiseLocalSnapshot | null,
  cloudTransactions: Transaction[],
  cloudPeriod: CachedStatementPeriodInfo | null,
  cloudTombstones: TransactionTombstone[] = []
): ReconciledSnapshot {
  if (!localSnapshot) {
    return {
      transactions: cloudTransactions,
      latestPeriod: cloudPeriod,
      hasPendingSync: false
    };
  }

  const result = new Map(cloudTransactions.map((transaction) => [transaction.id, transaction]));
  const dirtyIds = new Set(localSnapshot.sync.dirtyTransactionIds);
  const tombstones = new Map(cloudTombstones.map((item) => [item.transactionId, item]));

  for (const local of localSnapshot.transactions) {
    const remote = result.get(local.id);
    const tombstone = tombstones.get(local.id);
    const localChangedAt = Date.parse(local.updatedAt ?? localSnapshot.savedAt);
    const remoteChangedAt = Date.parse(remote?.updatedAt ?? "1970-01-01T00:00:00.000Z");
    const deletedAt = Date.parse(tombstone?.deletedAt ?? "1970-01-01T00:00:00.000Z");

    if (tombstone && deletedAt >= localChangedAt) {
      result.delete(local.id);
      continue;
    }
    if (dirtyIds.has(local.id) || !remote || localChangedAt > remoteChangedAt) {
      result.set(local.id, local);
    }
  }

  for (const deleted of localSnapshot.sync.deletedTransactions) {
    const remote = result.get(deleted.transactionId);
    const remoteChangedAt = Date.parse(remote?.updatedAt ?? "1970-01-01T00:00:00.000Z");
    if (Date.parse(deleted.deletedAt) >= remoteChangedAt) {
      result.delete(deleted.transactionId);
    }
  }

  return {
    transactions: Array.from(result.values()).sort((left, right) => right.date.localeCompare(left.date)),
    latestPeriod: localSnapshot.latestPeriod ?? cloudPeriod,
    hasPendingSync: hasPendingLocalSync(localSnapshot)
  };
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

async function writeSnapshot(
  userId: string | null | undefined,
  snapshot: FinWiseLocalSnapshot
) {
  try {
    const db = await getDB();
    if (!db) {
      saveLegacySnapshot(userId, snapshot);
      return;
    }
    await db.put("snapshots", snapshot, snapshotKey(userId));
  } catch {
    saveLegacySnapshot(userId, snapshot);
  }
}

function normalizeSnapshot(snapshot: FinWiseLocalSnapshot): FinWiseLocalSnapshot {
  const hasSyncState = Boolean(snapshot.sync?.deviceId);
  return {
    transactions: Array.isArray(snapshot.transactions) ? snapshot.transactions : [],
    latestPeriod: snapshot.latestPeriod ?? null,
    savedAt: snapshot.savedAt ?? new Date().toISOString(),
    sync: hasSyncState
      ? {
          deviceId: snapshot.sync.deviceId,
          dirtyTransactionIds: snapshot.sync.dirtyTransactionIds ?? [],
          deletedTransactions: snapshot.sync.deletedTransactions ?? [],
          deletedStatementIds: snapshot.sync.deletedStatementIds ?? [],
          lastSyncedAt: snapshot.sync.lastSyncedAt ?? null
        }
      : {
          deviceId: getDeviceId(),
          dirtyTransactionIds: (snapshot.transactions ?? []).map((transaction) => transaction.id),
          deletedTransactions: [],
          deletedStatementIds: [],
          lastSyncedAt: null
        }
  };
}

function emptySyncState(deviceId: string, lastSyncedAt: string | null): FinWiseSyncState {
  return {
    deviceId,
    dirtyTransactionIds: [],
    deletedTransactions: [],
    deletedStatementIds: [],
    lastSyncedAt
  };
}

function transactionFingerprint(transaction: Transaction) {
  return JSON.stringify([
    transaction.statementId,
    transaction.date,
    transaction.bank,
    transaction.descriptionRaw,
    transaction.merchant,
    transaction.amount,
    transaction.direction,
    transaction.currency,
    transaction.category,
    transaction.subcategory,
    transaction.confidence,
    transaction.reason,
    transaction.needsReview,
    transaction.categorySource,
    transaction.duplicateHash
  ]);
}

function loadLegacySnapshot(userId?: string | null): FinWiseLocalSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const rawSnapshot = window.localStorage.getItem(getLegacySnapshotKey(userId));
    if (rawSnapshot) {
      const parsed = JSON.parse(rawSnapshot) as FinWiseLocalSnapshot;
      if (Array.isArray(parsed.transactions)) return normalizeSnapshot(parsed);
    }

    const rawTransactions = window.localStorage.getItem("finwise.transactions");
    if (!rawTransactions) return null;
    const transactions = JSON.parse(rawTransactions) as Transaction[];
    const rawPeriod = window.localStorage.getItem("finwise.latestPeriod");
    return normalizeSnapshot({
      transactions: Array.isArray(transactions) ? transactions : [],
      latestPeriod: rawPeriod ? JSON.parse(rawPeriod) as CachedStatementPeriodInfo : null,
      savedAt: new Date().toISOString(),
      sync: undefined as unknown as FinWiseSyncState
    });
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
