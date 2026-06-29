import type { StatementProfile } from "@/lib/statement-profiles";
import { detectStatementProfile } from "@/lib/statement-profiles";

export type RawStatementRow = Record<string, string>;

export type StatementParseDiagnostics = {
  profileId: StatementProfile["id"];
  bank: string;
  currency: string;
  layout: StatementProfile["layout"];
  extractionMethod: "local_text" | "ai_vision";
  rowCount: number;
  balanceChecks: number;
  balanceMatches: number;
  confidence: number;
  warnings: string[];
};

type CandidateRow = {
  row: RawStatementRow;
  date: string;
  description: string;
  amount: number | null;
  balance: number | null;
  directionKnown: boolean;
};

const monthNames = "Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec";
const dateSource = `(?:\\d{4}[/-]\\d{1,2}[/-]\\d{1,2}|\\d{1,2}[/-]\\d{1,2}[/-]\\d{2,4}|\\d{1,2}(?:-|\\s)(?:${monthNames})(?:-|\\s)\\d{2,4})`;
const rowStartPattern = new RegExp(`^(${dateSource})\\s+(.+)$`, "i");
const moneyPattern = /[-+]?(?:\b(?:QAR|AED|USD|EUR|GBP|SAR|BHD|KWD|OMR)\s*)?[-+]?\(?\d[\d,]*\.\d{2}\)?/gi;

export function parsePdfStatementText(text: string, suppliedBank = "") {
  const profile = detectStatementProfile(text, suppliedBank);
  const blocks = buildTransactionBlocks(text);
  const candidates = blocks
    .map((block) => parseBlock(block, profile))
    .filter((candidate): candidate is CandidateRow => Boolean(candidate));

  resolveUnsignedDirections(candidates, text);
  const rows = candidates.map((candidate) => candidate.row);
  const balance = validateRunningBalances(candidates, text);
  const warnings: string[] = [];

  if (profile.id === "generic") warnings.push("Bank layout was not recognized; review imported rows carefully.");
  if (profile.layout === "unknown") warnings.push("Debit and credit column order was inferred from amounts and balances.");
  if (balance.checks >= 2 && balance.matches / balance.checks < 0.75) {
    warnings.push("Running-balance checks found inconsistencies; affected rows require review.");
  }

  const balanceScore = balance.checks ? balance.matches / balance.checks : 0.72;
  const confidence = clamp(
    profile.confidence * 0.35
      + (profile.layout === "unknown" ? 0.16 : 0.3)
      + Math.min(rows.length / 10, 1) * 0.15
      + balanceScore * 0.2,
    0,
    0.99
  );

  return {
    rows,
    profile,
    diagnostics: {
      profileId: profile.id,
      bank: profile.bank,
      currency: profile.currency,
      layout: profile.layout,
      extractionMethod: "local_text" as const,
      rowCount: rows.length,
      balanceChecks: balance.checks,
      balanceMatches: balance.matches,
      confidence,
      warnings
    } satisfies StatementParseDiagnostics
  };
}

function buildTransactionBlocks(text: string) {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (isNoiseLine(line)) continue;
    if (rowStartPattern.test(line) && !isValueDateAmountTail(line, current)) {
      if (current) blocks.push(current);
      current = [line];
      continue;
    }
    if (current) current.push(line);
  }
  if (current) blocks.push(current);
  return blocks;
}

function isValueDateAmountTail(line: string, current: string[] | null) {
  if (!current) return false;
  if (!new RegExp(`^${dateSource}\\s+`, "i").test(line)) return false;
  const withoutDate = line.replace(new RegExp(`^${dateSource}\\s+`, "i"), "");
  const values = extractMoneyValues(withoutDate);
  return values.length >= 2 && !/[A-Za-z]{3,}/.test(removeMoneyTokens(withoutDate));
}

