import { NextResponse } from "next/server";
import { put } from "@vercel/blob";
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
  const bank = String(formData.get("bank") || "Unknown Bank");
  const keepOriginal = String(formData.get("keepOriginal") || "false") === "true";
  const rules = parseRules(String(formData.get("rules") || "[]"));

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Upload a statement file." }, { status: 400 });
  }

  let blobUrl: string | null = null;

  if (keepOriginal && process.env.BLOB_READ_WRITE_TOKEN) {
    // Vercel Blob SDK versions commonly expose public blobs. Keep this opt-in
    // and avoid returning the URL to clients until private storage is configured.
    const blob = await put(`statements/${Date.now()}-${file.name}`, file, {
      access: "public"
    });
    blobUrl = blob.url;
  }

  try {
    const parsedTransactions = await parseStatementFile(file, bank, rules);
    const transactions = await categorizeUnknownTransactions(parsedTransactions);
    const period = getStatementPeriod(transactions);

    return NextResponse.json({
      statement: {
        fileName: file.name,
        bank,
        blobUrl: keepOriginal ? blobUrl : null,
        status: "processed",
        uploadedAt: new Date().toISOString(),
        period
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
