import crypto from "node:crypto";
import { createRequire } from "node:module";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { read, utils } from "xlsx";
import Papa from "papaparse";
import { differenceInCalendarDays, format, isValid, parse, parseISO } from "date-fns";
import { categorizeMerchant, cleanMerchant } from "@/lib/categorization";
import { extractStatementRowsWithAI } from "@/lib/ai-statement-extraction";
import { parsePdfStatementText, type StatementParseDiagnostics } from "@/lib/pdf-statement-parser";
import { detectStatementProfile, type StatementProfile } from "@/lib/statement-profiles";
import type { MerchantRule, Transaction, TransactionDirection } from "@/lib/types";

type RawRow = Record<string, string>;
const requirePdfParser = createRequire(import.meta.url);

export type StatementPeriod = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

export type ParsedStatementFile = {
  transactions: Transaction[];
  profile: StatementProfile;
  diagnostics: StatementParseDiagnostics;
};

const dateKeys = ["date", "statement date", "transaction date", "posting date", "value date", "txn date", "booking date"];
const descriptionKeys = ["description", "details", "merchant", "narration", "narrative", "transaction", "transaction details", "particulars", "reference", "memo"];
const amountKeys = ["amount", "transaction amount", "debit", "credit", "paid out", "paid in", "withdrawal", "deposit"];
const debitKeys = ["debit", "paid out", "out", "withdrawal", "withdrawals", "debit amount"];
const creditKeys = ["credit", "paid in", "in", "deposit", "deposits", "credit amount"];
const maxPersonalTransactionAmount = 1_000_000;

export async function parseStatementFile(file: File, bank = "Auto detect", rules: MerchantRule[] = []): Promise<ParsedStatementFile> {
  const extension = file.name.split(".").pop()?.toLowerCase();

  if (extension === "csv" || extension === "txt") {
    const input = await file.text();
    const rows = parseDelimited(input);
    const profile = detectStatementProfile(file.name + " " + Object.keys(rows[0] ?? {}).join(" "), bank);
    return buildParsedStatement(rows, profile, rules);
  }

  if (extension === "xls" || extension === "xlsx") {
    const workbook = read(await file.arrayBuffer(), { type: "array", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: "" }).map(normalizeObjectRow);
    const profile = detectStatementProfile(file.name + " " + Object.keys(rows[0] ?? {}).join(" "), bank);
    return buildParsedStatement(rows, profile, rules);
  }

  if (extension === "pdf") {
    const buffer = Buffer.from(await file.arrayBuffer());
    installPdfRuntimeGlobals();
    const { PDFParse } = requirePdfParser("pdf-parse") as typeof import("pdf-parse");
    PDFParse.setWorker(pathToFileURL(path.join(process.cwd(), "node_modules", "pdfjs-dist", "build", "pdf.worker.mjs")).href);
    const parser = new PDFParse({ data: buffer });
    try {
      const parsed = await parser.getText();
      try {
        const local = parseStatementText(parsed.text, bank, rules);
        if (local.diagnostics.confidence >= 0.62 || !process.env.OPENAI_API_KEY) return local;
        const ai = await extractStatementRowsWithAI(buffer, file.name);
        return ai ? buildParsedStatement(ai.rows, ai.profile, rules, ai.diagnostics) : local;
      } catch (localError) {
        const ai = await extractStatementRowsWithAI(buffer, file.name);
        if (ai) return buildParsedStatement(ai.rows, ai.profile, rules, ai.diagnostics);
        throw localError;
      }
    } finally {
      await parser.destroy();
    }
  }

  throw new Error("Unsupported statement format. Upload CSV, TXT, XLS, XLSX, or PDF.");
}

export function parseStatementText(text: string, bank = "Auto detect", rules: MerchantRule[] = []): ParsedStatementFile {
  if (text.replace(/\s+/g, "").length < 80) {
    throw new Error("This PDF has no readable text layer. Export a digital statement or enable AI document extraction.");
  }

  const generic = parsePdfStatementText(text, bank);
  const dedicatedRows = parseDebitCreditPdfTable(text);
  const rows = dedicatedRows.length >= generic.rows.length ? dedicatedRows : generic.rows;
  const result = buildParsedStatement(rows, generic.profile, rules, generic.diagnostics);
  if (!result.transactions.length) {
    throw new Error("No transactions found. The statement is readable, but its table layout needs review.");
  }
  return result;
}

