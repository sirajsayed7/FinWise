export type CategoryName =
  | "Groceries"
  | "Ordering Out"
  | "Restaurants & Cafes"
  | "Transport"
  | "Fuel"
  | "Shopping"
  | "Malls"
  | "Bills"
  | "Subscriptions"
  | "Rent"
  | "Cash Withdrawal"
  | "Bank Transfer"
  | "Entertainment"
  | "Health"
  | "Salary / Income"
  | "Other";

export type TransactionDirection = "income" | "expense";
export type CategorizationSource = "user_rule" | "default_rule" | "ai" | "fallback";

export type Transaction = {
  id: string;
  date: string;
  bank: string;
  descriptionRaw: string;
  merchant: string;
  amount: number;
  direction: TransactionDirection;
  currency: string;
  category: CategoryName;
  subcategory: string;
  confidence: number;
  reason: string;
  needsReview: boolean;
  categorySource: CategorizationSource;
  duplicateHash: string;
};

export type MerchantRule = {
  pattern: string;
  category: CategoryName;
};

export type DashboardSummary = {
  totalExpenses: number;
  totalIncome: number;
  net: number;
  topCategory: CategoryName;
  topMerchant: string;
};

export type CategorizationResult = {
  merchant: string;
  category: CategoryName;
  subcategory: string;
  transactionType: TransactionDirection;
  confidence: number;
  reason: string;
  source: CategorizationSource;
};
