import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { Account, AccountInput, Transaction, TransactionInput, TransferInput } from "../../api/types";
import { useMoneyMutation } from "../../api/useMoneyMutation";

export interface TransactionFilters {
  account?: number;
  kind?: string;
  date_from?: string;
  date_to?: string;
}

export function useAccounts() {
  return useQuery({ queryKey: ["accounts"], queryFn: () => apiFetch<Account[]>("/accounts/") });
}

export function useAccount(id: number) {
  return useQuery({ queryKey: ["accounts", id], queryFn: () => apiFetch<Account>(`/accounts/${id}/`) });
}

export function useTransactions(filters: TransactionFilters) {
  return useQuery({
    queryKey: ["transactions", filters],
    queryFn: () => apiFetch<Transaction[]>("/transactions/", { query: { ...filters } }),
  });
}

export function useCreateAccount() {
  return useMoneyMutation((body: AccountInput) => apiFetch<Account>("/accounts/", { method: "POST", body }));
}

export function useUpdateAccount(id: number) {
  return useMoneyMutation((body: Partial<AccountInput>) =>
    apiFetch<Account>(`/accounts/${id}/`, { method: "PATCH", body }),
  );
}

export function useCreateTransaction() {
  return useMoneyMutation((body: TransactionInput) =>
    apiFetch<Transaction>("/transactions/", { method: "POST", body }),
  );
}

export function useCreateTransfer() {
  return useMoneyMutation((body: TransferInput) =>
    apiFetch<{ outgoing: Transaction; incoming: Transaction }>("/transfers/", { method: "POST", body }),
  );
}
