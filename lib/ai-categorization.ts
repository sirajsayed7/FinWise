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
  const locallyReviewed = transactions.map(enhanceLocalReviewState);
  if (!process.env.OPENAI_API_KEY) {
    return locallyReviewed;
  }

  // Identify transactions that need AI classification
  const needsClassification = locallyReviewed.filter(
    (tx) =>
      tx.category === "Other" ||
      tx.confidence < reviewThreshold
  );

  // If no transactions need classification, return as-is
  if (needsClassification.length === 0) {
    return locallyReviewed;
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  // Batch classify transactions (10-20 per request for optimal performance)
  const BATCH_SIZE = 15;
  const classificationResults = new Map<string, CategorizationResult>();

  for (let i = 0; i < needsClassification.length; i += BATCH_SIZE) {
    const batch = needsClassification.slice(
      i,
      Math.min(i + BATCH_SIZE, needsClassification.length)
    );

    try {
      const batchResults = await classifyTransactionBatch(openai, batch);
      batchResults.forEach((result, index) => {
        if (result.ok && result.data) {
          classificationResults.set(batch[index].id, result.data);
        }
      });
    } catch (error) {
      // Log batch error but continue with next batch
      console.error(
        `Batch classification failed for transactions ${batch.map((tx) => tx.id).join(", ")}:`,
        error
      );
    }
  }

  // Apply classification results to transactions
  const classified = locallyReviewed.map((transaction) => {
    const classificationResult = classificationResults.get(transaction.id);
    if (!classificationResult) {
      return transaction;
    }

    return {
      ...transaction,
      merchant: classificationResult.merchant,
      category: classificationResult.category,
      subcategory: classificationResult.subcategory,
      direction: classificationResult.transactionType,
      confidence: classificationResult.confidence,
      reason: classificationResult.reason,
      needsReview: classificationResult.confidence < reviewThreshold,
      categorySource: "ai" as const
    };
  });

  return classified;
}

function enhanceLocalReviewState(transaction: Transaction): Transaction {
  if (transaction.categorySource === "user_rule" && !transaction.needsReview) {
    return transaction;
  }

  const merchantLooksMessy =
    transaction.merchant.length < 3 ||
    /\b(unknown|payment|purchase|transaction|pos|card)\b/i.test(transaction.merchant) ||
    /\d{5,}/.test(transaction.merchant);
  const needsReview = transaction.needsReview || transaction.confidence < reviewThreshold || transaction.category === "Other" || merchantLooksMessy;

  return {
    ...transaction,
    needsReview,
    reason: needsReview && !transaction.reason.toLowerCase().includes("review")
      ? `${transaction.reason} Marked for review by local confidence checks.`
      : transaction.reason
  };
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

/**
 * Batch classify multiple transactions in a single API call
 * Reduces from N API calls to ceil(N/BATCH_SIZE) calls
 * ~15-20 transactions per request is optimal for gpt-4o-mini
 */
type BatchClassificationResult =
  | { ok: true; data: CategorizationResult }
  | { ok: false; error: string };

async function classifyTransactionBatch(
  openai: OpenAI,
  transactions: Transaction[]
): Promise<BatchClassificationResult[]> {
  if (transactions.length === 0) {
    return [];
  }

  const transactionData = transactions.map((tx) => ({
    id: tx.id,
    date: tx.date,
    description: tx.descriptionRaw,
    amount: tx.amount,
    currency: tx.currency,
    direction: tx.direction
  }));

  try {
    const completion = await openai.chat.completions.create({
      model: process.env.OPENAI_MODEL || "gpt-4o-mini",
      temperature: 0,
      messages: [
        {
          role: "system",
          content:
            "Classify personal bank transactions for a Qatar-based finance dashboard. Use only the provided transaction fields. Do not infer account numbers, identities, addresses, or other sensitive data. Return an array of classifications, one per transaction, in the same order."
        },
        {
          role: "user",
          content: JSON.stringify({
            batch: transactionData,
            instruction:
              "Classify each transaction and return as JSON array of objects with id and classification fields."
          })
        }
      ]
    });

    const content = completion.choices[0]?.message.content;
    if (!content) {
      throw new Error("OpenAI returned an empty batch classification.");
    }

    // Extract JSON array from response
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Could not extract JSON array from OpenAI response.");
    }

    const parsed = JSON.parse(jsonMatch[0]) as Array<{
      id: string;
      merchant_clean: string;
      category: CategoryName;
      subcategory: string;
      transaction_type: TransactionDirection;
      confidence: number;
      reason: string;
    }>;

    // Return results maintaining order and transaction IDs
    return transactions.map((tx) => {
      const classification = parsed.find((p) => p.id === tx.id);
      if (!classification) {
        return {
          ok: false,
          error: `No classification returned for transaction ${tx.id}`
        };
      }

      return {
        ok: true,
        data: {
          merchant: classification.merchant_clean,
          category: classification.category,
          subcategory: classification.subcategory,
          transactionType: classification.transaction_type,
          confidence: classification.confidence,
          reason: classification.reason,
          source: "ai"
        }
      };
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    // Return failed result for entire batch
    return transactions.map((tx) => ({
      ok: false,
      error: `Batch classification failed: ${errorMessage}`
    }));
  }
}
