import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { LoanDetail, LoanPreview } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import LoanTermsEditor from "./LoanTermsEditor";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

const loan: LoanDetail = {
  id: 7, borrower: 4, borrower_name: "Luis Pérez", account: 1, account_name: "Bancolombia", principal: "1000000.00",
  interest_rate: "20.00", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31",
  end_date: "2026-04-30", installment_amount: "400000.00", total_amount: "1200000.00", paid_total: "400000.00",
  outstanding: "800000.00", status: "ACTIVE", days_overdue: 0, next_due_date: "2026-03-31", interest_total: "200000.00",
  outstanding_principal: "666666.67", notes: "", installments: [], payments: [],
};

const preview: LoanPreview = {
  installment_amount: "416666.67", total_amount: "1250000.00", end_date: "2026-04-30", interest_total: "250000.00",
  installments: [],
};

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/loans/preview/") return preview;
    if (path === "/loans/7/terms/") return loan;
    throw new Error(`ruta inesperada ${path}`);
  });
});

async function openAndSetRate(rate: string) {
  renderWithProviders(<LoanTermsEditor loan={loan} />);
  await userEvent.click(screen.getByRole("button", { name: "Editar condiciones" }));
  const input = screen.getByLabelText("Tasa de interés (%)");
  await userEvent.clear(input);
  await userEvent.type(input, rate);
  await userEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
}

test("shows before and after, and only saves after the security question", async () => {
  await openAndSetRate("25");
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/preview/", {
    method: "POST",
    body: { principal: "1000000.00", interest_rate: "25", interest_mode: "TOTAL", installments_count: 3, frequency: "MONTHLY", start_date: "2026-01-31" },
  });
  const question = await screen.findByRole("alertdialog", { name: /Cambiar las condiciones/ });
  const text = n(question.textContent);
  expect(text).toContain("20 % → 25 %");
  expect(text).toContain("$ 400.000 → $ 416.666,67");
  expect(text).toContain("$ 1.200.000 → $ 1.250.000");
  expect(client.apiFetch).not.toHaveBeenCalledWith("/loans/7/terms/", expect.anything());

  await userEvent.click(screen.getByRole("button", { name: "Sí, cambiar condiciones" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/terms/", { method: "PATCH", body: { interest_rate: "25" } });
  expect(await screen.findByRole("status")).toHaveTextContent("Condiciones actualizadas.");
});

test("changing only the start date sends only the date", async () => {
  renderWithProviders(<LoanTermsEditor loan={loan} />);
  await userEvent.click(screen.getByRole("button", { name: "Editar condiciones" }));
  fireEvent.change(screen.getByLabelText("Fecha de inicio"), { target: { value: "2026-02-15" } });
  await userEvent.click(screen.getByRole("button", { name: "Revisar cambios" }));
  expect(n((await screen.findByRole("alertdialog")).textContent)).toContain("31 de ene de 2026 → 15 de feb de 2026");
  await userEvent.click(screen.getByRole("button", { name: "Sí, cambiar condiciones" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/loans/7/terms/", { method: "PATCH", body: { start_date: "2026-02-15" } });
});

test("saying no changes nothing", async () => {
  await openAndSetRate("25");
  await userEvent.click(await screen.findByRole("button", { name: "No, volver" }));
  expect(client.apiFetch).not.toHaveBeenCalledWith("/loans/7/terms/", expect.anything());
});

test("without changes there is nothing to confirm", async () => {
  await openAndSetRate("20");
  expect(screen.getByText("No cambiaste la tasa ni la fecha.")).toBeInTheDocument();
  expect(client.apiFetch).not.toHaveBeenCalled();
});

test("a backend refusal is explained", async () => {
  await openAndSetRate("25");
  vi.mocked(client.apiFetch).mockRejectedValueOnce(new client.ApiError(400, { detail: "Hay pagos registrados antes de la nueva fecha de inicio." }));
  await userEvent.click(await screen.findByRole("button", { name: "Sí, cambiar condiciones" }));
  expect(await screen.findByText("Hay pagos registrados antes de la nueva fecha de inicio.")).toBeInTheDocument();
});
