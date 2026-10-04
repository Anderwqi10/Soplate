import { normalizeAmount } from "./amount";

test("accepts amounts written the Colombian way", () => {
  expect(normalizeAmount("1.000.000")).toBe("1000000");
  expect(normalizeAmount("1.000.000,50")).toBe("1000000.50");
  expect(normalizeAmount("1,5")).toBe("1.5");
  expect(normalizeAmount("$ 250.000")).toBe("250000");
});

test("keeps plain and dot-decimal numbers", () => {
  expect(normalizeAmount("1000000")).toBe("1000000");
  expect(normalizeAmount("20.5")).toBe("20.5");
  expect(normalizeAmount(" 400000.00 ")).toBe("400000.00");
});

test("rejects what is not an amount", () => {
  expect(normalizeAmount("")).toBeNull();
  expect(normalizeAmount("abc")).toBeNull();
  expect(normalizeAmount("1,2,3")).toBeNull();
  expect(normalizeAmount("10.123")).toBe("10123"); // grupo de miles
  expect(normalizeAmount("10.1234")).toBeNull();
  expect(normalizeAmount("5,123")).toBeNull(); // más de 2 decimales
});
