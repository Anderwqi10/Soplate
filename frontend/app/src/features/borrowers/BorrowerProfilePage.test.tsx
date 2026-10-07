import { screen, within } from "@testing-library/react";
import { Route, Routes } from "react-router";
import * as client from "../../api/client";
import type { BorrowerProfile } from "../../api/types";
import { renderWithProviders } from "../../test/render";
import BorrowerProfilePage from "./BorrowerProfilePage";

vi.mock("../../api/client", async (importOriginal) => ({
  ...(await importOriginal<typeof client>()),
  apiFetch: vi.fn(),
}));

const n = (s: string | null) => (s ?? "").replace(/\s/g, " ");

function profile(overrides: Partial<BorrowerProfile> = {}): BorrowerProfile {
  return {
    borrower: { id: 4, full_name: "Luis Pérez", document_id: "1020", phone: "3001234567", address: "", notes: "", created_at: "" },
    rating: "REGULAR", on_time_count: 8, late_count: 2, on_time_percent: 80, avg_days_late: 4,
    total_lent: "3000000.00", total_collected: "2500000.00", outstanding: "800000.00", losses: "0.00",
    loans: [
      { id: 7, start_date: "2026-01-31", end_date: "2026-04-30", principal: "1000000.00", total_amount: "1200000.00",
        paid_total: "400000.00", outstanding: "800000.00", status: "OVERDUE", is_open: true },
      { id: 3, start_date: "2025-06-01", end_date: "2025-09-01", principal: "2000000.00", total_amount: "2400000.00",
        paid_total: "2400000.00", outstanding: "0.00", status: "SETTLED", is_open: false },
    ],
    ...overrides,
  };
}

function renderProfile(data: BorrowerProfile) {
  vi.mocked(client.apiFetch).mockResolvedValue(data);
  renderWithProviders(
    <Routes>
      <Route path="/borrowers/:id" element={<BorrowerProfilePage />} />
    </Routes>,
    { route: "/borrowers/4" },
  );
}

beforeEach(() => {
  vi.mocked(client.apiFetch).mockReset();
});

test("shows the rating, punctuality and totals", async () => {
  renderProfile(profile());
  expect(await screen.findByRole("heading", { name: "Luis Pérez" })).toBeInTheDocument();
  expect(client.apiFetch).toHaveBeenCalledWith("/borrowers/4/profile/");
  expect(screen.getByTestId("rating")).toHaveTextContent("Regular");
  expect(screen.getByText("80 % de sus cuotas a tiempo")).toBeInTheDocument();
  expect(screen.getByText("8 a tiempo, 2 tarde, 4 días de atraso en promedio")).toBeInTheDocument();
  expect(n(screen.getByTestId("total_lent").textContent)).toBe("$ 3.000.000");
  expect(n(screen.getByTestId("outstanding").textContent)).toBe("$ 800.000");
});

test("lists open and closed loans; only open ones link to their detail", async () => {
  renderProfile(profile());
  const list = await screen.findByRole("list", { name: "Préstamos de Luis Pérez" });
  const rows = within(list).getAllByRole("listitem");
  expect(within(rows[0]).getByRole("link")).toHaveAttribute("href", "/loans/7");
  expect(within(rows[0]).getByText("Retrasado")).toBeInTheDocument();
  expect(within(rows[1]).queryByRole("link")).not.toBeInTheDocument();
  expect(within(rows[1]).getByText("Liquidado")).toBeInTheDocument();
});

test("a borrower without due installments has no history yet", async () => {
  renderProfile(profile({ rating: "NO_HISTORY", on_time_count: 0, late_count: 0, on_time_percent: null, loans: [] }));
  expect(await screen.findByTestId("rating")).toHaveTextContent("Sin historial");
  expect(screen.getByText("Todavía no le ha vencido ninguna cuota.")).toBeInTheDocument();
  expect(screen.getByText("Aún no le has prestado.")).toBeInTheDocument();
});

test("losses are shown when there are any", async () => {
  renderProfile(profile({ rating: "RISKY", losses: "500000.00" }));
  expect(n((await screen.findByTestId("losses")).textContent)).toBe("$ 500.000");
});
