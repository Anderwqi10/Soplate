import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import MoneyInput from "./MoneyInput";

function Field({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  return (
    <label>
      Monto
      <MoneyInput value={value} onChange={setValue} />
    </label>
  );
}

test("adds the peso sign and thousands dots while typing", async () => {
  render(<Field />);
  await userEvent.type(screen.getByLabelText("Monto"), "1000000");
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 1.000.000");
});

test("cents are typed with a comma", async () => {
  render(<Field />);
  await userEvent.type(screen.getByLabelText("Monto"), "2500,75");
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 2.500,75");
});

test("deleting regroups the dots", async () => {
  render(<Field initial="$ 10.000" />);
  const input = screen.getByLabelText("Monto");
  await userEvent.type(input, "{Backspace}");
  expect(input).toHaveValue("$ 1.000");
});

test("editing in the middle keeps the cursor next to the typed digit", async () => {
  render(<Field initial="$ 1.000" />);
  const input = screen.getByLabelText("Monto") as HTMLInputElement;
  // Cursor justo después del "1": "$ 1|.000"
  await userEvent.type(input, "5", { initialSelectionStart: 3, initialSelectionEnd: 3 });
  expect(input).toHaveValue("$ 15.000");
  expect(input.selectionStart).toBe(4); // "$ 15|.000"
});

test("a dot typed key by key after a grouped thousand is the decimal separator", async () => {
  render(<Field />);
  await userEvent.type(screen.getByLabelText("Monto"), "1500.50");
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 1.500,50");
});

test("thousands dots typed by hand are still accepted", async () => {
  render(<Field />);
  await userEvent.type(screen.getByLabelText("Monto"), "1.000");
  expect(screen.getByLabelText("Monto")).toHaveValue("$ 1.000");
});
