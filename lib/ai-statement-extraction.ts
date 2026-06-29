import OpenAI from "openai";
import type { RawStatementRow, StatementParseDiagnostics } from "@/lib/pdf-statement-parser";
import { detectStatementProfile } from "@/lib/statement-profiles";

const statementSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    bank: { type: "string" },
    currency: { type: "string" },
    transactions: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          date: { type: "string", description: "ISO date in YYYY-MM-DD format" },
          description: { type: "string" },
          amount: { type: "number", exclusiveMinimum: 0 },
          direction: { type: "string", enum: ["income", "expense"] },
          confidence: { type: "number", minimum: 0, maximum: 1 }
        },
        required: ["date", "description", "amount", "direction", "confidence"]
      }
    }
  },
  required: ["bank", "currency", "transactions"]
} as const;

type AIStatementResult = {
  bank: string;
  currency: string;
  transactions: Array<{
    date: string;
    description: string;
    amount: number;
    direction: "income" | "expense";
    confidence: number;
  }>;
};

export async function extractStatementRowsWithAI(buffer: Buffer, fileName: string) {
  if (!process.env.OPENAI_API_KEY) return null;
  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const response = await client.responses.create({
    model: process.env.OPENAI_STATEMENT_MODEL || process.env.OPENAI_MODEL || "gpt-4o-mini",
    store: false,
    input: [{
      role: "user",
      content: [
        {
          type: "input_file",
          filename: fileName,
          file_data: `data:application/pdf;base64,${buffer.toString("base64")}`
        },
        {
          type: "input_text",
          text: [
            "Extract every actual account transaction from this bank statement.",
            "Exclude opening/closing balances, totals, page headers, account numbers, IBANs, and summary rows.",
            "Use the transaction/posting date, not a date embedded in the narration.",
            "Debit, withdrawal, purchase, charge, and money sent are expenses.",
            "Credit, salary, refund, reversal, deposit, and money received are income.",
            "Preserve the useful merchant/narration text. Never infer a transaction that is not visible.",
            "If a row is uncertain, include it with lower confidence so the user can review it."
          ].join(" ")
        }
      ]
    }],
    text: {
      format: {
        type: "json_schema",
        name: "bank_statement_transactions",
        strict: true,
        schema: statementSchema
      }
    }
  });

  const output = JSON.parse(response.output_text) as AIStatementResult;
  const profile = detectStatementProfile(`${output.bank} ${output.currency}`, output.bank);
  profile.currency = normalizeCurrency(output.currency, profile.currency);
  const rows: RawStatementRow[] = output.transactions.map((transaction) => ({
    date: transaction.date,
    description: transaction.description,
    amount: String(transaction.amount),
    direction: transaction.direction === "expense" ? "debit" : "credit",
    "ai confidence": String(transaction.confidence)
  }));
  const average = output.transactions.length
    ? output.transactions.reduce((total, transaction) => total + transaction.confidence, 0) / output.transactions.length
    : 0;

  return {
    rows,
    profile,
    diagnostics: {
      profileId: profile.id,
      bank: profile.bank,
      currency: profile.currency,
      layout: profile.layout,
      extractionMethod: "ai_vision",
      rowCount: rows.length,
      balanceChecks: 0,
      balanceMatches: 0,
      confidence: Math.min(0.95, average),
      warnings: ["AI document extraction was used because the local PDF table could not be read reliably. Review low-confidence rows."]
    } satisfies StatementParseDiagnostics
  };
}

function normalizeCurrency(value: string, fallback: string) {
  const normalized = value.trim().toUpperCase();
  return /^(QAR|AED|USD|EUR|GBP|SAR|BHD|KWD|OMR)$/.test(normalized) ? normalized : fallback;
}