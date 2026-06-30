import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { categorizeUnknownTransactions } from "@/lib/ai-categorization";
import { getStatementPeriod, parseStatementFile } from "@/lib/parser";
import { createRateLimiter } from "@/lib/middleware";
import { validateStatementUpload, createValidationErrorResponse } from "@/lib/validation-schemas";
import type { MerchantRule } from "@/lib/types";

// ============================================================================
// Configuration
// ============================================================================

// Rate limiting: 5 uploads per 15 minutes per IP
const fileUploadLimiter = createRateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 5,
  message: "Too many uploads. Maximum 5 uploads per 15 minutes."
});

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024; // 10MB

/**
 * Custom error class for API errors
 */
class StatementProcessingError extends Error {
  constructor(
    public code: string,
    public statusCode: number,
    message: string
  ) {
    super(message);
    this.name = "StatementProcessingError";
  }
}

// ============================================================================
// Main POST Handler
// ============================================================================

export async function POST(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitError = fileUploadLimiter(request);
    if (rateLimitError) {
      return rateLimitError;
    }

    // Validate file size from Content-Length header
    const contentLength = request.headers.get("content-length");
    if (contentLength) {
      const bytes = parseInt(contentLength, 10);
      if (bytes > MAX_FILE_SIZE_BYTES) {
        throw new StatementProcessingError(
          "FILE_TOO_LARGE",
          413,
          `File exceeds maximum size of ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB`
        );
      }
    }

    // Parse form data
    let formData: FormData;
    try {
      formData = await request.formData();
    } catch (error) {
      throw new StatementProcessingError(
        "INVALID_FORM_DATA",
        400,
        "Could not read upload. Please choose a valid CSV, Excel, or text-based PDF statement and try again."
      );
    }

    // Validate upload data
    const validationResult = await validateStatementUpload(formData);
    const { file, bank, keepOriginal } = validationResult;

    const rules = parseRules(String(formData.get("rules") || "[]"));

    // Generate statement metadata
    let blobUrl: string | null = null;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Additional size check after buffering
    if (fileBuffer.length > MAX_FILE_SIZE_BYTES) {
      throw new StatementProcessingError(
        "FILE_TOO_LARGE",
        413,
        `File exceeds maximum size of ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(1)}MB`
      );
    }

    const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
    const statementId = fileHash.slice(0, 32);
    const uploadedAt = new Date().toISOString();

    // Process statement
    const parseFile = new File([fileBuffer], file.name, {
      type: file.type || "application/octet-stream"
    });

    const parsedStatement = await parseStatementFile(parseFile, bank, rules);
    const categorized = await categorizeUnknownTransactions(
      parsedStatement.transactions
    );
    const period = getStatementPeriod(categorized);

    // Determine statement status based on parsing confidence
    const statementStatus =
      parsedStatement.diagnostics.confidence < 0.75 ? ("review" as const) : ("processed" as const);

    // Calculate summary
    const summary = categorized.reduce(
      (current, transaction) => {
        if (transaction.direction === "income") current.totalIncome += transaction.amount;
        else current.totalExpenses += transaction.amount;
        return current;
      },
      { totalIncome: 0, totalExpenses: 0 }
    );

    // Enrich transactions with statement metadata
    const transactions = categorized.map((transaction) => ({
      ...transaction,
      statementId,
      statementFileName: file.name,
      statementUploadedAt: uploadedAt,
      statementPeriodLabel: period.label,
      statementStatus
    }));

    // Optional: Store original file in Vercel Blob
    if (keepOriginal && process.env.BLOB_READ_WRITE_TOKEN) {
      try {
        const blob = await put(
          `statements/${Date.now()}-${file.name}`,
          file,
          {
            access: "public"
          }
        );
        blobUrl = blob.url;
      } catch (error) {
        // Log but don't fail the upload if blob storage fails
        console.error("Failed to store file in Vercel Blob:", error);
      }
    }

    return NextResponse.json(
      {
        statement: {
          id: statementId,
          fileName: file.name,
          bank: parsedStatement.profile.bank,
          currency: parsedStatement.profile.currency,
          fileHash,
          blobUrl: keepOriginal ? blobUrl : null,
          status: statementStatus,
          uploadedAt,
          transactionCount: transactions.length,
          totalIncome: summary.totalIncome,
          totalExpenses: summary.totalExpenses,
          period,
          diagnostics: parsedStatement.diagnostics
        },
        transactions
      },
      { status: 200 }
    );
  } catch (error) {
    return handleStatementProcessingError(error);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

function handleStatementProcessingError(error: unknown) {
  // Handle custom StatementProcessingError
  if (error instanceof StatementProcessingError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code
      },
      { status: error.statusCode }
    );
  }

  // Handle validation errors
  if (error instanceof Error && error.name === "ZodError") {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.message
      },
      { status: 400 }
    );
  }

  // Handle generic errors
  const errorMessage =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred while processing the statement.";

  // Log to Sentry for monitoring
  if (typeof window === "undefined") {
    console.error("Statement processing error:", error);
  }

  return NextResponse.json(
    {
      error: errorMessage,
      code: "STATEMENT_PROCESSING_FAILED"
    },
    { status: 422 }
  );
}

// ============================================================================
// Utilities
// ============================================================================

function parseRules(value: string): MerchantRule[] {
  try {
    const parsed = JSON.parse(value) as MerchantRule[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (rule) =>
        typeof rule.pattern === "string" && typeof rule.category === "string"
    );
  } catch {
    return [];
  }
}
