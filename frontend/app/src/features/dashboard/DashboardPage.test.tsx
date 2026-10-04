import { screen } from "@testing-library/react";
import * as client from "../../api/client";
import type { Dashboard } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import DashboardPage from "./DashboardPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function dashboard(overrides: Partial<Dashboard> = {}): Dashboard {
  return {
    total_balance: "600000.00", outstanding_total: "600000.00", outstanding_principal: "500000.00",
    interest_earned: "100000.00", net_worth: "1200000.00",
    accounts: [{ id: 1, name: "Bancolombia", balance: "600000.00" }],
    loans_by_status: { ACTIVE: 1, OVERDUE: 0, DEFAULTED: 0, PAID: 0 },
    upcoming: [], overdue: [], ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("dashboard shows the four headline numbers", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue(dashboard());
  renderWithProviders(<DashboardPage />);
  expect(n((await screen.findByTestId("total_balance")).textContent)).toBe("$ 600.000");
  expect(n(screen.getByTestId("outstanding_total").textContent)).toBe("$ 600.000");
  expect(n(screen.getByTestId("net_worth").textContent)).toBe("$ 1.200.000");
  expect(n(screen.getByTestId("interest_earned").textContent)).toBe("$ 100.000");
  expect(client.apiFetch).toHaveBeenCalledWith("/reports/dashboard/");
});

test("status counts link to filtered loans", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue(dashboard());
  renderWithProviders(<DashboardPage />);
  expect(await screen.findByRole("link", { name: /Al día/ })).toHaveAttribute("href", "/loans?status=ACTIVE");
  expect(screen.getByRole("link", { name: /Vencido/ })).toHaveAttribute("href", "/loans?status=DEFAULTED");
});

test("upcoming and overdue installments link to their loan", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue(
    dashboard({
      upcoming: [{ loan_id: 7, borrower_name: "Luis Pérez", number: 2, due_date: "2026-03-31", remaining: "400000.00" }],
      overdue: [{ loan_id: 9, borrower_name: "Marta Gómez", number: 1, due_date: "2026-02-28", remaining: "150000.00", days_overdue: 12 }],
    }),
  );
  renderWithProviders(<DashboardPage />);
  expect(await screen.findByRole("link", { name: /Luis Pérez/ })).toHaveAttribute("href", "/loans/7");
  expect(screen.getByRole("link", { name: /Marta Gómez/ })).toHaveAttribute("href", "/loans/9");
  expect(screen.getByText("12 días de atraso")).toBeInTheDocument();
});

test("a new user sees guidance instead of empty lists", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue(
    dashboard({ total_balance: "0.00", outstanding_total: "0.00", net_worth: "0.00", interest_earned: "0.00", accounts: [],
      loans_by_status: { ACTIVE: 0, OVERDUE: 0, DEFAULTED: 0, PAID: 0 } }),
  );
  renderWithProviders(<DashboardPage />);
  expect(await screen.findByRole("link", { name: "Crea tu primera cuenta" })).toHaveAttribute("href", "/accounts");
  expect(screen.getByText("No hay cuotas en los próximos 7 días.")).toBeInTheDocument();
  expect(screen.getByText("No hay cuotas vencidas.")).toBeInTheDocument();
});
