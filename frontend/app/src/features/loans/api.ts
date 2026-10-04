import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { LoanDetail, LoanInput, LoanListItem, LoanPreview, LoanPreviewInput, LoanStatus, PaymentInput } from "../../api/types";
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