function parseBlock(block: string[], profile: StatementProfile): CandidateRow | null {
  const first = block[0].match(rowStartPattern);
  if (!first) return null;

  const date = first[1];
  const joined = block.join(" ");
  const values = extractMoneyValues(joined);
  if (!values.length) return null;

  const balance = values.length >= 2 ? values.at(-1) ?? null : null;
  const tail = values.length >= 3 ? values.slice(-3) : values;
  let debit: number | null = null;
  let credit: number | null = null;
  let amount: number | null = null;
  let direction = "";
  let directionKnown = false;

  if (profile.layout === "debit-credit-balance" && tail.length >= 3) {
    [debit, credit] = tail;
    directionKnown = hasMovement(debit) || hasMovement(credit);
  } else if ((profile.layout === "credit-debit-balance" || profile.layout === "in-out-balance") && tail.length >= 3) {
    [credit, debit] = tail;
    directionKnown = hasMovement(debit) || hasMovement(credit);
  } else if (profile.layout === "signed-amount-balance" && values.length >= 2) {
    amount = values.at(-2) ?? null;
    direction = amount !== null && amount < 0 ? "debit" : "credit";
    directionKnown = amount !== null;
  } else if (values.length >= 3 && profile.layout === "unknown") {
    const [firstAmount, secondAmount] = tail;
    if (firstAmount === 0 || secondAmount === 0) {
      debit = firstAmount;
      credit = secondAmount;
      directionKnown = true;
    } else {
      amount = values.at(-2) ?? null;
    }
  } else {
    amount = values.length >= 2 ? values.at(-2) ?? null : values[0];
  }

  const description = cleanDescription(joined, date, values);
  if (!description || isSummaryDescription(description)) return null;

  const row: RawStatementRow = { date, description };
  if (debit !== null) row.debit = String(Math.abs(debit));
  if (credit !== null) row.credit = String(Math.abs(credit));
  if (amount !== null) row.amount = String(amount);
  if (direction) row.direction = direction;
  if (balance !== null) row.balance = String(balance);

  return { row, date, description, amount, balance, directionKnown };
}

function resolveUnsignedDirections(candidates: CandidateRow[], text: string) {
  const order = detectDateOrder(candidates);
  const openingBalance = extractOpeningBalance(text);

  candidates.forEach((candidate, index) => {
    if (candidate.directionKnown || candidate.amount === null || candidate.balance === null) return;
    const reference = order === "ascending"
      ? (index > 0 ? candidates[index - 1].balance : openingBalance)
      : (index < candidates.length - 1 ? candidates[index + 1].balance : openingBalance);
    const delta = reference === null || reference === undefined ? null : candidate.balance - reference;

    if (delta !== null && approximately(Math.abs(delta), Math.abs(candidate.amount))) {
      candidate.row.direction = delta < 0 ? "debit" : "credit";
      candidate.row.amount = String(Math.abs(candidate.amount));
      candidate.directionKnown = true;
      return;
    }

    const inferred = inferDirection(candidate.description);
    candidate.row.direction = inferred;
    candidate.row.amount = String(Math.abs(candidate.amount));
  });
}

function validateRunningBalances(candidates: CandidateRow[], text: string) {
  const order = detectDateOrder(candidates);
  const openingBalance = extractOpeningBalance(text);
  let checks = 0;
  let matches = 0;

  candidates.forEach((candidate, index) => {
    if (candidate.balance === null) return;
    const reference = order === "ascending"
      ? (index > 0 ? candidates[index - 1].balance : openingBalance)
      : (index < candidates.length - 1 ? candidates[index + 1].balance : openingBalance);
    if (reference === null || reference === undefined) return;

    const debit = parseNumeric(candidate.row.debit);
    const credit = parseNumeric(candidate.row.credit);
    const amount = parseNumeric(candidate.row.amount);
    const direction = candidate.row.direction;
    let movement: number | null = null;
    if (debit !== null && debit !== 0) movement = -Math.abs(debit);
    else if (credit !== null && credit !== 0) movement = Math.abs(credit);
    else if (amount !== null) movement = /debit|expense|out/i.test(direction) ? -Math.abs(amount) : Math.abs(amount);
    if (movement === null) return;

    checks += 1;
    if (approximately(reference + movement, candidate.balance)) matches += 1;
    else candidate.row["parse warning"] = "Amount does not reconcile with the reported running balance.";
  });

  return { checks, matches };
}

