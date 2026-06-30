import { NextResponse, after } from "next/server";
import type { NextRequest } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { categorizeUnknownTransactions } from "@/lib/ai-categorization";
import { getStatementPeriod, parseStatementFile } from "@/lib/parser";
import { createRateLimiter } from "@/lib/middleware";
import { validateStatementUpload, createValidationErrorResponse } from "@/lib/validation-schemas";
import { supabase } from "@/lib/supabase"; // 👈 Ensure this points to your Supabase client initialization
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
    public message: string
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

    // ------------------------------------------------------------------------
    // 1. Live Sync Kickoff: Instantly mark the statement as processing
    // ------------------------------------------------------------------------
    // ⚠️ DB COLUMN CHECK: Verify your 'statements' table columns match these keys
    await supabase.from("statements").insert({
      id: statementId,
      file_name: file.name,     // Change to fileName if using camelCase in DB
      status: "processing",
      uploaded_at: uploadedAt   // Change to uploadedAt if using camelCase in DB
    });

    // ------------------------------------------------------------------------
    // 2. Background Processing Core
    // ------------------------------------------------------------------------
    // This tells Vercel to respond to the phone instantly, keeping the server alive 
    // in the background to handle parsing and OpenAI without hitting timeouts.
    after(async () => {
      try {
        let blobUrl: string | null = null;

        const parseFile = new File([fileBuffer], file.name, {
          type: file.type || "application/octet-stream"
        });

        // Parse statement text elements
        const parsedStatement = await parseStatementFile(parseFile, bank, rules);
        
        // Dynamic status broadcast to update UI loading states across devices live
        await supabase.from("statements").update({ status: "categorizing" }).eq("id", statementId);

        // Run unmapped rows through OpenAI
        const categorized = await categorizeUnknownTransactions(
          parsedStatement.transactions
        );
        const period = getStatementPeriod(categorized);

        // Determine statement status based on parsing confidence
        const statementStatus =
          parsedStatement.diagnostics.confidence < 0.75 ? "review" : "processed";

        // Calculate statement summary values
        const summary = categorized.reduce(
          (current, transaction) => {
            if (transaction.direction === "income") current.totalIncome += transaction.amount;
            else current.totalExpenses += transaction.amount;
            return current;
          },
          { totalIncome: 0, totalExpenses: 0 }
        );

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
            console.error("Failed to store file in Vercel Blob:", error);
          }
        }

        // ⚠️ DB COLUMN CHECK: Verify your 'transactions' table columns match these keys
        await supabase.from("transactions").insert(
          categorized.map((transaction) => ({
            ...transaction,
            statement_id: statementId,                 // Change keys to camelCase if 
            statement_file_name: file.name,            // your Postgres table rules
            statement_uploaded_at: uploadedAt,          // are configured that way.
            statement_period_label: period.label,
            statement_status: statementStatus
          }))
        );

        // Mark the entire background pipeline job as fully finished!
        // ⚠️ DB COLUMN CHECK: Verify your 'statements' table update columns match these keys
        await supabase.from("statements").update({
          status: statementStatus,
          blob_url: blobUrl,                           // Change to blobUrl if camelCase
          transaction_count: categorized.length,       // Change to transactionCount if camelCase
          total_income: summary.totalIncome,           // Change to totalIncome if camelCase
          total_expenses: summary.totalExpenses,         // Change to totalExpenses if camelCase
          period: period,
          diagnostics: parsedStatement.diagnostics
        }).eq("id", statementId);

      } catch (processingError) {
        console.error("Background transaction tracking execution failed:", processingError);
        // Switch statement row state to 'failed' so frontend layouts show an error message
        await supabase.from("statements").update({ status: "failed" }).eq("id", statementId);
      }
    });

    // ------------------------------------------------------------------------
    // 3. Immediate PWA/Mobile Return Response
    // ------------------------------------------------------------------------
    // Handshake returns an HTTP 202 (Accepted) meaning processing has safely begun.
    return NextResponse.json(
      {
        success: true,
        message: "File received successfully. Syncing dashboards in background.",
        statementId
      },
      { status: 202 }
    );

  } catch (error) {
    return handleStatementProcessingError(error);
  }
}

// ============================================================================
// Error Handling
// ============================================================================

function handleStatementProcessingError(error: unknown) {
  if (error instanceof StatementProcessingError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error && error.name === "ZodError") {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: error.message
      },
      { status: 400 }
    );
  }

  const errorMessage =
    error instanceof Error
      ? error.message
      : "An unexpected error occurred while processing the statement.";

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