function buildParsedStatement(
  rows: RawRow[],
  profile: StatementProfile,
  rules: MerchantRule[],
  diagnostics?: StatementParseDiagnostics
): ParsedStatementFile {
  const transactions = parseRows(rows, profile.bank, profile.currency, rules);
  transactions.forEach((transaction, index) => {
    const warning = rows[index]?.["parse warning"];
    const aiConfidence = Number(rows[index]?.["ai confidence"]);
    if (warning) {
      transaction.needsReview = true;
      transaction.confidence = Math.min(transaction.confidence, 0.55);
      transaction.reason = warning;
    } else if (Number.isFinite(aiConfidence) && aiConfidence < 0.75) {
      transaction.needsReview = true;
      transaction.confidence = Math.min(transaction.confidence, aiConfidence);
      transaction.reason = "AI extraction confidence is low; verify this row before saving.";
    }
  });

  return {
    transactions,
    profile,
    diagnostics: diagnostics
      ? { ...diagnostics, rowCount: transactions.length }
      : {
          profileId: profile.id,
          bank: profile.bank,
          currency: profile.currency,
          layout: profile.layout,
          extractionMethod: "local_text",
          rowCount: transactions.length,
          balanceChecks: 0,
          balanceMatches: 0,
          confidence: profile.confidence,
          warnings: profile.id === "generic" ? ["Bank identity was not detected automatically."] : []
        }
  };
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
  const tableRows = parseDebitCreditPdfTable(text);
  if (tableRows.length) return tableRows;

  const rows: RawRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const datePattern = /(\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}[/-]\d{1,2}[/-]\d{1,2})/;
  const amountPattern = /[-+()]?\s*(?:QAR|QR)?\s*(?:\d{1,3}(?:,\d{3})+|\d+)(?:\.\d{2})?/gi;

  for (const line of lines) {
    const dateMatch = line.match(datePattern);
    if (!dateMatch) continue;

    const amounts = [...line.matchAll(amountPattern)].map((match) => match[0]).filter((value) => /\d/.test(value));
    if (!amounts.length) continue;
    const amount = amounts.at(-1);
    if (!amount) continue;

    const description = amounts.slice(-3).reduce(
      (current, token) => current.replace(token, " "),
      line.replace(dateMatch[0], " ")
    ).replace(/\s+/g, " ").trim();

    if (isNonTransactionDescription(description)) continue;
    if (description.length < 2) continue;

    if (amounts.length >= 3) {
      const [debit, credit, balance] = amounts.slice(-3);
      rows.push({ date: dateMatch[0], description, debit, credit, balance });
    } else {
      rows.push({ date: dateMatch[0], description, amount });
    }
  }

  return rows;
}

function parseDebitCreditPdfTable(text: string): RawRow[] {
  if (!/Date\s+Doc\s+#\s+Description\s+Value Date\s+Debit/i.test(text)) return [];

  const rows: RawRow[] = [];
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const singleLinePattern = /^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s+(.+?)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  const startPattern = /^(\d{2}\/\d{2}\/\d{4})\s+(\d+)\s*(.*)$/;
  const amountTailPattern = /^(?:(.*?)\s+)?(\d{2}\/\d{2}\/\d{4})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})\s+([\d,]+\.\d{2})$/;
  let current: RawRow | null = null;

  const pushCurrent = () => {
    if (current) {
      current.description = current.description.replace(/\s+/g, " ").trim();
      rows.push(current);
    }
  };

  for (const line of lines) {
    const singleLineMatch = line.match(singleLinePattern);
    if (singleLineMatch) {
      pushCurrent();
      rows.push({
        date: singleLineMatch[1],
        description: singleLineMatch[3],
        "value date": singleLineMatch[4],
        debit: singleLineMatch[5],
        credit: singleLineMatch[6],
        balance: singleLineMatch[7]
      });
      current = null;
      continue;
    }

    const amountTailMatch = line.match(amountTailPattern);
    if (current && amountTailMatch) {
      const extraDescription = amountTailMatch[1]?.trim();
      if (extraDescription) current.description += ` ${extraDescription}`;
      current["value date"] = amountTailMatch[2];
      current.debit = amountTailMatch[3];
      current.credit = amountTailMatch[4];
      current.balance = amountTailMatch[5];
      pushCurrent();
      current = null;
      continue;
    }

    const startMatch = line.match(startPattern);
    if (startMatch) {
      pushCurrent();
      current = { date: startMatch[1], description: startMatch[3] || "" };
      continue;
    }

    if (!current || isStatementNoiseLine(line)) continue;
    if (shouldKeepPdfDescriptionLine(line)) current.description += ` ${line}`;
  }

  pushCurrent();
  return rows;
}

