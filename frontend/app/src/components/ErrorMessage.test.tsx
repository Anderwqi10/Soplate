import { render, screen } from "@testing-library/react";
import { ApiError } from "../api/client";
import ErrorMessage from "./ErrorMessage";

test("network failure says the server cannot be reached", () => {
  render(<ErrorMessage error={new TypeError("Failed to fetch")} />);
  expect(screen.getByRole("alert")).toHaveTextContent("No se pudo conectar con el servidor");
});

test("other unexpected errors do not blame the connection", () => {
  render(<ErrorMessage error={new Error("boom")} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Algo salió mal");
  expect(screen.getByRole("alert")).not.toHaveTextContent("conectar");
});

test("backend detail is shown as is", () => {
  render(<ErrorMessage error={new ApiError(400, { detail: "Saldo insuficiente en la cuenta" })} />);
  expect(screen.getByRole("alert")).toHaveTextContent("Saldo insuficiente en la cuenta");
});
