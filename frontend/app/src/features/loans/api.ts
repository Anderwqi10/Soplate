import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { LoanClosed, LoanDetail, LoanInput, LoanListItem, LoanPreview, LoanPreviewInput, LoanStatus, PaymentInput } from "../../api/types";
import { useMoneyMutation } from "../../api/useMoneyMutation";

export interface LoanFilters {
  status?: LoanStatus;
  borrower?: number;
}

export function useLoans(filters: LoanFilters) {
  return useQuery({
    queryKey: ["loans", filters],
    queryFn: () => apiFetch<LoanListItem[]>("/loans/", { query: { ...filters } }),
  });
}

export function useLoan(id: number) {
  return useQuery({ queryKey: ["loans", id], queryFn: () => apiFetch<LoanDetail>(`/loans/${id}/`) });
}

/** Calcula el cronograma sin guardar nada (no cambia datos, por eso no refresca nada). */
export function usePreviewLoan() {
  return useMutation({
    mutationFn: (body: LoanPreviewInput) => apiFetch<LoanPreview>("/loans/preview/", { method: "POST", body }),
  });
}

export function useCreateLoan() {
  return useMoneyMutation((body: LoanInput) => apiFetch<LoanDetail>("/loans/", { method: "POST", body }), [["loans"]]);
}

export function useCreatePayment(loanId: number) {
  return useMoneyMutation(
    (body: PaymentInput) => apiFetch<LoanDetail>(`/loans/${loanId}/payments/`, { method: "POST", body }),
    [["loans"]],
  );
}

export function useUpdateLoanNotes(loanId: number) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (notes: string) => apiFetch<LoanDetail>(`/loans/${loanId}/`, { method: "PATCH", body: { notes } }),
    onSuccess: (loan) => queryClient.setQueryData(["loans", loanId], loan),
  });
}

// Cerrar un préstamo lo saca de la app: se refresca todo sin esperar, porque la pantalla de detalle se abandona.
const CLOSING = { waitForRefresh: false };

export function useSettleLoan(loanId: number) {
  return useMoneyMutation(
    (account: number) => apiFetch<LoanClosed>(`/loans/${loanId}/settle/`, { method: "POST", body: { account } }),
    [["loans"]],
    CLOSING,
  );
}

export function useWriteOffLoan(loanId: number) {
  return useMoneyMutation(
    () => apiFetch<LoanClosed>(`/loans/${loanId}/write-off/`, { method: "POST" }),
    [["loans"]],
    CLOSING,
  );
}

export function useDeleteLoan(loanId: number) {
  return useMoneyMutation(() => apiFetch<void>(`/loans/${loanId}/`, { method: "DELETE" }), [["loans"]], CLOSING);
}

export function useUpdateLoanTerms(loanId: number) {
  return useMoneyMutation(
    (body: { interest_rate?: string; start_date?: string }) =>
      apiFetch<LoanDetail>(`/loans/${loanId}/terms/`, { method: "PATCH", body }),
    [["loans"]],
  );
}
