import { addDaysISO, formatDate, formatMoney } from "./format";

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

test("addDaysISO crosses month and year boundaries", () => {
  expect(addDaysISO("2026-12-30", 3)).toBe("2027-01-02");
  expect(addDaysISO("2026-03-01", -1)).toBe("2026-02-28");
});

test("cents always show two digits when present", () => {
  expect(n(formatMoney("33.30"))).toBe("$ 33,30");
  expect(n(formatMoney("-5000.50"))).toBe("-$ 5.000,50");
  expect(n(formatMoney("400000.00"))).toBe("$ 400.000");
});
