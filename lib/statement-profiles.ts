export type StatementColumnLayout =
  | "debit-credit-balance"
  | "credit-debit-balance"
  | "in-out-balance"
  | "signed-amount-balance"
  | "unknown";

export type StatementProfile = {
  id: "doha-bank" | "qnb" | "qib" | "emirates-nbd" | "emirates-islamic" | "adcb" | "generic";
  bank: string;
  currency: string;
  layout: StatementColumnLayout;
  confidence: number;
};

const bankMatchers: Array<{ id: StatementProfile["id"]; bank: string; pattern: RegExp }> = [
  { id: "doha-bank", bank: "Doha Bank", pattern: /\bdoha bank\b|\bdohb\b/i },
  { id: "qnb", bank: "QNB", pattern: /\bqnb\b|qatar national bank/i },
  { id: "qib", bank: "Qatar Islamic Bank", pattern: /\bqib\b|qatar islamic bank|www\.qib\.com\.qa/i },
  { id: "emirates-nbd", bank: "Emirates NBD", pattern: /emirates\s+nbd/i },
  { id: "emirates-islamic", bank: "Emirates Islamic", pattern: /emirates\s+islamic/i },
  { id: "adcb", bank: "ADCB", pattern: /\badcb\b|abu dhabi commercial bank/i }
];

const currencyMatchers = ["QAR", "AED", "USD", "EUR", "GBP", "SAR", "BHD", "KWD", "OMR"];

export function detectStatementProfile(text: string, suppliedBank = ""): StatementProfile {
  const compact = text.replace(/\s+/g, " ");
  const bankMatch = bankMatchers.find((candidate) => candidate.pattern.test(compact));
  const suppliedMatch = bankMatchers.find((candidate) => candidate.pattern.test(suppliedBank));
  const identity = bankMatch ?? suppliedMatch;
  const currency = currencyMatchers.find((candidate) => new RegExp(`\\b${candidate}\\b`, "i").test(compact))
    ?? inferCurrencyFromBank(identity?.id)
    ?? "QAR";

  return {
    id: identity?.id ?? "generic",
    bank: identity?.bank ?? normalizeSuppliedBank(suppliedBank),
    currency,
    layout: detectColumnLayout(compact),
    confidence: bankMatch ? 0.99 : suppliedMatch ? 0.7 : 0.45
  };
}

function detectColumnLayout(text: string): StatementColumnLayout {
  if (/credit\s+amount\s+debit\s+amount\s+balance/i.test(text)) return "credit-debit-balance";
  if (/\bin\s*\([^)]*\)\s+out\s*\([^)]*\)\s+balance/i.test(text)) return "in-out-balance";
  if (/debit(?:\s*\([^)]*\))?\s+credit(?:\s*\([^)]*\))?\s+balance/i.test(text)) return "debit-credit-balance";
  if (/debit\s*\/\s*credit\s+account\s+balance/i.test(text)) return "signed-amount-balance";
  return "unknown";
}

function inferCurrencyFromBank(id?: StatementProfile["id"]) {
  if (id === "emirates-nbd" || id === "emirates-islamic" || id === "adcb") return "AED";
  if (id === "doha-bank" || id === "qnb" || id === "qib") return "QAR";
  return null;
}

function normalizeSuppliedBank(value: string) {
  const trimmed = value.trim();
  return trimmed && !/^auto|unknown$/i.test(trimmed) ? trimmed : "Unknown Bank";
}