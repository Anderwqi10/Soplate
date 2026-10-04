import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { Borrower } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import BorrowersPage from "./BorrowersPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const luis: Borrower = {
  id: 1, full_name: "Luis Pérez", document_id: "1020", phone: "3001234567", address: "", notes: "", created_at: "",
};

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("lists borrowers", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([luis]);
  renderWithProviders(<BorrowersPage />);
  expect(await screen.findByText("Luis Pérez")).toBeInTheDocument();
  expect(screen.getByText("Doc. 1020, 3001234567")).toBeInTheDocument();
});

test("empty state invites to add the first borrower", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([]);
  renderWithProviders(<BorrowersPage />);
  expect(await screen.findByText("Aún no tienes deudores")).toBeInTheDocument();
});

test("creates a borrower with the typed data", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([]);
  renderWithProviders(<BorrowersPage />);
  await userEvent.click((await screen.findAllByRole("button", { name: "Nuevo deudor" }))[0]);
  await userEvent.type(screen.getByLabelText("Nombre completo"), "Marta Gómez");
  await userEvent.type(screen.getByLabelText("Teléfono"), "3110000000");
  vi.mocked(client.apiFetch).mockResolvedValueOnce({ ...luis, id: 2, full_name: "Marta Gómez" });
  await userEvent.click(screen.getByRole("button", { name: "Guardar deudor" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/borrowers/", {
    method: "POST",
    body: { full_name: "Marta Gómez", document_id: "", phone: "3110000000", address: "", notes: "" },
  });
});

test("borrower delete error is shown", async () => {
  vi.mocked(client.apiFetch).mockResolvedValue([luis]);
  renderWithProviders(<BorrowersPage />);
  await userEvent.click(await screen.findByRole("button", { name: "Eliminar a Luis Pérez" }));
  vi.mocked(client.apiFetch).mockRejectedValueOnce(
    new client.ApiError(400, { detail: "No se puede eliminar: tiene movimientos o registros asociados." }),
  );
  await userEvent.click(screen.getByRole("button", { name: "Sí, eliminar" }));
  expect(client.apiFetch).toHaveBeenCalledWith("/borrowers/1/", { method: "DELETE" });
  expect(await screen.findByText("No se puede eliminar: tiene movimientos o registros asociados.")).toBeInTheDocument();
  expect(screen.getByText("Luis Pérez")).toBeInTheDocument();
});
