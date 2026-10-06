import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import * as client from "../../api/client";
import type { Account } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import AccountDetailPage from "./AccountDetailPage";
import AccountsPage from "./AccountsPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

function account(balance: string): Account {
  return { id: 3, name: "Nequi", kind: "WALLET", initial_balance: "0.00", is_active: true, balance, created_at: "" };
}

function setup(balance: string) {
  vi.mocked(client.apiFetch).mockImplementation(async (path: string) => {
    if (path === "/accounts/3/") return account(balance);
    if (path === "/transactions/") return [];
    if (path === "/accounts/") return [];
    if (path === "/reports/dashboard/") return { total_balance: "0.00" };
    throw new Error(`ruta inesperada ${path}`);
  });
  renderWithProviders(
    <Routes>
      <Route path="/accounts/:id" element={<AccountDetailPage />} />
      <Route path="/accounts" element={<AccountsPage />} />
    </Routes>,
    { route: "/accounts/3" },
  );
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("an account with money cannot be deleted from the screen", async () => {
  setup("150000.00");
  await screen.findByRole("heading", { name: "Nequi" });
  expect(screen.queryByRole("button", { name: "Eliminar cuenta" })).not.toBeInTheDocument();
});

test("an empty account can be deleted after confirming", async () => {
  setup("0.00");
  await userEvent.click(await screen.findByRole("button", { name: "Eliminar cuenta" }));
  expect(screen.getByRole("alertdialog")).toHaveTextContent("Nequi");
  await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar cuenta" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/accounts/3/", { method: "DELETE" });
  expect(await screen.findByRole("status")).toHaveTextContent("La cuenta Nequi se eliminó.");
});
