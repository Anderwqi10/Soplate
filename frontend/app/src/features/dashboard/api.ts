import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../../api/client";
import type { Dashboard } from "../../api/types";

export function useDashboard() {
  return useQuery({ queryKey: ["dashboard"], queryFn: () => apiFetch<Dashboard>("/reports/dashboard/") });
}