function isStatementNoiseLine(line: string) {
  return /^(Bank Account eStatement|Name\s*:|Address\s*:|Email\s*:|Phone\s*:|IBAN:|Statement Period|Date\s+Doc\s+#|This is an auto generated|©|Page \d+ of \d+)/i.test(line)
    || /^In case contact details/i.test(line)
    || /^same\.$/i.test(line);
}

function shouldKeepPdfDescriptionLine(line: string) {
  if (/#\d+/.test(line) || /\b\d{8,}\b/.test(line)) return false;
  return /[A-Z]{3,}/i.test(line);
}

function normalizeRow(row: RawRow, bank: string, currency: string, rules: MerchantRule[], index: number): Transaction | null {
  const date = getValue(row, dateKeys);
  const descriptionRaw = getValue(row, descriptionKeys);
  const amountValue = getAmount(row);

  if (!date || !descriptionRaw || amountValue === null) return null;
  if (isNonTransactionDescription(descriptionRaw)) return null;

  const normalizedDate = normalizeDate(date);
  if (!isIsoDate(normalizedDate)) return null;
  const direction: TransactionDirection = amountValue >= 0 ? "income" : "expense";
  const amount = Math.abs(amountValue);
  if (!isPlausibleTransactionAmount(amount, descriptionRaw, direction)) return null;
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
  if (/^\s*-?\s*$/.test(value)) return null;
  const isParenthesized = /^\s*\(.*\)\s*$/.test(value);
  const isNegative = /-/.test(value) || isParenthesized;
  const normalized = value.replace(/(?:QAR|QR|AED|USD|EUR|GBP|SAR|BHD|KWD|OMR)/gi, "").replace(/[(),\s+-]/g, "");
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return isNegative ? -Math.abs(parsed) : parsed;
}

function normalizeDate(value: string) {
  const trimmed = value.trim();
  const formats = ["yyyy-MM-dd", "yyyy/MM/dd", "dd/MM/yyyy", "d/M/yyyy", "dd-MM-yyyy", "d-M-yyyy", "MM/dd/yyyy", "M/d/yyyy", "dd/MM/yy", "d/M/yy", "dd MMM yyyy", "d MMM yyyy", "dd-MMM-yyyy", "d-MMM-yyyy", "dd MMM yy", "d MMM yy", "dd-MMM-yy", "d-MMM-yy"];
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
    .replace(/\s*\([^)]*\)\s*/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isNonTransactionDescription(description: string) {
  return /\b(opening balance|closing balance|available balance|current balance|ledger balance|running balance|brought forward|carried forward|total debit|total credit|total amount|statement period|account number|iban|customer id|page \d+|date doc|description value date|balance)\b/i.test(description);
}

function isPlausibleTransactionAmount(amount: number, description: string, direction: TransactionDirection) {
  if (!Number.isFinite(amount) || amount <= 0) return false;
  if (amount > maxPersonalTransactionAmount) return false;
  if (direction === "income" && /\b(salary|bonus|allowance|payroll)\b/i.test(description)) return amount <= maxPersonalTransactionAmount;
  return amount <= maxPersonalTransactionAmount;
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}