function cleanDescription(joined: string, date: string, values: number[]) {
  let description = joined.replace(date, " ");
  description = removeMoneyTokens(description);
  description = description
    .replace(new RegExp(dateSource, "gi"), " ")
    .replace(/^\s*\d{1,12}\s+/, " ")
    .replace(/\b(?:QAR|AED|USD|EUR|GBP|SAR|BHD|KWD|OMR)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (values.length && /^[-+]?\d[\d,]*(?:\.\d{2})?\s*$/.test(description)) return "";
  return description;
}

function removeMoneyTokens(value: string) {
  return value.replace(moneyPattern, " ");
}

function extractMoneyValues(value: string) {
  return [...value.matchAll(moneyPattern)]
    .map((match) => parseNumeric(match[0]))
    .filter((amount): amount is number => amount !== null);
}

function extractOpeningBalance(text: string) {
  const match = text.match(/opening\s+balance(?:\s*[:\-])?\s*(?:QAR|AED|USD|EUR|GBP|SAR|BHD|KWD|OMR)?\s*([-+]?\(?[\d,]+\.\d{2}\)?)/i);
  return parseNumeric(match?.[1]);
}

function parseNumeric(value?: string | number | null) {
  if (value === null || value === undefined || value === "") return null;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  const negative = /-|\(.*\)/.test(value);
  const parsed = Number(value.replace(/[A-Za-z(),+\s]/g, "").replace(/,/g, ""));
  if (!Number.isFinite(parsed)) return null;
  return negative ? -Math.abs(parsed) : parsed;
}

function detectDateOrder(candidates: CandidateRow[]) {
  const dates = candidates
    .map((candidate) => parseDateOrderValue(candidate.date))
    .filter((value): value is number => value !== null);
  if (dates.length < 2) return "ascending" as const;
  return dates[0] <= dates[dates.length - 1] ? "ascending" as const : "descending" as const;
}

function parseDateOrderValue(value: string) {
  const normalized = value.replace(/-/g, " ");
  const timestamp = Date.parse(normalized);
  if (Number.isFinite(timestamp) && /[A-Za-z]/.test(normalized)) return timestamp;
  const parts = value.split(/[/-]/).map(Number);
  if (parts.length !== 3 || parts.some((part) => !Number.isFinite(part))) return null;
  const [first, second, third] = parts;
  const year = first > 1900 ? first : third < 100 ? 2000 + third : third;
  const month = first > 1900 ? second : second;
  const day = first > 1900 ? third : first;
  return Date.UTC(year, month - 1, day);
}

function inferDirection(description: string) {
  if (/\b(salary|credit|deposit|refund|reversal|incoming|inward|received|transfer from)\b/i.test(description)) return "credit";
  return "debit";
}

function isSummaryDescription(value: string) {
  return /\b(open(?:ing)? balance|closing balance|total debit|total credit|total movements|number of movements|account summary)\b/i.test(value);
}

function isNoiseLine(line: string) {
  return /^(?:-- \d+ of \d+ --|page \d+|bank account estatement|account statement|this is an auto generated|generated\s|authori[sz]ed signature|bank stamp)/i.test(line)
    || /^(?:account number|iban|customer id|account type|branch name|currency|from date|to date|statement from|statement period)\s*[:|]/i.test(line)
    || /^(?:total debit|total credit|total movements|number of movements|closing balance)\b/i.test(line)
    || /^(?:date|statement date)\s+(?:doc|description|narration)/i.test(line);
}

function hasMovement(value: number | null) {
  return value !== null && Math.abs(value) > 0.0001;
}

function approximately(left: number, right: number) {
  return Math.abs(left - right) <= Math.max(0.03, Math.abs(right) * 0.00001);
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.min(maximum, Math.max(minimum, value));
}