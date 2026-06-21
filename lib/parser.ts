import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { read, utils } from "xlsx";
import Papa from "papaparse";
import { differenceInCalendarDays, format, isValid, parse, parseISO } from "date-fns";
import { categorizeMerchant, cleanMerchant } from "@/lib/categorization";
import type { MerchantRule, Transaction, TransactionDirection } from "@/lib/types";

type RawRow = Record<string, string>;
const requirePdfParser = createRequire(import.meta.url);

export type StatementPeriod = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

const dateKeys = ["date", "transaction date", "posting date", "value date", "txn date", "booking date"];
const descriptionKeys = ["description", "details", "merchant", "narrative", "transaction", "transaction details", "particulars", "reference", "memo"];
const amountKeys = ["amount", "transaction amount", "debit", "credit", "paid out", "paid in", "withdrawal", "deposit"];
const debitKeys = ["debit", "paid out", "withdrawal", "withdrawals", "debit amount"];
const creditKeys = ["credit", "paid in", "deposit", "deposits", "credit amount"];

export async function parseStatementFile(file: File, bank: string, rules: MerchantRule[] = []) {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "txt") {
    return parseRows(parseDelimited(await file.text()), bank, "QAR", rules);
  }

  if (extension === "xls" || extension === "xlsx") {
    const workbook = read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map(normalizeObjectRow);
    return parseRows(rows, bank, "QAR", rules);
  }

  if (extension === "pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    installPdfRuntimeGlobals();
    const { PDFParse } = requirePdfParser("pdf-parse") as typeof import("pdf-parse");
    PDFParse.setWorker(pathToFileURL(path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs")).href);
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      return parseRows(parsePdfText(parsed.text), bank, "QAR", rules);
    } finally {
      await parser.destroy();
    }
  }

  throw new Error("Unsupported statement format. Upload CSV, TXT, XLS, XLSX, or a text-based PDF.");
}

function installPdfRuntimeGlobals() {
  const canvas = requirePdfParser("@napi-rs/canvas") as {
    DOMMatrix?: typeof DOMMatrix;
    DOMPoint?: typeof DOMPoint;
    DOMRect?: typeof DOMRect;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };
  const target = globalThis as typeof globalThis & {
    DOMMatrix?: typeof DOMMatrix;
    DOMPoint?: typeof DOMPoint;
    DOMRect?: typeof DOMRect;
    ImageData?: typeof ImageData;
    Path2D?: typeof Path2D;
  };

  if (!canvas.DOMMatrix || !canvas.DOMPoint || !canvas.DOMRect || !canvas.ImageData || !canvas.Path2D) {
    throw new Error("PDF runtime is missing required canvas primitives.");
  }

  target.DOMMatrix ??= canvas.DOMMatrix;
  target.DOMPoint ??= canvas.DOMPoint;
  target.DOMRect ??= canvas.DOMRect;
  target.ImageData ??= canvas.ImageData;
  target.Path2D ??= canvas.Path2D;
}

export function getStatementPeriod(transactions: Transaction[]): StatementPeriod {
  const dates = transactions
    .map((transaction) => parseISO(transaction.date))
    .filter((date) => isValid(date))
    .sort((left, right) => left.getTime() - right.getTime());

  if (!dates.length) return { startDate: null, endDate: null, days: 0, label: "No valid dates" };

  const start = dates[0];
  const end = dates[dates.length - 1];
  const days = differenceInCalendarDays(end, start) + 1;
  const weeks = Math.floor(days / 7);
  const remainderDays = days % 7;
  const monthCount = Math.floor(days / 30);
  const extraWeeks = Math.round((days - monthCount * 30) / 7);
  const label = days >= 45
    ? `${monthCount} month${monthCount === 1 ? "" : "s"}${extraWeeks ? ` and ${extraWeeks} week${extraWeeks === 1 ? "" : "s"}` : ""}`
    : `${weeks} week${weeks === 1 ? "" : "s"}${remainderDays ? ` and ${remainderDays} day${remainderDays === 1 ? "" : "s"}` : ""}`;

  return {
    startDate: format(start, "yyyy-MM-dd"),
    endDate: format(end, "yyyy-MM-dd"),
    days,
    label
  };
}

function parseRows(rows: RawRow[], bank: string, currency: string, rules: MerchantRule[]) {
  const transactions = rows.map((row, index) => normalizeRow(row, bank, currency, rules, index)).filter(Boolean) as Transaction[];
  if (!transactions.length) {
    throw new Error("No transactions found. Check that the statement includes date, description, and amount/debit/credit columns.");
  }
  return transactions;
}

