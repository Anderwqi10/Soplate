import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import * as client from "../../api/client";
import type { Account, LoanDetail } from "../../api/types";
import { todayISO } from "../../lib/format";
import { renderWithProviders } from "../../test/render";
import LoanDetailPage from "./LoanDetailPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const accounts: Account[] = [
  { id: 1, name: "Bancolombia", kind: "BANK", initial_balance: "0.00", is_active: true, balance: "400000.00", created_at: "" },
];

function detail(overrides: Partial<LoanDetail> = {}): LoanDetail {
  return {
    id: 7, borrower: 4, borrower_name: "Luis Pérez", account: 1, account_name: "Bancolombia", principal: "1000000.00",
    interest_rate: "20.00", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31",
    end_date: "2026-04-30", installment_amount: "400000.00", total_amount: "1200000.00", paid_total: "400000.00",
    outstanding: "800000.00", status: "ACTIVE", days_overdue: 0, next_due_date: "2026-03-31",
    interest_total: "200000.00", outstanding_principal: "666666.67", notes: "",
    installments: [
      { number: 1, due_date: "2026-02-28", amount: "400000.00", principal_amount: "333333.33", interest_amount: "66666.67", paid_amount: "400000.00", remaining: "0.00", status: "PAID" },
      { number: 2, due_date: "2026-03-31", amount: "400000.00", principal_amount: "333333.33", interest_amount: "66666.67", paid_amount: "0.00", remaining: "400000.00", status: "PENDING" },
      { number: 3, due_date: "2026-04-30", amount: "400000.00", principal_amount: "333333.34", interest_amount: "66666.66", paid_amount: "0.00", remaining: "400000.00", status: "PENDING" },
    ],
    payments: [{ id: 1, amount: "400000.00", date: "2026-02-28", account: 1, account_name: "Bancolombia", note: "" }],
    ...overrides,
  };
}

function mockApi(loan: LoanDetail) {
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/loans/7/") return loan;
    if (path === "/accounts/") return accounts;
    if (path === "/loans/7/payments/") return loan;
    throw new Error(`ruta inesperada ${path}`);
  });
}

function renderDetail() {
  return renderWithProviders(
    <Routes>
      <Route path="/loans/:id" element={<LoanDetailPage />} />
    </Routes>,
    { route: "/loans/7" },
  );
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("detail renders the cobro card, installments and pays next installment", async () => {
  mockApi(detail());
  renderDetail();
  expect(await screen.findByRole("heading", { name: "Luis Pérez" })).toBeInTheDocument();
  const card = screen.getByRole("list", { name: "Tarjeta de cobro" });
  expect(within(card).getAllByRole("listitem")).toHaveLength(3);
  expect(within(screen.getByRole("table", { name: "Cuotas" })).getAllByRole("row")).toHaveLength(4);

  await screen.findAllByRole("option", { name: /Bancolombia/ });
  await userEvent.click(screen.getByRole("button", { name: "Cuota" }));
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 400.000");
  await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/payments/", {
    method: "POST",
    body: { amount: "400000", date: todayISO(), account: 1, note: "" },
  });
});

test("total button fills the outstanding amount", async () => {
  mockApi(detail());
  renderDetail();
  await userEvent.click(await screen.findByRole("button", { name: "Total" }));
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 800.000");
});

test("payment error keeps the typed amount", async () => {
  mockApi(detail());
  renderDetail();
  await screen.findAllByRole("option", { name: /Bancolombia/ });
  await userEvent.type(screen.getByLabelText("Monto"), "900000");
  vi.mocked(client.apiFetch).mockRejectedValueOnce(new client.ApiError(400, { detail: "El pago supera el saldo pendiente" }));
  await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
  expect(await screen.findByText("El pago supera el saldo pendiente")).toBeInTheDocument();
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 900.000");
});

test("payment form hidden when loan is paid", async () => {
  mockApi(detail({ status: "PAID", outstanding: "0.00", next_due_date: null }));
  renderDetail();
  expect(await screen.findByText("Este préstamo ya está pagado.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: "Registrar pago" })).not.toBeInTheDocument();
});

test("if the loan's account was archived, the payment form makes you choose another", async () => {
  const archived: Account = { ...accounts[0], id: 5, name: "Nequi vieja", is_active: false };
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/loans/7/") return detail({ account: 5, account_name: "Nequi vieja" });
    if (path === "/accounts/") return [...accounts, archived];
    if (path === "/loans/7/payments/") return detail();
    throw new Error(`ruta inesperada ${path}`);
  });
  renderDetail();
  await screen.findAllByRole("option", { name: /Bancolombia/ });
  expect(screen.getByLabelText("Cuenta donde entra")).toHaveValue("");
  await userEvent.selectOptions(screen.getByLabelText("Cuenta donde entra"), "1");
  await userEvent.click(screen.getByRole("button", { name: "Cuota" }));
  await userEvent.click(screen.getByRole("button", { name: "Registrar pago" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/payments/", {
    method: "POST",
    body: { amount: "400000", date: todayISO(), account: 1, note: "" },
  });
});
