import { describe, it, expect } from "node:test";
import type { Transaction, CategoryName } from "@/lib/types";

describe("AI Categorization Batching", () => {
  const createMockTransaction = (id: string, description: string): Transaction => ({
    id,
    date: "2026-06-15",
    bank: "QNB",
    descriptionRaw: description,
    merchant: description.split(" ")[0],
    amount: 100,
    direction: "expense",
    currency: "QAR",
    category: "Other",
    subcategory: "Unknown",
    confidence: 0.5,
    reason: "Needs review",
    needsReview: true,
    categorySource: "fallback",
    duplicateHash: `hash-${id}`
  });

  it("should identify transactions needing AI classification", () => {
    const transactions: Transaction[] = [
      {
        ...createMockTransaction("1", "CARREFOUR"),
        category: "Groceries",
        confidence: 0.95,
        categorySource: "default_rule"
      },
      {
        ...createMockTransaction("2", "UNKNOWN MERCHANT"),
        category: "Other",
        confidence: 0.3,
        categorySource: "fallback"
      },
      {
        ...createMockTransaction("3", "SKETCHY STORE"),
        category: "Shopping",
        confidence: 0.65,
        categorySource: "ai"
      }
    ];

    // Transactions to classify: #2 (Other) and #3 (< 0.75 confidence)
    const needsClassification = transactions.filter(
      (tx) => tx.category === "Other" || tx.confidence < 0.75
    );

    expect(needsClassification.length).toBe(2);
    expect(needsClassification.map((tx) => tx.id)).toEqual(["2", "3"]);
  });

  it("should batch transactions for efficient API calls", () => {
    const transactions = Array.from({ length: 100 }, (_, i) =>
      createMockTransaction(`tx-${i}`, `MERCHANT-${i}`)
    );

    const BATCH_SIZE = 15;
    const batches: Transaction[][] = [];

    for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
      batches.push(transactions.slice(i, Math.min(i + BATCH_SIZE, transactions.length)));
    }

    // 100 transactions / 15 per batch = 7 batches
    expect(batches.length).toBe(7);
    expect(batches[0].length).toBe(15);
    expect(batches[6].length).toBe(10); // Last batch has remainder
  });

  it("should handle empty transaction list", () => {
    const transactions: Transaction[] = [];
    const needsClassification = transactions.filter(
      (tx) => tx.category === "Other" || tx.confidence < 0.75
    );

    expect(needsClassification.length).toBe(0);
  });

  it("should handle transactions with no AI calls needed", () => {
    const transactions: Transaction[] = [
      {
        ...createMockTransaction("1", "CARREFOUR"),
        category: "Groceries",
        confidence: 0.99,
        categorySource: "user_rule"
      },
      {
        ...createMockTransaction("2", "STARBUCKS"),
        category: "Ordering Out",
        confidence: 0.92,
        categorySource: "default_rule"
      }
    ];

    const needsClassification = transactions.filter(
      (tx) => tx.category === "Other" || tx.confidence < 0.75
    );

    expect(needsClassification.length).toBe(0);
  });
});

describe("Categorization Source Tracking", () => {
  it("should track categorization source correctly", () => {
    const transaction: Transaction = {
      id: "tx-1",
      date: "2026-06-15",
      bank: "QNB",
      descriptionRaw: "CARREFOUR QATAR",
      merchant: "CARREFOUR",
      amount: 150,
      direction: "expense",
      currency: "QAR",
      category: "Groceries",
      subcategory: "Supermarkets",
      confidence: 0.93,
      reason: "Matched default merchant rule",
      needsReview: false,
      categorySource: "default_rule",
      duplicateHash: "hash-1"
    };

    expect(transaction.categorySource).toBe("default_rule");
    expect(transaction.confidence).toBeGreaterThan(0.9);
  });
});
