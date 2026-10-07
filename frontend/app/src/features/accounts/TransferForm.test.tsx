import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { Account } from "../../api/types";
import { todayISO } from "../../lib/format";
import { renderWithProviders } from "../../test/render";
import TransactionForm from "./TransactionForm";
import TransferForm from "./TransferForm";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const accounts: Account[] = [
  { id: 1, name: "Banco", kind: "BANK", initial_balance: "0.00", is_active: true, balance: "900000.00", created_at: "" },
  { id: 2, name: "Nequi", kind: "WALLET", initial_balance: "0.00", is_active: true, balance: "0.00", created_at: "" },
  { id: 3, name: "Vieja", kind: "CASH", initial_balance: "0.00", is_active: false, balance: "0.00", created_at: "" },
];

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/accounts/") return accounts;
    throw new Error(`ruta inesperada ${path}`);
  });
});

test("transfer form posts strings and shows backend error", async () => {
  const onDone = vi.fn();
  renderWithProviders(<TransferForm onDone={onDone} />);
  await screen.findAllByRole("option", { name: /Banco/ }); // espera a que carguen las cuentas
  await userEvent.selectOptions(screen.getByLabelText("Desde"), "1");
  await userEvent.selectOptions(screen.getByLabelText("Hacia"), "2");
  await userEvent.type(screen.getByLabelText("Monto"), "300000");

  vi.mocked(client.apiFetch).mockRejectedValueOnce(new client.ApiError(400, { detail: "No puedes transferir a la misma cuenta." }));
  await userEvent.click(screen.getByRole("button", { name: "Transferir" }));

  expect(client.apiFetch).toHaveBeenCalledWith("/transfers/", {
    method: "POST",
    body: { from_account: 1, to_account: 2, amount: "300000", date: todayISO(), description: "" },
  });
  expect(await screen.findByText("No puedes transferir a la misma cuenta.")).toBeInTheDocument();
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 300.000");
  expect(onDone).not.toHaveBeenCalled();
});

test("archived accounts are not offered", async () => {
  renderWithProviders(<TransferForm onDone={() => {}} />);
  await screen.findAllByRole("option", { name: /Banco/ });
  const from = screen.getByLabelText("Desde");
  expect(Array.from((from as HTMLSelectElement).options).map((o) => o.textContent)).not.toContain("Vieja");
});

test("transaction form offers only manual kinds and posts", async () => {
  const onDone = vi.fn();
  renderWithProviders(<TransactionForm onDone={onDone} defaultAccount={1} />);
  await screen.findAllByRole("option", { name: /Banco/ });
  const kind = screen.getByLabelText("Tipo");
  expect(Array.from((kind as HTMLSelectElement).options).map((o) => o.value)).toEqual(["DEPOSIT", "WITHDRAWAL", "INCOME", "EXPENSE"]);
  await userEvent.selectOptions(kind, "EXPENSE");
  await userEvent.type(screen.getByLabelText("Monto"), "45000");
  await userEvent.type(screen.getByLabelText("Descripción"), "Gasolina");
  vi.mocked(client.apiFetch).mockResolvedValueOnce({});
  await userEvent.click(screen.getByRole("button", { name: "Registrar movimiento" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/transactions/", {
    method: "POST",
    body: { account: 1, kind: "EXPENSE", amount: "45000", date: todayISO(), description: "Gasolina" },
  });
  expect(onDone).toHaveBeenCalled();
});
