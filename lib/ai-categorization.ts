import OpenAI from "openai";
import { categories } from "@/lib/categorization";
import type { CategorizationResult, CategoryName, Transaction, TransactionDirection } from "@/lib/types";

const reviewThreshold = 0.75;

const schema = {
  type: "object",
  additionalProperties: false,
  properties: {
    merchant_clean: { type: "string" },
    category: { type: "string", enum: categories },
    subcategory: { type: "string" },
    transaction_type: { type: "string", enum: ["income", "expense"] },
    confidence: { type: "number", minimum: 0, maximum: 1 },
    reason: { type: "string" }
  },
  required: ["merchant_clean", "category", "subcategory", "transaction_type", "confidence", "reason"]
} as const;

export async function categorizeUnknownTransactions(transactions: Transaction[]) {
  if (!process.env.OPENAI_API_KEY) {
    return transactions;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  const classified = await Promise.all(
    transactions.map(async (transaction) => {
      if (transaction.category !== "Other" && transaction.confidence >= reviewThreshold) {
        return transaction;
      }

      try {
        const result = await classifyTransaction(openai, transaction);
        return {
          ...transaction,
          merchant: result.merchant,
          category: result.category,
          subcategory: result.subcategory,
          direction: result.transactionType,
          confidence: result.confidence,
          reason: result.reason,
          needsReview: result.confidence < reviewThreshold,
          categorySource: "ai" as const
        };
      } catch {
        return {
          ...transaction,
          needsReview: true,
          reason: `${transaction.reason} AI classification failed; please review manually.`
        };
      }
    })
  );

  return classified;
}

async function classifyTransaction(openai: OpenAI, transaction: Transaction): Promise<CategorizationResult> {
  const completion = await openai.chat.completions.create({
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
    temperature: 0,
    messages: [
      {
        role: "system",
        content:
          "Classify personal bank transactions for a Qatar-based finance dashboard. Use only the provided transaction fields. Do not infer account numbers, identities, addresses, or other sensitive data."
      },
      {
        role: "user",
        content: JSON.stringify({
          date: transaction.date,
          description: transaction.descriptionRaw,
          amount: transaction.amount,
          currency: transaction.currency,
          direction: transaction.direction
        })
      }
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "transaction_categorization",
        strict: true,
        schema
      }
    }
  });

  const content = completion.choices[0]?.message.content;
  if (!content) {
    throw new Error("OpenAI returned an empty classification.");
  }

  const parsed = JSON.parse(content) as {
    merchant_clean: string;
    category: CategoryName;
    subcategory: string;
    transaction_type: TransactionDirection;
    confidence: number;
    reason: string;
  };

  return {
    merchant: parsed.merchant_clean,
    category: parsed.category,
    subcategory: parsed.subcategory,
    transactionType: parsed.transaction_type,
    confidence: parsed.confidence,
    reason: parsed.reason,
    source: "ai"
  };
}
