import { formatDate, formatMoney } from "./format";

// Intl usa espacios especiales (no separables); se normalizan para comparar.
const n = (s: string) => s.replace(/\s/g, " ");

test("formatMoney shows pesos without empty cents", () => {
  expect(n(formatMoney("1200000.00"))).toBe("$ 1.200.000");
  expect(n(formatMoney("33.33"))).toBe("$ 33,33");
  expect(n(formatMoney("-50000.00"))).toBe("-$ 50.000");
});

test("formatDate keeps the calendar day", () => {
  // Si se parseara como UTC, en Bogotá (UTC-5) saldría 27 de febrero.
  expect(formatDate("2026-02-28")).toMatch(/28/);
  expect(formatDate("2026-02-28")).toMatch(/feb/);
});
