// Tipos que reflejan exactamente las respuestas del backend (ver backend/app/*/serializers.py).
// El dinero viaja como texto ("1200000.00") para no perder centavos: nunca se suma en el frontend.
export type Money = string;
export type ISODate = string;

export type AccountKind = "BANK" | "CASH" | "WALLET" | "OTHER";
export type TransactionKind =
  | "DEPOSIT"
  | "WITHDRAWAL"
  | "INCOME"
  | "EXPENSE"
  | "TRANSFER_IN"
  | "TRANSFER_OUT"
  | "LOAN_DISBURSEMENT"
  | "LOAN_PAYMENT";
export type ManualTransactionKind = "DEPOSIT" | "WITHDRAWAL" | "INCOME" | "EXPENSE";
export type LoanStatus = "ACTIVE" | "OVERDUE" | "DEFAULTED" | "PAID";
export type InstallmentStatus = "PENDING" | "PARTIAL" | "OVERDUE" | "PAID";
export type Frequency = "DAILY" | "WEEKLY" | "BIWEEKLY" | "MONTHLY";
export type InterestMode = "TOTAL" | "PER_PERIOD";

export interface Account {
  id: number;
  name: string;
  kind: AccountKind;
  initial_balance: Money;
  is_active: boolean;
  balance: Money;
  created_at: string;
}

export interface Transaction {
  id: number;
  account: number;
  account_name: string;
  kind: TransactionKind;
  amount: Money; // con signo
  date: ISODate;
  description: string;
  loan: number | null;
  transfer_group: string | null;
  created_at: string;
}

export interface Borrower {
  id: number;
  full_name: string;
  document_id: string;
  phone: string;
  address: string;
  notes: string;
  created_at: string;
}

export interface LoanListItem {
  id: number;
  borrower: number;
  borrower_name: string;
  account: number;
  account_name: string;
  principal: Money;
  interest_rate: string;
  interest_mode: InterestMode;
  installments_count: number;
  frequency: Frequency;
  start_date: ISODate;
  end_date: ISODate;
  installment_amount: Money;
  total_amount: Money;
  paid_total: Money;
  outstanding: Money;
  status: LoanStatus;
  days_overdue: number;
  next_due_date: ISODate | null;
}

export interface InstallmentRow {
  number: number;
  due_date: ISODate;
  amount: Money;
  principal_amount: Money;
  interest_amount: Money;
  paid_amount: Money;
  remaining: Money;
  status: InstallmentStatus;
}

export interface PaymentRow {
  id: number;
  amount: Money;
  date: ISODate;
  account: number;
  account_name: string;
  note: string;
}

export interface LoanDetail extends LoanListItem {
  interest_total: Money;
  outstanding_principal: Money;
  notes: string;
  installments: InstallmentRow[];
  payments: PaymentRow[];
}

export interface LoanPreview {
  interest_total: Money;
  total_amount: Money;
  installment_amount: Money;
  end_date: ISODate;
  installments: Pick<InstallmentRow, "number" | "due_date" | "principal_amount" | "interest_amount" | "amount">[];
}

export interface LoanClosed {
  id: number;
  close_reason: "SETTLED" | "WRITTEN_OFF" | "DELETED";
  written_off_amount: Money | null;
}

export interface DueRow {
  loan_id: number;
  borrower_name: string;
  number: number;
  due_date: ISODate;
  remaining: Money;
}

export interface Dashboard {
  total_balance: Money;
  outstanding_total: Money;
  outstanding_principal: Money;
  interest_earned: Money;
  net_worth: Money;
  losses_total: Money;
  accounts: { id: number; name: string; balance: Money }[];
  loans_by_status: Record<LoanStatus, number>;
  upcoming: DueRow[];
  overdue: (DueRow & { days_overdue: number })[];
}

export interface Projection {
  date: ISODate;
  current_balance: Money;
  expected_inflows: Money;
  overdue_amount: Money;
  projected_balance: Money;
  by_account: { id: number; name: string; current_balance: Money; expected_inflows: Money; projected_balance: Money }[];
}

// --- Entradas ---

export interface AccountInput {
  name: string;
  kind: AccountKind;
  initial_balance?: Money;
  is_active?: boolean;
}

export interface TransactionInput {
  account: number;
  kind: ManualTransactionKind;
  amount: Money;
  date: ISODate;
  description: string;
}

export interface TransferInput {
  from_account: number;
  to_account: number;
  amount: Money;
  date: ISODate;
  description: string;
}

export type BorrowerInput = Omit<Borrower, "id" | "created_at">;

export interface LoanPreviewInput {
  principal: Money;
  interest_rate: string;
  interest_mode: InterestMode;
  installments_count: number;
  frequency: Frequency;
  start_date: ISODate;
}

export interface LoanInput extends LoanPreviewInput {
  borrower: number;
  account: number;
  notes: string;
}

export interface PaymentInput {
  amount: Money;
  date: ISODate;
  account?: number;
  note: string;
}

export type Rating = "GOOD" | "REGULAR" | "RISKY" | "NO_HISTORY";
export type CloseReason = "SETTLED" | "WRITTEN_OFF" | "DELETED";

export interface BorrowerProfile {
  borrower: Borrower;
  rating: Rating;
  on_time_count: number;
  late_count: number;
  on_time_percent: number | null;
  avg_days_late: number;
  total_lent: Money;
  total_collected: Money;
  outstanding: Money;
  losses: Money;
  loans: {
    id: number;
    start_date: ISODate;
    end_date: ISODate;
    principal: Money;
    total_amount: Money;
    paid_total: Money;
    outstanding: Money;
    /** Abiertos: estado calculado. Cerrados: motivo del cierre. */
    status: LoanStatus | CloseReason;
    is_open: boolean;
  }[];
}
