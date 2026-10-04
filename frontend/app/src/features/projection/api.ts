import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { ISODate, Projection } from "../../api/types";

/** `date` vacío = no consultar todavía. */
export function useProjection(date: ISODate | "", includeOverdue: boolean) {
  return useQuery({
    queryKey: ["projection", date, includeOverdue],
    queryFn: () =>
      apiFetch<Projection>("/reports/projection/", { query: { date, include_overdue: includeOverdue } }),
    enabled: date !== "",
  });
}
