import OpenAI from "openai";
import type { CategorizationResult } from "@/lib/types";

interface StreamingCategorizationParams {
  transactions: Array<{
    descriptionRaw: string;
    amount: number;
    merchant?: string;
  }>;
  onChunk?: (chunk: string) => void;
}

export async function streamTransactionCategorization({
  transactions,
  onChunk
}: StreamingCategorizationParams): Promise<CategorizationResult[]> {
  const transactionList = transactions
    .map(
      (t, i) =>
        `${i + 1}. Description: "${t.descriptionRaw}" | Merchant: "${t.merchant || "N/A"}" | Amount: $${t.amount}`
    )
    .join("\n");

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const stream = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      stream: true,
      temperature: 0.3,
      max_tokens: 2000,
      messages: [
        {
          role: "system",
          content: `You are a financial transaction categorization expert. Analyze transactions and categorize them accurately.
Available categories: Groceries, Ordering Out, Restaurants & Cafes, Transport, Fuel, Shopping, Malls, Bills, Subscriptions, Rent, Health, Entertainment, Cash Withdrawal, Bank Transfer, Salary / Income, Other.
Return ONLY valid JSON array with objects: {originalDescription: string, category: string, confidence: number (0-1), reason: string}.`
        },
        {
          role: "user",
          content: `Categorize these transactions:\n\n${transactionList}\n\nRespond with valid JSON array only.`
        }
      ]
    });

    let fullText = "";

    for await (const event of stream) {
      const chunk = event.choices[0]?.delta?.content || "";
      if (chunk) {
        fullText += chunk;
        onChunk?.(chunk);
      }
    }

    // Clean JSON response
    const jsonMatch = fullText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      throw new Error("Invalid JSON response from categorization API");
    }

    const results = JSON.parse(jsonMatch[0]) as CategorizationResult[];
    return results;
  } catch (error) {
    console.error("Error streaming categorization:", error);
    throw error;
  }
}
