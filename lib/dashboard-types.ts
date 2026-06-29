import type { ChangeEvent } from "react";
import type { Transaction } from "@/lib/types";

export type ActiveView = "home" | "transactions" | "upload" | "insights" | "settings" | "statements" | "review" | "planning" | "notifications";
export type SpendingPeriod = "This Month" | "Last Month" | "Year";

export type StatementPeriodInfo = {
  startDate: string | null;
  endDate: string | null;
  days: number;
  label: string;
};

export type StatementSummary = {
  id: string;
  fileName: string;
  bank: string;
  status: "processed" | "failed" | "review";
  uploadedAt: string;
  transactionCount: number;
  totalIncome: number;
  totalExpenses: number;
  period: StatementPeriodInfo;
  needsReview: number;
};

export type PendingImport = {
  statementId?: string;
  fileName: string;
  period: StatementPeriodInfo | null;
  transactions: Transaction[];
};

export type PendingTransactionPatch = Partial<Pick<Transaction, "date" | "merchant" | "category" | "amount" | "direction">>;
export type CorrectionOptions = { applyAllMatching: boolean };

export type TransactionSetter = (
  transactions: Transaction[] | ((current: Transaction[]) => Transaction[])
) => void;

export type UploadHandler = (event: ChangeEvent<HTMLInputElement>) => void;
