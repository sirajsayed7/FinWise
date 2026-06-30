import { describe, it, expect } from "node:test";
import { z } from "zod";
import {
  FileUploadSchema,
  MerchantRuleSchema,
  TransactionSchema,
  TransactionUpdateSchema,
  BudgetRecordSchema
} from "@/lib/validation-schemas";

describe("Validation Schemas", () => {
  describe("MerchantRuleSchema", () => {
    it("should accept valid rule", () => {
      const validRule = {
        pattern: "CARREFOUR.*",
        category: "Groceries"
      };

      const result = MerchantRuleSchema.safeParse(validRule);
      expect(result.success).toBe(true);
    });

    it("should reject empty pattern", () => {
      const invalidRule = {
        pattern: "",
        category: "Groceries"
      };

      const result = MerchantRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });

    it("should reject invalid category", () => {
      const invalidRule = {
        pattern: "CARREFOUR",
        category: "InvalidCategory"
      };

      const result = MerchantRuleSchema.safeParse(invalidRule);
      expect(result.success).toBe(false);
    });
  });

  describe("TransactionSchema", () => {
    it("should accept valid transaction", () => {
      const validTransaction = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        date: "2026-06-15",
        bank: "QNB",
        descriptionRaw: "CARREFOUR QATAR",
        merchant: "CARREFOUR",
        amount: 150.50,
        direction: "expense",
        currency: "QAR",
        category: "Groceries",
        subcategory: "Supermarkets",
        confidence: 0.95,
        reason: "Matched default rule",
        needsReview: false,
        categorySource: "default_rule",
        duplicateHash: "abc123"
      };

      const result = TransactionSchema.safeParse(validTransaction);
      expect(result.success).toBe(true);
    });

    it("should reject invalid amount", () => {
      const invalidTransaction = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        date: "2026-06-15",
        bank: "QNB",
        descriptionRaw: "CARREFOUR QATAR",
        merchant: "CARREFOUR",
        amount: -150, // Negative amount
        direction: "expense",
        currency: "QAR",
        category: "Groceries",
        subcategory: "Supermarkets",
        confidence: 0.95,
        reason: "Matched default rule",
        needsReview: false,
        categorySource: "default_rule",
        duplicateHash: "abc123"
      };

      const result = TransactionSchema.safeParse(invalidTransaction);
      expect(result.success).toBe(false);
    });

    it("should reject invalid confidence", () => {
      const invalidTransaction = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        date: "2026-06-15",
        bank: "QNB",
        descriptionRaw: "CARREFOUR QATAR",
        merchant: "CARREFOUR",
        amount: 150.50,
        direction: "expense",
        currency: "QAR",
        category: "Groceries",
        subcategory: "Supermarkets",
        confidence: 1.5, // Confidence > 1
        reason: "Matched default rule",
        needsReview: false,
        categorySource: "default_rule",
        duplicateHash: "abc123"
      };

      const result = TransactionSchema.safeParse(invalidTransaction);
      expect(result.success).toBe(false);
    });
  });

  describe("BudgetRecordSchema", () => {
    it("should accept valid budget", () => {
      const validBudget = {
        category: "Groceries",
        amount: 500,
        currency: "QAR",
        period: "monthly"
      };

      const result = BudgetRecordSchema.safeParse(validBudget);
      expect(result.success).toBe(true);
    });

    it("should reject zero amount", () => {
      const invalidBudget = {
        category: "Groceries",
        amount: 0,
        currency: "QAR",
        period: "monthly"
      };

      const result = BudgetRecordSchema.safeParse(invalidBudget);
      expect(result.success).toBe(false);
    });

    it("should reject invalid currency code", () => {
      const invalidBudget = {
        category: "Groceries",
        amount: 500,
        currency: "QAAR", // 4 chars instead of 3
        period: "monthly"
      };

      const result = BudgetRecordSchema.safeParse(invalidBudget);
      expect(result.success).toBe(false);
    });
  });

  describe("TransactionUpdateSchema", () => {
    it("should accept valid update", () => {
      const validUpdate = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "Groceries",
        merchant: "CARREFOUR",
        needsReview: false
      };

      const result = TransactionUpdateSchema.safeParse(validUpdate);
      expect(result.success).toBe(true);
    });

    it("should accept partial update", () => {
      const partialUpdate = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        category: "Groceries"
      };

      const result = TransactionUpdateSchema.safeParse(partialUpdate);
      expect(result.success).toBe(true);
    });

    it("should reject long reason", () => {
      const invalidUpdate = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        reason: "a".repeat(501) // Exceeds 500 char limit
      };

      const result = TransactionUpdateSchema.safeParse(invalidUpdate);
      expect(result.success).toBe(false);
    });
  });
});
