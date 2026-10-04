import { Link } from "react-router";
import type { DueRow, LoanStatus } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { useDashboard } from "./api";

const STATUS_ORDER: LoanStatus[] = ["ACTIVE", "OVERDUE", "DEFAULTED", "PAID"];

/** Un renglón de la suma: etiqueta a la izquierda, cifra a la derecha. */
function SumLine({ label, value, testId, sign, big = false }: {
  label: string; value: string; testId: string; sign?: string; big?: boolean;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2">
      <dt className={big ? "font-semibold" : "text-muted"}>{label}</dt>
      <dd className={`tabular font-display ${big ? "text-4xl font-bold md:text-5xl" : "text-2xl"}`}>
        {sign && <span className="mr-2 text-muted" aria-hidden="true">{sign}</span>}
        <span data-testid={testId}>{formatMoney(value)}</span>
      </dd>
    </div>
  );
}

function DueList({ rows, empty, overdue = false }: { rows: (DueRow & { days_overdue?: number })[]; empty: string; overdue?: boolean }) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="border-t border-rule">
      {rows.map((r) => (
        <li key={`${r.loan_id}-${r.number}`} className="border-b border-rule">
          <Link to={`/loans/${r.loan_id}`} className="flex flex-wrap items-baseline justify-between gap-x-4 py-3 hover:bg-sheet">
            <span className="grid">
              <span className="font-semibold">{r.borrower_name}</span>
              <span className="text-sm text-muted">
                Cuota {r.number}, {formatDate(r.due_date)}
                {overdue && r.days_overdue !== undefined && (
                  <>
                    , <span className="text-red">{r.days_overdue} días de atraso</span>
                  </>
                )}
              </span>
            </span>
            <span className={`tabular ${overdue ? "text-red" : ""}`}>{formatMoney(r.remaining)}</span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default function DashboardPage() {
  const query = useDashboard();

  if (query.isPending) return <p className="text-muted">Cargando resumen…</p>;
  if (query.isError) return <ErrorMessage error={query.error} />;
  const d = query.data;

  return (
    <>
      <PageHeader title="Resumen" />

      <div className="grid gap-12 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-12">
          {/* El balance general como una suma de cuaderno: lo que tienes más lo que te deben. */}
          <section aria-label="Balance general">
            <dl>
              <SumLine label="Disponible en cuentas" value={d.total_balance} testId="total_balance" />
              <SumLine label="Por cobrar" value={d.outstanding_total} testId="outstanding_total" sign="+" />
              <div className="border-t-2 border-ink" />
              <SumLine label="Patrimonio" value={d.net_worth} testId="net_worth" big />
            </dl>
            <p className="mt-2 text-sm text-muted">
              De lo que te deben, {formatMoney(d.outstanding_principal)} es capital. Intereses ya cobrados:{" "}
              <span data-testid="interest_earned" className="tabular font-semibold text-ledger">
                {formatMoney(d.interest_earned)}
              </span>
              .
            </p>
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Cuotas vencidas</h2>
            <DueList rows={d.overdue} empty="No hay cuotas vencidas." overdue />
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Próximas cuotas (7 días)</h2>
            <DueList rows={d.upcoming} empty="No hay cuotas en los próximos 7 días." />
          </section>
        </div>

        <div className="grid content-start gap-12">
          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Préstamos</h2>
            <ul className="border-t border-rule">
              {STATUS_ORDER.map((status) => (
                <li key={status} className="border-b border-rule">
                  <Link to={`/loans?status=${status}`} className="flex items-center justify-between gap-4 py-3 hover:bg-sheet">
                    <StatusBadge kind="loan" status={status} />
                    <span className="tabular font-display text-xl">{d.loans_by_status[status]}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Cuentas</h2>
            {d.accounts.length === 0 ? (
              <Link to="/accounts" className="btn btn-primary justify-self-start">
                Crea tu primera cuenta
              </Link>
            ) : (
              <ul className="border-t border-rule">
                {d.accounts.map((a) => (
                  <li key={a.id} className="border-b border-rule">
                    <Link to={`/accounts/${a.id}`} className="flex items-baseline justify-between gap-4 py-3 hover:bg-sheet">
                      <span>{a.name}</span>
                      <span className={`tabular ${a.balance.startsWith("-") ? "text-red" : ""}`}>{formatMoney(a.balance)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
