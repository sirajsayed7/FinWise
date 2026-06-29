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
  statementId?: string;
  statementFileName?: string;
  statementUploadedAt?: string;
  statementPeriodLabel?: string;
  statementStatus?: "processed" | "failed" | "review";
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
  updatedAt?: string;
};

export type MerchantRule = {
  id?: string;
  pattern: string;
  category: CategoryName;
  merchant?: string;
  subcategory?: string;
};

export type StatementRecord = {
  id: string;
  userId?: string;
  fileName: string;
  bank: string;
  currency: string;
  status: "processed" | "failed" | "review";
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  periodStart: string | null;
  periodEnd: string | null;
  periodDays: number;
  periodLabel: string;
  fileHash?: string | null;
  blobUrl?: string | null;
  uploadedAt: string;
  updatedAt?: string;
  deviceId?: string;
};

export type MerchantLogoRecord = {
  id?: string;
  merchantKey: string;
  merchantName: string;
  logoUrl: string;
  source: "known_domain" | "favicon" | "manual" | "fallback";
  confidence: number;
};

export type BudgetRecord = {
  id?: string;
  category: CategoryName;
  amount: number;
  currency: string;
  period: "monthly" | "weekly";
};

export type TransactionTombstone = {
  transactionId: string;
  statementId?: string;
  deletedAt: string;
  deviceId?: string;
};
export type DashboardMetrics = {
  transactionCount: number;
  statementCount: number;
  needsReview: number;
  totalIncome: number;
  totalExpenses: number;
  latestDate: string | null;
  categoryTotals: Array<{ month: string; category: CategoryName; amount: number }>;
  dailyExpenses: Array<{ date: string; amount: number }>;
  monthlyExpenses: Array<{ month: string; amount: number }>;
  merchantTotals: Array<{ month: string; merchant: string; amount: number; count: number }>;
};

export type FinancialGoal = {
  id: string;
  name: string;
  targetAmount: number;
  currentAmount: number;
  targetDate: string | null;
  createdAt?: string;
};

export type FinanceNotification = {
  id: string;
  type: "budget" | "recurring" | "unusual" | "sync";
  severity: "info" | "warning" | "critical";
  title: string;
  body: string;
};

export type DashboardSummary = {
  totalExpenses: number;
  totalIncome: number;
  net: number;
  topCategory: CategoryName;
  topMerchant: string;
};

export type SpendingRow = {
  label: string;
  amount: number;
  percent: number;
  color: string;
};

export type TrendPoint = {
  date: string;
  amount: number;
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
