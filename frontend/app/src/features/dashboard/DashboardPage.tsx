import type { ReactNode } from "react";
import { Link } from "react-router";
import type { DueRow, LoanStatus } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { useDashboard } from "./api";

const STATUS_ORDER: LoanStatus[] = ["ACTIVE", "OVERDUE", "DEFAULTED", "PAID"];

/** Grupo de contenido sobre fondo blanco. */
function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid content-start gap-3 rounded-xl border border-rule bg-sheet p-5">
      <h2 className="text-lg font-bold">{title}</h2>
      {children}
    </section>
  );
}

function DueList({ rows, empty, overdue = false }: { rows: (DueRow & { days_overdue?: number })[]; empty: string; overdue?: boolean }) {
  if (rows.length === 0) return <p className="text-muted">{empty}</p>;
  return (
    <ul className="-mx-2">
      {rows.map((r) => (
        <li key={`${r.loan_id}-${r.number}`}>
          <Link
            to={`/loans/${r.loan_id}`}
            className="flex flex-wrap items-baseline justify-between gap-x-4 rounded-lg px-2 py-2.5 hover:bg-paper"
          >
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
            <span className={`tabular font-semibold ${overdue ? "text-red" : ""}`}>{formatMoney(r.remaining)}</span>
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
      <PageHeader
        title="Resumen"
        actions={
          <Link to="/loans/new" className="btn btn-primary">
            Nuevo préstamo
          </Link>
        }
      />

      <div className="grid gap-6">
        {/*
          Balance general en la banda azul noche, el único elemento llamativo de la página.
          Celular: el patrimonio primero y en grande. Escritorio: la suma completa
          (disponible + por cobrar = patrimonio) de arriba hacia abajo.
        */}
        <section aria-label="Balance general" className="rounded-2xl bg-navy p-6 text-on-navy md:p-8">
          <dl className="flex flex-col">
            <div className="order-1 flex flex-col gap-1 border-b border-on-navy/15 pb-4 md:order-3 md:mt-2 md:flex-row md:items-baseline md:justify-between md:border-t-2 md:border-b-0 md:border-on-navy/40 md:pt-4 md:pb-0">
              <dt className="font-semibold text-on-navy/80">Patrimonio</dt>
              <dd data-testid="net_worth" className="tabular text-4xl font-extrabold tracking-tight md:text-5xl">
                {formatMoney(d.net_worth)}
              </dd>
            </div>
            <div className="order-2 flex items-baseline justify-between gap-4 pt-3 pb-1 md:order-1 md:pt-0">
              <dt className="text-on-navy/70">Disponible en cuentas</dt>
              <dd data-testid="total_balance" className="tabular text-lg font-semibold md:text-2xl">
                {formatMoney(d.total_balance)}
              </dd>
            </div>
            <div className="order-3 flex items-baseline justify-between gap-4 py-1 md:order-2">
              <dt className="text-on-navy/70">Por cobrar</dt>
              <dd className="tabular text-lg font-semibold md:text-2xl">
                <span className="mr-2 text-on-navy/50" aria-hidden="true">+</span>
                <span data-testid="outstanding_total">{formatMoney(d.outstanding_total)}</span>
              </dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-1 text-sm text-on-navy/70">
            <p>
              De lo que te deben, {formatMoney(d.outstanding_principal)} es capital. Intereses ya cobrados:{" "}
              <span data-testid="interest_earned" className="tabular font-bold text-on-navy">
                {formatMoney(d.interest_earned)}
              </span>
              .
            </p>
            {Number(d.losses_total) > 0 && (
              <p>
                Pérdidas reportadas:{" "}
                <span data-testid="losses_total" className="tabular font-bold text-on-navy">
                  {formatMoney(d.losses_total)}
                </span>
                .
              </p>
            )}
          </div>
        </section>

        {/* Préstamos por estado: accesos grandes y tocables a la lista filtrada. */}
        <section aria-labelledby="loans-by-status" className="grid gap-3">
          <h2 id="loans-by-status" className="text-lg font-bold">
            Préstamos
          </h2>
          <ul className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {STATUS_ORDER.map((status) => (
              <li key={status}>
                <Link
                  to={`/loans?status=${status}`}
                  className="flex h-full flex-col gap-2 rounded-xl border border-rule bg-sheet p-4 transition-colors hover:border-accent"
                >
                  <StatusBadge kind="loan" status={status} />
                  <span className="tabular text-3xl font-extrabold tracking-tight">{d.loans_by_status[status]}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>

        {/* Lo que pide acción a la izquierda; las cuentas a la derecha. En celular, en ese mismo orden. */}
        <div className="grid gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
          <div className="grid content-start gap-6">
            <Panel title="Cuotas vencidas">
              <DueList rows={d.overdue} empty="No hay cuotas vencidas." overdue />
            </Panel>
            <Panel title="Próximas cuotas (7 días)">
              <DueList rows={d.upcoming} empty="No hay cuotas en los próximos 7 días." />
            </Panel>
          </div>

          <Panel title="Cuentas">
            {d.accounts.length === 0 ? (
              <Link to="/accounts" className="btn btn-primary justify-self-start">
                Crea tu primera cuenta
              </Link>
            ) : (
              <ul className="-mx-2">
                {d.accounts.map((a) => (
                  <li key={a.id}>
                    <Link
                      to={`/accounts/${a.id}`}
                      className="flex items-baseline justify-between gap-4 rounded-lg px-2 py-2.5 hover:bg-paper"
                    >
                      <span>{a.name}</span>
                      <span className={`tabular font-semibold ${a.balance.startsWith("-") ? "text-red" : ""}`}>
                        {formatMoney(a.balance)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        </div>
      </div>
    </>
  );
}
