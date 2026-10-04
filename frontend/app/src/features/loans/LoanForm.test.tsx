import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import * as client from "../../api/client";
import type { Account, Borrower, LoanPreview } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import LoanForm from "./LoanForm";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

const accounts: Account[] = [
  { id: 1, name: "Bancolombia", kind: "BANK", initial_balance: "0.00", is_active: true, balance: "2000000.00", created_at: "" },
];
const borrowers: Borrower[] = [
  { id: 4, full_name: "Luis Pérez", document_id: "", phone: "", address: "", notes: "", created_at: "" },
];
const preview: LoanPreview = {
  installment_amount: "400000.00", total_amount: "1200000.00", end_date: "2026-04-30", interest_total: "200000.00",
  installments: [
    { number: 1, due_date: "2026-02-28", principal_amount: "333333.33", interest_amount: "66666.67", amount: "400000.00" },
    { number: 2, due_date: "2026-03-31", principal_amount: "333333.33", interest_amount: "66666.67", amount: "400000.00" },
    { number: 3, due_date: "2026-04-30", principal_amount: "333333.34", interest_amount: "66666.66", amount: "400000.00" },
  ],
};

function mockApi({ accs = accounts, bors = borrowers, create }: { accs?: Account[]; bors?: Borrower[]; create?: () => unknown } = {}) {
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/accounts/") return accs;
    if (path === "/borrowers/") return bors;
    if (path === "/loans/preview/") return preview;
    if (path === "/loans/") return create ? create() : { id: 7 };
    throw new Error(`ruta inesperada ${path}`);
  });
}

function renderForm() {
  return renderWithProviders(
    <Routes>
      <Route path="/loans/new" element={<LoanForm />} />
      <Route path="/loans/:id" element={<h1>Detalle del préstamo</h1>} />
    </Routes>,
    { route: "/loans/new" },
  );
}

async function fillForm() {
  await screen.findAllByRole("option", { name: /Luis Pérez/ });
  await userEvent.selectOptions(screen.getByLabelText("Deudor"), "4");
  await userEvent.selectOptions(screen.getByLabelText("Cuenta de origen"), "1");
  await userEvent.type(screen.getByLabelText("Capital prestado"), "1000000");
  await userEvent.type(screen.getByLabelText("Tasa de interés (%)"), "20");
  await userEvent.clear(screen.getByLabelText("Número de cuotas"));
  await userEvent.type(screen.getByLabelText("Número de cuotas"), "3");
  await userEvent.selectOptions(screen.getByLabelText("Frecuencia"), "MONTHLY");
  await userEvent.clear(screen.getByLabelText("Fecha de inicio"));
  await userEvent.type(screen.getByLabelText("Fecha de inicio"), "2026-01-31");
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("shows schedule preview before creating", async () => {
  mockApi();
  renderForm();
  await fillForm();
  const summary = await screen.findByRole("region", { name: "Vista previa" });
  expect(n(within(summary).getByTestId("preview-installment").textContent)).toBe("$ 400.000");
  expect(n(within(summary).getByTestId("preview-total").textContent)).toBe("$ 1.200.000");
  expect(within(summary).getAllByRole("row")).toHaveLength(4); // encabezado + 3 cuotas
  expect(client.apiFetch).toHaveBeenLastCalledWith("/loans/preview/", {
    method: "POST",
    body: { principal: "1000000", interest_rate: "20", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31" },
  });
});

test("creates the loan and opens its detail", async () => {
  mockApi();
  renderForm();
  await fillForm();
  await screen.findByRole("region", { name: "Vista previa" });
  await userEvent.click(screen.getByRole("button", { name: "Crear préstamo" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/", {
    method: "POST",
    body: {
      borrower: 4, account: 1, principal: "1000000", interest_rate: "20", interest_mode: "TOTAL",
      installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31", notes: "",
    },
  });
  expect(await screen.findByRole("heading", { name: "Detalle del préstamo" })).toBeInTheDocument();
});

test("create loan error keeps values", async () => {
  mockApi({ create: () => Promise.reject(new client.ApiError(400, { detail: "Saldo insuficiente en la cuenta" })) });
  renderForm();
  await fillForm();
  await userEvent.click(screen.getByRole("button", { name: "Crear préstamo" }));
  expect(await screen.findByText("Saldo insuficiente en la cuenta")).toBeInTheDocument();
  expect(screen.getByLabelText("Capital prestado")).toHaveValue("1000000");
});

test("asks to create an account first", async () => {
  mockApi({ accs: [] });
  renderForm();
  expect(await screen.findByText("Primero crea una cuenta")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a Cuentas" })).toHaveAttribute("href", "/accounts");
});

test("asks to create a borrower first", async () => {
  mockApi({ bors: [] });
  renderForm();
  expect(await screen.findByText("Primero registra un deudor")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "Ir a Deudores" })).toHaveAttribute("href", "/borrowers");
});

test("amounts typed with thousands dots are understood", async () => {
  mockApi();
  renderForm();
  await screen.findAllByRole("option", { name: /Luis Pérez/ });
  await userEvent.selectOptions(screen.getByLabelText("Deudor"), "4");
  await userEvent.selectOptions(screen.getByLabelText("Cuenta de origen"), "1");
  await userEvent.type(screen.getByLabelText("Capital prestado"), "1.000.000");
  await userEvent.type(screen.getByLabelText("Tasa de interés (%)"), "20");
  await userEvent.type(screen.getByLabelText("Número de cuotas"), "3");
  await screen.findByRole("region", { name: "Vista previa" });
  expect(client.apiFetch).toHaveBeenLastCalledWith("/loans/preview/", expect.objectContaining({
    body: expect.objectContaining({ principal: "1000000" }),
  }));
});

test("an invalid amount is explained instead of ignored", async () => {
  mockApi();
  renderForm();
  await screen.findAllByRole("option", { name: /Luis Pérez/ });
  await userEvent.selectOptions(screen.getByLabelText("Deudor"), "4");
  await userEvent.selectOptions(screen.getByLabelText("Cuenta de origen"), "1");
  await userEvent.type(screen.getByLabelText("Capital prestado"), "un millón");
  await userEvent.type(screen.getByLabelText("Tasa de interés (%)"), "20");
  await userEvent.type(screen.getByLabelText("Número de cuotas"), "3");
  await userEvent.click(screen.getByRole("button", { name: "Crear préstamo" }));
  expect(await screen.findByText(/El capital no es un monto válido/)).toBeInTheDocument();
  expect(client.apiFetch).not.toHaveBeenCalledWith("/loans/", expect.anything());
});
