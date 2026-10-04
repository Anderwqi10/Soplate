import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { LoanListItem } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import LoansPage from "./LoansPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function loan(overrides: Partial<LoanListItem>): LoanListItem {
  return {
    id: 7, borrower: 1, borrower_name: "Luis Pérez", account: 1, account_name: "Banco", principal: "1000000.00",
    interest_rate: "20.00", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31",
    end_date: "2026-04-30", installment_amount: "400000.00", total_amount: "1200000.00", paid_total: "400000.00",
    outstanding: "800000.00", status: "ACTIVE", days_overdue: 0, next_due_date: "2026-03-31", ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("loans list shows status badge and overdue days", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([loan({ status: "OVERDUE", days_overdue: 5 })]);
  renderWithProviders(<LoansPage />, { route: "/loans" });
  expect(await screen.findByRole("link", { name: "Luis Pérez" })).toHaveAttribute("href", "/loans/7");
  expect(within(screen.getByRole("list")).getByText("Retrasado")).toBeInTheDocument();
  expect(screen.getByText("5 días de atraso")).toBeInTheDocument();
  expect(n(screen.getByTestId("installment-7").textContent)).toBe("$ 400.000");
  expect(n(screen.getByTestId("outstanding-7").textContent)).toBe("$ 800.000");
  expect(screen.getByRole("progressbar", { name: /Pagado/ })).toHaveAttribute("aria-valuenow", "33");
});

test("status tab filters via query", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([]);
  renderWithProviders(<LoansPage />, { route: "/loans" });
  await userEvent.click(await screen.findByRole("link", { name: "Pagado" }));
  expect(client.apiFetch).toHaveBeenLastCalledWith("/loans/", { query: { status: "PAID" } });
  expect(screen.getByRole("link", { name: "Pagado" })).toHaveAttribute("aria-current", "page");
});

test("status from the url is applied on load", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([]);
  renderWithProviders(<LoansPage />, { route: "/loans?status=OVERDUE" });
  await screen.findByText("No hay préstamos retrasados");
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/", { query: { status: "OVERDUE" } });
});

test("empty loans state", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([]);
  renderWithProviders(<LoansPage />, { route: "/loans" });
  expect(await screen.findByText("Aún no tienes préstamos")).toBeInTheDocument();
  const links = screen.getAllByRole("link", { name: "Nuevo préstamo" });
  expect(links[0]).toHaveAttribute("href", "/loans/new");
});
