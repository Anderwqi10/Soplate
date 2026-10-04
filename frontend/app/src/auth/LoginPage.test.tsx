import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router";
import * as client from "../api/client";
import { renderWithProviders } from "../test/render";
import LoginPage from "./LoginPage";

vi.mock("../api/client", async (importOriginal) => {
  const real = await importOriginal<typeof client>();
  return { ...real, login: vi.fn() };
});

function renderLogin() {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<h1>Dashboard</h1>} />
    </Routes>,
    { route: "/login" },
  );
}

beforeEach(() => {
  vi.mocked(client.login).mockReset();
});

test("submits credentials and goes to dashboard", async () => {
  vi.mocked(client.login).mockResolvedValueOnce(undefined);
  renderLogin();
  await userEvent.type(screen.getByLabelText("Usuario"), "ana");
  await userEvent.type(screen.getByLabelText("Contraseña"), "clave");
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  expect(client.login).toHaveBeenCalledWith("ana", "clave");
  expect(await screen.findByRole("heading", { name: "Dashboard" })).toBeInTheDocument();
});

test("shows error on bad credentials", async () => {
  vi.mocked(client.login).mockRejectedValueOnce(new client.ApiError(401, { detail: "Usuario o contraseña incorrectos" }));
  renderLogin();
  await userEvent.type(screen.getByLabelText("Usuario"), "ana");
  await userEvent.type(screen.getByLabelText("Contraseña"), "mala");
  await userEvent.click(screen.getByRole("button", { name: "Ingresar" }));
  expect(await screen.findByText("Usuario o contraseña incorrectos")).toBeInTheDocument();
  expect(screen.getByLabelText("Usuario")).toHaveValue("ana");
});
