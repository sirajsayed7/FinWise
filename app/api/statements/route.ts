import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
import crypto from "node:crypto";
import { categorizeUnknownTransactions } from "@/lib/ai-categorization";
import { getStatementPeriod, parseStatementFile } from "@/lib/parser";
import type { MerchantRule } from "@/lib/types";

export async function POST(request: Request) {
  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Could not read upload. Please choose a valid CSV, Excel, or text-based PDF statement and try again." }, { status: 400 });
  }
  const file = formData.get("file");
  const bank = String(formData.get("bank") || "Auto detect");
  const keepOriginal = String(formData.get("keepOriginal") || "false") === "true";
  const rules = parseRules(String(formData.get("rules") || "[]"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a statement file." }, { status: 400 });
  }

  let blobUrl: string | null = null;
  const fileBuffer = Buffer.from(await file.arrayBuffer());
  const fileHash = crypto.createHash("sha256").update(fileBuffer).digest("hex");
  const statementId = fileHash.slice(0, 32);
  const uploadedAt = new Date().toISOString();

  if (keepOriginal && process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob SDK versions commonly expose public blobs. Keep this opt-in
    // and avoid returning the URL to clients until private storage is configured.
    const blob = await put(`statements/${Date.now()}-${file.name}`, file, {
      access: "public"
    });
    blobUrl = blob.url;
  }

  try {
    const parseFile = new File([fileBuffer], file.name, { type: file.type || "application/octet-stream" });
    const parsedStatement = await parseStatementFile(parseFile, bank, rules);
    const categorized = await categorizeUnknownTransactions(parsedStatement.transactions);
    const period = getStatementPeriod(categorized);
    const statementStatus = parsedStatement.diagnostics.confidence < 0.75 ? "review" as const : "processed" as const;
    const summary = categorized.reduce(
      (current, transaction) => {
        if (transaction.direction === "income") current.totalIncome += transaction.amount;
        else current.totalExpenses += transaction.amount;
        return current;
      },
      { totalIncome: 0, totalExpenses: 0 }
    );
    const transactions = categorized.map((transaction) => ({
      ...transaction,
      statementId,
      statementFileName: file.name,
      statementUploadedAt: uploadedAt,
      statementPeriodLabel: period.label,
      statementStatus
    }));

    return NextResponse.json({
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
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not process statement.",
        statement: {
          fileName: file.name,
          bank,
          blobUrl,
          status: "failed"
        }
      },
      { status: 422 }
    );
  }
}

function parseRules(value: string): MerchantRule[] {
  try {
    const parsed = JSON.parse(value) as MerchantRule[];
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((rule) => typeof rule.pattern === "string" && typeof rule.category === "string");
  } catch {
    return [];
  }
}
