import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { Borrower, BorrowerInput } from "../../api/types";

export function useBorrowers() {
  return useQuery({ queryKey: ["borrowers"], queryFn: () => apiFetch<Borrower[]>("/borrowers/") });
}

/** Los préstamos muestran el nombre del deudor, así que también se refrescan. */
function useBorrowerMutation<TInput, TResult>(send: (input: TInput) => Promise<TResult>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () =>
      Promise.all([["borrowers"], ["loans"]].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}

export function useCreateBorrower() {
  return useBorrowerMutation((body: BorrowerInput) => apiFetch<Borrower>("/borrowers/", { method: "POST", body }));
}

export function useUpdateBorrower(id: number) {
  return useBorrowerMutation((body: BorrowerInput) =>
    apiFetch<Borrower>(`/borrowers/${id}/`, { method: "PATCH", body }),
  );
}

export function useDeleteBorrower() {
  return useBorrowerMutation((id: number) => apiFetch<void>(`/borrowers/${id}/`, { method: "DELETE" }));
}
