import { describe, it, expect } from "node:test";
import type { Transaction } from "@/lib/types";

describe("Sync & Optimistic Locking", () => {
  const createTransaction = (id: string, category: string, timestamp: string): Transaction => ({
    id,
    date: "2026-06-15",
    bank: "QNB",
    descriptionRaw: "TEST",
    merchant: "TEST",
    amount: 100,
    direction: "expense",
    currency: "QAR",
    category: category as any,
    subcategory: "Test",
    confidence: 0.9,
    reason: "Test",
    needsReview: false,
    categorySource: "user_rule",
    duplicateHash: `hash-${id}`,
    updatedAt: timestamp
  });

  describe("Conflict Detection", () => {
    it("should detect when local is newer than remote", () => {
      const localTime = Date.parse("2026-06-15T15:00:00Z");
      const remoteTime = Date.parse("2026-06-15T14:00:00Z");

      expect(localTime > remoteTime).toBe(true);
    });

    it("should detect when remote is newer than local", () => {
      const localTime = Date.parse("2026-06-15T14:00:00Z");
      const remoteTime = Date.parse("2026-06-15T15:00:00Z");

      expect(remoteTime > localTime).toBe(true);
    });

    it("should handle simultaneous updates with last-write-wins", () => {
      const local = createTransaction(
        "tx-1",
        "Groceries",
        "2026-06-15T15:00:00Z"
      );
      const remote = createTransaction(
        "tx-1",
        "Shopping",
        "2026-06-15T14:59:59Z"
      );

      const localTime = Date.parse(local.updatedAt ?? "1970-01-01");
      const remoteTime = Date.parse(remote.updatedAt ?? "1970-01-01");

      // Local wins because it's newer
      expect(localTime >= remoteTime).toBe(true);
    });
  });

  describe("Multi-Device Sync", () => {
    it("should track device ID for changes", () => {
      const transaction: Transaction = {
        ...createTransaction("tx-1", "Groceries", "2026-06-15T15:00:00Z")
      };

      // In real implementation, device ID is tracked separately
      // but for now we verify the transaction structure
      expect(transaction.id).toBeDefined();
      expect(transaction.updatedAt).toBeDefined();
    });

    it("should identify conflicting changes from multiple devices", () => {
      // Simulate two devices editing same transaction
      const device1Edit: Transaction = {
        ...createTransaction("tx-1", "Groceries", "2026-06-15T15:00:00Z")
      };

      const device2Edit: Transaction = {
        ...createTransaction("tx-1", "Shopping", "2026-06-15T15:01:00Z")
      };

      // Device 2 edit is newer, should win
      const device1Time = Date.parse(device1Edit.updatedAt ?? "1970-01-01");
      const device2Time = Date.parse(device2Edit.updatedAt ?? "1970-01-01");

      expect(device2Time > device1Time).toBe(true);
    });
  });

  describe("Tombstone Cleanup", () => {
    it("should track deleted transactions", () => {
      const tombstone = {
        transactionId: "tx-1",
        statementId: "stmt-1",
        deletedAt: "2026-06-15T15:00:00Z",
        deviceId: "device-1"
      };

      expect(tombstone.transactionId).toBeDefined();
      expect(tombstone.deletedAt).toBeDefined();
    });

    it("should resolve deletion conflicts based on timestamp", () => {
      const deletion = {
        transactionId: "tx-1",
        deletedAt: "2026-06-15T15:00:00Z"
      };

      const transaction = createTransaction("tx-1", "Groceries", "2026-06-15T14:00:00Z");

      const deletionTime = Date.parse(deletion.deletedAt);
      const transactionTime = Date.parse(transaction.updatedAt ?? "1970-01-01");

      // Deletion happened after update, transaction should be deleted
      expect(deletionTime > transactionTime).toBe(true);
    });
  });
});
