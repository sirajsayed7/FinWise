import { z } from "zod";
import { categories } from "@/lib/categorization";

// ============================================================================
// API Input Validation Schemas
// ============================================================================

export const FileUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine((file) => file.size > 0, "File is empty")
    .refine(
      (file) => file.size <= 10 * 1024 * 1024,
      "File exceeds 10MB limit"
    )
    .refine(
      (file) =>
        [
          "text/csv",
          "text/plain",
          "application/pdf",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        ].includes(file.type) ||
        /\.(csv|txt|pdf|xls|xlsx)$/i.test(file.name),
      "Invalid file type. Accepted: CSV, TXT, PDF, XLS, XLSX"
    ),
  bank: z.string().default("Auto detect").optional(),
  keepOriginal: z.boolean().default(false).optional(),
  rules: z.array(z.any()).default([]).optional()
});

export const MerchantRuleSchema = z.object({
  id: z.string().optional(),
  pattern: z
    .string()
    .min(1, "Pattern is required")
    .max(255, "Pattern is too long"),
  category: z.enum(categories as unknown as readonly [string, ...string[]]),
  merchant: z.string().optional(),
  subcategory: z.string().optional()
});

export const TransactionUpdateSchema = z.object({
  id: z.string().uuid(),
  category: z.enum(categories as unknown as readonly [string, ...string[]]).optional(),
  merchant: z
    .string()
    .min(1, "Merchant name is required")
    .max(255)
    .optional(),
  subcategory: z.string().max(100).optional(),
  needsReview: z.boolean().optional(),
  reason: z.string().max(500).optional()
});

// ============================================================================
// Business Logic Validation Schemas
// ============================================================================

export const TransactionSchema = z.object({
  id: z.string().uuid(),
  statementId: z.string().optional(),
  statementFileName: z.string().optional(),
  statementUploadedAt: z.string().datetime().optional(),
  statementPeriodLabel: z.string().optional(),
  statementStatus: z.enum(["processed", "failed", "review"]).optional(),
  date: z.string().date(),
  bank: z.string().min(1),
  descriptionRaw: z.string(),
  merchant: z.string().min(1).max(255),
  amount: z
    .number()
    .nonnegative("Amount must be non-negative")
    .max(999_999_999, "Amount exceeds maximum"),
  direction: z.enum(["income", "expense"]),
  currency: z.string().length(3),
  category: z.enum(categories as unknown as readonly [string, ...string[]]),
  subcategory: z.string(),
  confidence: z
    .number()
    .min(0, "Confidence must be between 0 and 1")
    .max(1, "Confidence must be between 0 and 1"),
  reason: z.string(),
  needsReview: z.boolean(),
  categorySource: z.enum(["user_rule", "default_rule", "ai", "fallback"]),
  duplicateHash: z.string(),
  updatedAt: z.string().datetime().optional()
});

export const StatementRecordSchema = z.object({
  id: z.string(),
  userId: z.string().optional(),
  fileName: z.string(),
  bank: z.string(),
  currency: z.string().length(3),
  status: z.enum(["processed", "failed", "review"]),
  transactionCount: z.number().nonnegative(),
  totalIncome: z.number().nonnegative(),
  totalExpenses: z.number().nonnegative(),
  periodStart: z.string().datetime().nullable(),
  periodEnd: z.string().datetime().nullable(),
  periodDays: z.number().nonnegative(),
  periodLabel: z.string(),
  fileHash: z.string().nullable().optional(),
  blobUrl: z.string().url().nullable().optional(),
  uploadedAt: z.string().datetime(),
  updatedAt: z.string().datetime().optional(),
  deviceId: z.string().optional()
});

export const BudgetRecordSchema = z.object({
  id: z.string().optional(),
  category: z.enum(categories as unknown as readonly [string, ...string[]]),
  amount: z
    .number()
    .positive("Budget amount must be positive")
    .max(999_999_999),
  currency: z.string().length(3),
  period: z.enum(["monthly", "weekly"])
});

// ============================================================================
// Utility Functions
// ============================================================================

export async function validateStatementUpload(formData: FormData) {
  const file = formData.get("file");
  const bank = formData.get("bank");
  const keepOriginal = formData.get("keepOriginal");

  // Validate file separately since it comes from FormData
  if (!(file instanceof File)) {
    throw new Error("Upload a statement file.");
  }

  if (file.size > 10 * 1024 * 1024) {
    throw new Error("File exceeds 10MB limit");
  }

  const validTypes = [
    "text/csv",
    "text/plain",
    "application/pdf",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
  ];

  if (!validTypes.includes(file.type) && !/\.(csv|txt|pdf|xls|xlsx)$/i.test(file.name)) {
    throw new Error(
      "Invalid file type. Accepted: CSV, TXT, PDF, XLS, XLSX"
    );
  }

  return {
    file,
    bank: typeof bank === "string" ? bank : "Auto detect",
    keepOriginal: keepOriginal === "true",
    fileName: file.name
  };
}

export function createValidationErrorResponse(error: z.ZodError) {
  const issues = error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message
  }));

  return {
    error: "Validation failed",
    issues
  };
}
