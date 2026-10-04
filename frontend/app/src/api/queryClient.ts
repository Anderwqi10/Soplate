import { QueryClient } from "@tanstack/react-query";
import { ApiError } from "./client";

/** Una respuesta del backend (400, 404…) no cambia reintentando; una falla de red sí puede, una vez. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  return !(error instanceof ApiError) && failureCount < 1;
}

export function createQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: shouldRetry, staleTime: 30_000 } } });
}
