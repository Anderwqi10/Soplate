import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { Account } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import AccountsPage from "./AccountsPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function account(overrides: Partial<Account>): Account {
  return {
    id: 1, name: "Banco", kind: "BANK", initial_balance: "0.00", is_active: true, balance: "0.00",
    created_at: "2026-01-01T00:00:00Z", ...overrides,
  };
}

function mockApi(accounts: Account[], totalBalance = "0.00") {
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/accounts/") return accounts;
    if (path === "/reports/dashboard/") return { total_balance: totalBalance };
    throw new Error(`ruta inesperada ${path}`);
  });
}

// Con llaves: si beforeEach devuelve algo, Vitest lo ejecuta como limpieza al final del test.
beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("lists accounts with formatted balance and total", async () => {
  mockApi(
    [account({ id: 1, name: "Bancolombia", balance: "1500000.00" }), account({ id: 2, name: "Caja menor", kind: "CASH", balance: "500000.00" })],
    "2000000.00",
  );
  renderWithProviders(<AccountsPage />);
  expect(await screen.findByText("Bancolombia")).toBeInTheDocument();
  expect(screen.getByText("Caja menor")).toBeInTheDocument();
  expect(n(screen.getByTestId("balance-1").textContent)).toBe("$ 1.500.000");
  expect(n((await screen.findByTestId("total-balance")).textContent)).toBe("$ 2.000.000");
});

test("archived accounts are listed apart", async () => {
  mockApi([account({ id: 1, name: "Banco" }), account({ id: 2, name: "Caja vieja", is_active: false })]);
  renderWithProviders(<AccountsPage />);
  expect(await screen.findByRole("heading", { name: "Archivadas" })).toBeInTheDocument();
  expect(screen.getByText("Caja vieja")).toBeInTheDocument();
});

test("empty state invites to create first account", async () => {
  mockApi([]);
  renderWithProviders(<AccountsPage />);
  expect(await screen.findByText("Aún no tienes cuentas")).toBeInTheDocument();
  await userEvent.click(screen.getAllByRole("button", { name: "Nueva cuenta" })[0]);
  expect(screen.getByLabelText("Nombre")).toBeInTheDocument();
});

test("new account form posts the typed values", async () => {
  mockApi([]);
  renderWithProviders(<AccountsPage />);
  await userEvent.click((await screen.findAllByRole("button", { name: "Nueva cuenta" }))[0]);
  await userEvent.type(screen.getByLabelText("Nombre"), "Nequi");
  await userEvent.selectOptions(screen.getByLabelText("Tipo"), "WALLET");
  await userEvent.type(screen.getByLabelText("Saldo inicial"), "250000");
  vi.mocked(client.apiFetch).mockResolvedValueOnce(account({ id: 9, name: "Nequi" }));
  await userEvent.click(screen.getByRole("button", { name: "Crear cuenta" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/accounts/", {
    method: "POST",
    body: { name: "Nequi", kind: "WALLET", initial_balance: "250000" },
  });
});

test("switching forms moves focus into the new form", async () => {
  mockApi([account({ id: 1, name: "Bancolombia" })]);
  renderWithProviders(<AccountsPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Movimiento" }));
  await userEvent.click(screen.getByRole("button", { name: "Transferir" }));
  expect(screen.getByLabelText("Desde")).toHaveFocus();
});
