import type { AccountKind, CloseReason, Frequency, InstallmentStatus, LoanStatus, Rating, TransactionKind } from "../api/types";

export type Tone = "green" | "amber" | "red" | "gray";

export const LOAN_STATUS: Record<LoanStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: "Al día", tone: "green" },
  OVERDUE: { label: "Retrasado", tone: "amber" },
  DEFAULTED: { label: "Vencido", tone: "red" },
  PAID: { label: "Pagado", tone: "gray" },
};

export const INSTALLMENT_STATUS: Record<InstallmentStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendiente", tone: "gray" },
  PARTIAL: { label: "Parcial", tone: "amber" },
  OVERDUE: { label: "Vencida", tone: "red" },
  PAID: { label: "Pagada", tone: "green" },
};

export const FREQUENCY_LABEL: Record<Frequency, string> = {
  DAILY: "Diaria",
  WEEKLY: "Semanal",
  BIWEEKLY: "Quincenal",
  MONTHLY: "Mensual",
};

export const ACCOUNT_KIND_LABEL: Record<AccountKind, string> = {
  BANK: "Banco",
  CASH: "Efectivo",
  WALLET: "Billetera digital",
  OTHER: "Otra",
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  DEPOSIT: "Depósito",
  WITHDRAWAL: "Retiro",
  INCOME: "Ingreso",
  EXPENSE: "Gasto",
  TRANSFER_IN: "Transferencia recibida",
  TRANSFER_OUT: "Transferencia enviada",
  LOAN_DISBURSEMENT: "Préstamo entregado",
  LOAN_PAYMENT: "Pago recibido",
};

export const RATING: Record<Rating, { label: string; tone: Tone }> = {
  GOOD: { label: "Buen pagador", tone: "green" },
  REGULAR: { label: "Regular", tone: "amber" },
  RISKY: { label: "Riesgoso", tone: "red" },
  NO_HISTORY: { label: "Sin historial", tone: "gray" },
};

export const CLOSE_REASON_LABEL: Record<CloseReason, string> = {
  SETTLED: "Liquidado",
  WRITTEN_OFF: "Pérdida",
  DELETED: "Eliminado",
};
