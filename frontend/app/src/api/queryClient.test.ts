import { ApiError } from "./client";
import { shouldRetry } from "./queryClient";

test("network failures are retried once", () => {
  expect(shouldRetry(0, new TypeError("Failed to fetch"))).toBe(true);
  expect(shouldRetry(1, new TypeError("Failed to fetch"))).toBe(false);
});

test("answers from the backend (400, 404) are not retried", () => {
  expect(shouldRetry(0, new ApiError(404, { detail: "No encontrado." }))).toBe(false);
  expect(shouldRetry(0, new ApiError(400, { detail: "Saldo insuficiente" }))).toBe(false);
});
