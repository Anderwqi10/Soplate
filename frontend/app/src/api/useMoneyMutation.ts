import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

// Lo que cambia cuando se mueve dinero: saldos, historial, resumen y proyección.
const MONEY_KEYS: QueryKey[] = [["accounts"], ["transactions"], ["dashboard"], ["projection"]];

/** Mutación que, al tener éxito, marca como desactualizado todo lo que depende del dinero. */
export function useMoneyMutation<TInput, TResult>(send: (input: TInput) => Promise<TResult>, extraKeys: QueryKey[] = []) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () =>
      Promise.all([...MONEY_KEYS, ...extraKeys].map((queryKey) => queryClient.invalidateQueries({ queryKey }))),
  });
}
