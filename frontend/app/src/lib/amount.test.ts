import { amountToInput, formatAmountInput, normalizeAmount } from "./amount";

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

describe("formatAmountInput (lo que se ve mientras se escribe)", () => {
  test.each([
    ["1", "$ 1"],
    ["1000", "$ 1.000"],
    ["1000000", "$ 1.000.000"],
    ["1000000,5", "$ 1.000.000,5"],
    ["$ 1.000.0000", "$ 10.000.000"], // una cifra más escrita sobre un valor ya formateado
    ["12,345", "$ 12,34"], // máximo 2 centavos
    ["0005", "$ 5"],
    [",5", "$ 0,5"],
    ["1,2,3", "$ 1,23"], // solo una coma
    ["abc12", "$ 12"], // letras ignoradas
    ["$ ", ""], // se borró todo
    ["", ""],
  ])("%j se muestra como %j", (typed, shown) => {
    expect(formatAmountInput(typed)).toBe(shown);
  });

  test("the displayed text converts back to what the API expects", () => {
    expect(normalizeAmount(formatAmountInput("1000000,5"))).toBe("1000000.5");
    expect(normalizeAmount(formatAmountInput("250000"))).toBe("250000");
  });
});

test("amountToInput shows an API amount ready to edit", () => {
  expect(amountToInput("400000.00")).toBe("$ 400.000");
  expect(amountToInput("33.30")).toBe("$ 33,30");
  expect(amountToInput("1000000.5")).toBe("$ 1.000.000,50");
});
