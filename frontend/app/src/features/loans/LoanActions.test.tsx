import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import * as client from "../../api/client";
import type { Account, LoanDetail, LoanStatus } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import LoansPage from "./LoansPage";
import LoanActions from "./LoanActions";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

const accounts: Account[] = [
  { id: 1, name: "Bancolombia", kind: "BANK", initial_balance: "0.00", is_active: true, balance: "400000.00", created_at: "" },
];

function loan(status: LoanStatus, outstanding = "800000.00"): LoanDetail {
  return {
    id: 7, borrower: 4, borrower_name: "Luis Pérez", account: 1, account_name: "Bancolombia", principal: "1000000.00",
    interest_rate: "20.00", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31",
    end_date: "2026-04-30", installment_amount: "400000.00", total_amount: "1200000.00", paid_total: "400000.00",
    outstanding, status, days_overdue: 0, next_due_date: null, interest_total: "200000.00",
    outstanding_principal: "666666.67", notes: "", installments: [], payments: [],
  };
}

function setup(status: LoanStatus, outstanding?: string) {
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/accounts/") return accounts;
    if (path === "/loans/") return [];
    return { id: 7, close_reason: "X", written_off_amount: null };
  });
  renderWithProviders(
    <Routes>
      <Route path="/loans/7" element={<LoanActions loan={loan(status, outstanding)} />} />
      <Route path="/loans" element={<LoansPage />} />
    </Routes>,
    { route: "/loans/7" },
  );
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("a loan on time can only be settled", () => {
  setup("ACTIVE");
  expect(screen.getByRole("button", { name: "Liquidar préstamo" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Reportar como pérdida" })).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Eliminar préstamo" })).not.toBeInTheDocument();
});

test("an overdue loan offers both settling and reporting a loss", () => {
  setup("OVERDUE");
  expect(screen.getByRole("button", { name: "Liquidar préstamo" })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Reportar como pérdida" })).toBeInTheDocument();
});

test("a defaulted loan can only be reported as a loss", () => {
  setup("DEFAULTED");
  expect(screen.getByRole("button", { name: "Reportar como pérdida" })).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Liquidar préstamo" })).not.toBeInTheDocument();
});

test("settling asks for confirmation with the real amount, then leaves the loan", async () => {
  setup("ACTIVE");
  await userEvent.click(screen.getByRole("button", { name: "Liquidar préstamo" }));
  const confirm = await screen.findByRole("alertdialog");
  expect(n(confirm.textContent)).toContain("$ 800.000");
  await screen.findAllByRole("option", { name: /Bancolombia/ });
  expect(client.apiFetch).not.toHaveBeenCalledWith("/loans/7/settle/", expect.anything());
  await userEvent.click(screen.getByRole("button", { name: "Sí, liquidar" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/settle/", { method: "POST", body: { account: 1 } });
  expect(await screen.findByRole("status")).toHaveTextContent("El préstamo de Luis Pérez se liquidó.");
});

test("reporting a loss explains the amount and posts", async () => {
  setup("DEFAULTED");
  await userEvent.click(screen.getByRole("button", { name: "Reportar como pérdida" }));
  expect(n(screen.getByRole("alertdialog").textContent)).toContain("$ 800.000 quedarán como pérdida");
  await userEvent.click(screen.getByRole("button", { name: "Sí, reportar pérdida" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/write-off/", { method: "POST" });
});

test("a paid loan can be deleted after confirming", async () => {
  setup("PAID", "0.00");
  await userEvent.click(screen.getByRole("button", { name: "Eliminar préstamo" }));
  await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/", { method: "DELETE" });
});

test("cancelling does nothing", async () => {
  setup("PAID", "0.00");
  await userEvent.click(screen.getByRole("button", { name: "Eliminar préstamo" }));
  await userEvent.click(screen.getByRole("button", { name: "No, volver" }));
  expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
  expect(client.apiFetch).not.toHaveBeenCalledWith("/loans/7/", expect.anything());
});

test("a backend refusal is shown and nothing changes", async () => {
  setup("PAID", "0.00");
  await userEvent.click(screen.getByRole("button", { name: "Eliminar préstamo" }));
  vi.mocked(client.apiFetch).mockRejectedValueOnce(new client.ApiError(400, { detail: "Solo se puede eliminar un préstamo pagado." }));
  await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
  expect(await screen.findByText("Solo se puede eliminar un préstamo pagado.")).toBeInTheDocument();
});
