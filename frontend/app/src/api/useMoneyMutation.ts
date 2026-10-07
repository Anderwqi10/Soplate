import { useMutation, useQueryClient, type QueryKey } from "@tanstack/react-query";

// Lo que cambia cuando se mueve dinero: saldos, historial, resumen, proyección y perfiles de deudores.
const MONEY_KEYS: QueryKey[] = [["accounts"], ["transactions"], ["dashboard"], ["projection"], ["borrowers"]];

/**
 * Mutación que, al tener éxito, marca como desactualizado todo lo que depende del dinero.
 * `waitForRefresh: false` sirve cuando la pantalla actual desaparece (cerrar o eliminar):
 * se navega de inmediato en vez de esperar a que se recargue una página que ya no existe.
 */
export function useMoneyMutation<TInput, TResult>(
  send: (input: TInput) => Promise<TResult>,
  extraKeys: QueryKey[] = [],
  { waitForRefresh = true }: { waitForRefresh?: boolean } = {},
) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: send,
    onSuccess: () => {
      const refresh = Promise.all(
        [...MONEY_KEYS, ...extraKeys].map((queryKey) => queryClient.invalidateQueries({ queryKey })),
      );
      return waitForRefresh ? refresh : undefined;
    },
  });
}
