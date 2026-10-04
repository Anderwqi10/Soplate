import { fireEvent, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import * as client from "../../api/client";
import type { Projection } from "../../api/types";
import { addDaysISO, todayISO } from "../../lib/format";
import { renderWithProviders } from "../../test/render";
import ProjectionPage from "./ProjectionPage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function projection(overrides: Partial<Projection> = {}): Projection {
  return {
    date: addDaysISO(todayISO(), 30), current_balance: "1000000.00", expected_inflows: "800000.00",
    overdue_amount: "400000.00", projected_balance: "1800000.00",
    by_account: [{ id: 1, name: "Bancolombia", current_balance: "1000000.00", expected_inflows: "800000.00", projected_balance: "1800000.00" }],
    ...overrides,
  };
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
  vi.mocked(client.apiFetch).mockResolvedValue(projection());
});

test("defaults to 30 days from today", async () => {
  renderWithProviders(<ProjectionPage />);
  expect(screen.getByLabelText("Fecha")).toHaveValue(addDaysISO(todayISO(), 30));
  expect(n((await screen.findByTestId("projected_balance")).textContent)).toBe("$ 1.800.000");
  expect(client.apiFetch).toHaveBeenCalledWith("/reports/projection/", {
    query: { date: addDaysISO(todayISO(), 30), include_overdue: false },
  });
});

test("projection requests chosen date and toggles overdue", async () => {
  const target = addDaysISO(todayISO(), 90);
  renderWithProviders(<ProjectionPage />);
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: target } });
  await screen.findByTestId("projected_balance");
  expect(client.apiFetch).toHaveBeenLastCalledWith("/reports/projection/", { query: { date: target, include_overdue: false } });

  vi.mocked(client.apiFetch).mockResolvedValue(projection({ projected_balance: "2200000.00" }));
  await userEvent.click(screen.getByLabelText("Incluir cuotas vencidas"));
  expect(client.apiFetch).toHaveBeenLastCalledWith("/reports/projection/", { query: { date: target, include_overdue: true } });
  expect(await screen.findByText(/2\.200\.000/)).toBeInTheDocument();
});

test("a past date is not sent and explains why", async () => {
  renderWithProviders(<ProjectionPage />);
  await screen.findByTestId("projected_balance");
  vi.mocked(client.apiFetch).mockClear();
  fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: addDaysISO(todayISO(), -1) } });
  expect(await screen.findByText("Elige hoy o una fecha futura.")).toBeInTheDocument();
  expect(client.apiFetch).not.toHaveBeenCalled();
});