function parseDelimited(input: string): RawRow[] {
  const parsed = Papa.parse<Record<string, string>>(input, {
    header: true,
    skipEmptyLines: true,
    transformHeader: normalizeHeader
  });

  if (parsed.errors.length && !parsed.data.length) {
    throw new Error(`Could not parse CSV: ${parsed.errors[0].message}`);
  }

  return parsed.data.map(normalizeObjectRow);
}

function parsePdfText(text: string): RawRow[] {
  const rows: RawRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
  const amountPattern = /[-+()]?\s*(?:QAR|QR)?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/gi;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const amounts = [...line.matchAll(amountPattern)].map((match) => match[0]).filter((value) => /\d/.test(value));
    const amount = amounts.at(-1);
    if (!amount) continue;

    const description = line
      .replace(dateMatch[0], " ")
      .replace(amount, " ")
      .replace(/\s+/g, " ")
      .trim();

    if (description.length < 2) continue;
    rows.push({ date: dateMatch[0], description, amount });
  }

  return rows;
}

function normalizeRow(row: RawRow, bank: string, currency: string, rules: MerchantRule[], index: number): Transaction | null {
  const date = getValue(row, dateKeys);
  const descriptionRaw = getValue(row, descriptionKeys);
  const amountValue = getAmount(row);

  if (!date || !descriptionRaw || amountValue === null) return null;

  const normalizedDate = normalizeDate(date);
  const direction: TransactionDirection = amountValue >= 0 ? "income" : "expense";
  const amount = Math.abs(amountValue);
  const merchant = cleanMerchant(descriptionRaw);
  const result = categorizeMerchant(descriptionRaw, rules, direction);
  const duplicateHash = crypto.createHash("sha256").update([normalizedDate, amount, descriptionRaw, bank].join("|")).digest("hex");

  return {
    id: duplicateHash.slice(0, 12) + index.toString().padStart(3, "0"),
    date: normalizedDate,
    bank,
    descriptionRaw,
    merchant,
    amount,
    direction,
    currency,
    category: result.category,
    subcategory: result.subcategory,
    confidence: result.confidence,
    reason: result.reason,
    needsReview: result.confidence < 0.75,
    categorySource: result.source,
    duplicateHash
  };
}

function getValue(row: RawRow, keys: string[]) {
  const key = keys.find((candidate) => row[candidate]);
  return key ? row[key] : "";
}

function getAmount(row: RawRow) {
  const debitKey = debitKeys.find((candidate) => row[candidate]);
  const creditKey = creditKeys.find((candidate) => row[candidate]);
  const debit = parseMoney(debitKey ? row[debitKey] : undefined);
  const credit = parseMoney(creditKey ? row[creditKey] : undefined);

  if (debit !== null && debit !== 0) return -Math.abs(debit);
  if (credit !== null && credit !== 0) return Math.abs(credit);

  const amountKey = amountKeys.find((candidate) => row[candidate]);
  const parsed = amountKey ? parseMoney(row[amountKey]) : null;
  if (parsed === null) return null;

  const direction = `${row.type ?? ""} ${row.direction ?? ""} ${row["dr/cr"] ?? ""}`.toLowerCase();
  if (/\b(debit|dr|withdrawal|paid out)\b/.test(direction)) return -Math.abs(parsed);
  if (/\b(credit|cr|deposit|paid in)\b/.test(direction)) return Math.abs(parsed);
  return parsed;
}

function parseMoney(value?: string) {
  if (!value) return null;
  const isParenthesized = /^\s*\(.*\)\s*$/.test(value);
  const isNegative = /-/.test(value) || isParenthesized;
  const normalized = value.replace(/[(),\s+-]/g, "").replace(/[A-Z]{2,3}/gi, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -Math.abs(parsed) : parsed;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  const formats = ["yyyy-MM-dd", "yyyy/MM/dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "MM/dd/yyyy", "M/d/yyyy", "dd/MM/yy", "d/M/yy"];
  for (const dateFormat of formats) {
    const parsed = parse(trimmed, dateFormat, new Date());
    if (isValid(parsed)) return format(parsed, "yyyy-MM-dd");
  }

  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? trimmed : parsed.toISOString().slice(0, 10);
}

function normalizeObjectRow(row: Record<string, unknown>): RawRow {
  return Object.fromEntries(
    Object.entries(row).map(([key, value]) => [normalizeHeader(key), value instanceof Date ? format(value, "yyyy-MM-dd") : String(value ?? "").trim()])
  );
}

function normalizeHeader(header: string) {
  return header
    .trim()
    .toLowerCase()
    .replace(/^\ufeff/, "")
    .replace(/\s+/g, " ");
}
