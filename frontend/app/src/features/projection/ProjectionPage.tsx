import { useState } from "react";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import { addDaysISO, formatDate, formatMoney, todayISO } from "../../lib/format";
import { useProjection } from "./api";

const DEFAULT_DAYS_AHEAD = 30;

export default function ProjectionPage() {
  const today = todayISO();
  const [date, setDate] = useState(() => addDaysISO(today, DEFAULT_DAYS_AHEAD));
  const [includeOverdue, setIncludeOverdue] = useState(false);
  // Las fechas "AAAA-MM-DD" se comparan bien como texto.
  const isValid = date !== "" && date >= today;
  const query = useProjection(isValid ? date : "", includeOverdue);
  const p = query.data;

  return (
    <>
      <PageHeader title="Proyección" />
      <p className="mb-6 max-w-2xl text-muted">
        Cuánto dinero tendrás en una fecha si te pagan las cuotas que vencen hasta ese día.
      </p>

      <div className="mb-8 flex flex-wrap items-end gap-6">
        <label className="field">
          <span>Fecha</span>
          <input className="input" type="date" min={today} value={date} onChange={(e) => setDate(e.target.value)} />
        </label>
        <label className="flex items-center gap-2 pb-2.5">
          <input type="checkbox" checked={includeOverdue} onChange={(e) => setIncludeOverdue(e.target.checked)} />
          Incluir cuotas vencidas
        </label>
      </div>

      {!isValid && <p role="alert" className="text-red">Elige hoy o una fecha futura.</p>}
      <ErrorMessage error={query.error} />
      {isValid && query.isPending && <p className="text-muted">Calculando…</p>}

      {isValid && p && (
        <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
          <section aria-label="Resultado">
            <dl>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted">Tienes hoy</dt>
                <dd className="tabular font-display text-2xl">{formatMoney(p.current_balance)}</dd>
              </div>
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="text-muted">Cuotas por recibir hasta {formatDate(p.date)}</dt>
                <dd className="tabular font-display text-2xl">
                  <span className="mr-2 text-muted" aria-hidden="true">+</span>
                  {formatMoney(p.expected_inflows)}
                </dd>
              </div>
              {includeOverdue && (
                <div className="flex items-baseline justify-between gap-4 py-2">
                  <dt className="text-muted">Cuotas vencidas</dt>
                  <dd className="tabular font-display text-2xl text-amber">
                    <span className="mr-2 text-muted" aria-hidden="true">+</span>
                    {formatMoney(p.overdue_amount)}
                  </dd>
                </div>
              )}
              <div className="border-t-2 border-ink" />
              <div className="flex items-baseline justify-between gap-4 py-2">
                <dt className="font-semibold">Tendrás el {formatDate(p.date)}</dt>
                <dd data-testid="projected_balance" className="tabular font-display text-4xl font-bold md:text-5xl">
                  {formatMoney(p.projected_balance)}
                </dd>
              </div>
            </dl>
            {!includeOverdue && Number(p.overdue_amount) > 0 && (
              <p className="mt-2 text-sm text-muted">
                Hay {formatMoney(p.overdue_amount)} en cuotas vencidas que no se cuentan. Marca la casilla para incluirlas.
              </p>
            )}
          </section>

          <section className="grid content-start gap-3">
            <h2 className="text-xl font-semibold">Por cuenta</h2>
            {p.by_account.length === 0 ? (
              <p className="text-muted">No tienes cuentas activas.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="border-b-2 border-ink text-sm text-muted">
                    <tr>
                      <th className="py-2 pr-4 font-semibold">Cuenta</th>
                      <th className="py-2 pr-4 text-right font-semibold">Hoy</th>
                      <th className="py-2 pr-4 text-right font-semibold">Por recibir</th>
                      <th className="py-2 text-right font-semibold">Proyectado</th>
                    </tr>
                  </thead>
                  <tbody>
                    {p.by_account.map((a) => (
                      <tr key={a.id} className="border-b border-rule">
                        <td className="py-2 pr-4">{a.name}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(a.current_balance)}</td>
                        <td className="py-2 pr-4 text-right">{formatMoney(a.expected_inflows)}</td>
                        <td className="py-2 text-right font-semibold">{formatMoney(a.projected_balance)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      )}
    </>
  );
}
