import { useState } from "react";
import { Link, useParams } from "react-router";
import type { LoanDetail } from "../../api/types";
import CobroCard from "../../components/CobroCard";
import ErrorMessage from "../../components/ErrorMessage";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { FREQUENCY_LABEL } from "../../lib/status";
import { useLoan, useUpdateLoanNotes } from "./api";
import PaymentForm from "./PaymentForm";

function Figure({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
      <dt className="text-muted">{label}</dt>
      <dd className={`tabular ${strong ? "font-display text-xl font-bold" : ""}`}>{value}</dd>
    </div>
  );
}

function NotesEditor({ loan }: { loan: LoanDetail }) {
  const save = useUpdateLoanNotes(loan.id);
  const [notes, setNotes] = useState(loan.notes);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        save.mutate(notes.trim());
      }}
      className="grid gap-3"
    >
      <label className="field">
        <span>Notas</span>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Por ejemplo: paga los viernes" />
      </label>
      <ErrorMessage error={save.error} />
      <div className="flex items-center gap-3">
        <button type="submit" className="btn btn-quiet" disabled={save.isPending || notes.trim() === loan.notes}>
          Guardar notas
        </button>
        {save.isSuccess && <span role="status" className="text-sm text-ledger">Notas guardadas.</span>}
      </div>
    </form>
  );
}

export default function LoanDetailPage() {
  const id = Number(useParams().id);
  const query = useLoan(id);

  if (query.isPending) return <p className="text-muted">Cargando préstamo…</p>;
  if (query.isError) return <ErrorMessage error={query.error} />;

  const loan = query.data;
  const total = Number(loan.total_amount);
  const percent = total > 0 ? Math.round((Number(loan.paid_total) / total) * 100) : 0; // solo para la barra
  const paidCount = loan.installments.filter((i) => i.status === "PAID").length;

  return (
    <>
      <Link to="/loans" className="text-sm text-muted underline-offset-4 hover:underline">
        Todos los préstamos
      </Link>

      <header className="mt-1 mb-8 grid gap-2">
        <h1 className="text-3xl font-bold md:text-4xl">{loan.borrower_name}</h1>
        <p className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <StatusBadge kind="loan" status={loan.status} />
          {loan.days_overdue > 0 && <span className="text-muted">{loan.days_overdue} días de atraso</span>}
          <span className="text-muted">
            {loan.installments_count} cuotas, frecuencia {FREQUENCY_LABEL[loan.frequency].toLowerCase()}, desde {formatDate(loan.start_date)}
          </span>
        </p>
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="grid content-start gap-10">
          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="text-xl font-semibold">Tarjeta de cobro</h2>
              <span className="text-sm text-muted">
                {paidCount} de {loan.installments_count} cuotas pagadas
              </span>
            </div>
            <CobroCard label="Tarjeta de cobro" installments={loan.installments} />
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Cuotas</h2>
            <div className="overflow-x-auto">
              <table aria-label="Cuotas" className="w-full text-left">
                <thead className="border-b-2 border-ink text-sm text-muted">
                  <tr>
                    <th className="py-2 pr-4 font-semibold">N.º</th>
                    <th className="py-2 pr-4 font-semibold">Fecha</th>
                    <th className="py-2 pr-4 text-right font-semibold">Valor</th>
                    <th className="py-2 pr-4 text-right font-semibold">Pagado</th>
                    <th className="py-2 pr-4 text-right font-semibold">Falta</th>
                    <th className="py-2 font-semibold">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.installments.map((i) => (
                    <tr key={i.number} className="border-b border-rule">
                      <td className="py-2 pr-4">{i.number}</td>
                      <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.due_date)}</td>
                      <td className="py-2 pr-4 text-right">{formatMoney(i.amount)}</td>
                      <td className="py-2 pr-4 text-right">{formatMoney(i.paid_amount)}</td>
                      <td className="py-2 pr-4 text-right">{formatMoney(i.remaining)}</td>
                      <td className="py-2 whitespace-nowrap">
                        <StatusBadge kind="installment" status={i.status} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <section className="grid gap-3">
            <h2 className="text-xl font-semibold">Pagos recibidos</h2>
            {loan.payments.length === 0 ? (
              <p className="text-muted">Todavía no hay pagos.</p>
            ) : (
              <ul className="border-t border-rule">
                {loan.payments.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-baseline justify-between gap-x-4 border-b border-rule py-2">
                    <span>
                      {formatDate(p.date)} <span className="text-muted">en {p.account_name}</span>
                      {p.note && <span className="block text-sm text-muted">{p.note}</span>}
                    </span>
                    <span className="tabular text-ledger">+{formatMoney(p.amount)}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>

        <div className="grid content-start gap-10">
          <section className="grid gap-3">
            <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
              <span className="text-muted">Pendiente</span>
              <span className="tabular font-display text-3xl font-bold md:text-4xl">{formatMoney(loan.outstanding)}</span>
            </div>
            <div
              role="progressbar"
              aria-label="Pagado del préstamo"
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              className="h-2 bg-rule"
            >
              <div className="h-full bg-ledger" style={{ width: `${percent}%` }} />
            </div>
            <dl>
              <Figure label="Cuota" value={formatMoney(loan.installment_amount)} strong />
              <Figure label="Próxima cuota" value={loan.next_due_date ? formatDate(loan.next_due_date) : "Ninguna"} />
              <Figure label="Fin esperado" value={formatDate(loan.end_date)} />
              <Figure label="Capital prestado" value={formatMoney(loan.principal)} />
              <Figure label="Interés" value={`${formatMoney(loan.interest_total)} (${Number(loan.interest_rate)} %)`} />
              <Figure label="Total a pagar" value={formatMoney(loan.total_amount)} />
              <Figure label="Pagado" value={formatMoney(loan.paid_total)} />
              <Figure label="Capital pendiente" value={formatMoney(loan.outstanding_principal)} />
              <Figure label="Cuenta" value={loan.account_name} />
            </dl>
          </section>

          <section className="grid gap-3 border border-rule border-t-[3px] border-t-ledger bg-sheet p-5">
            <h2 className="text-xl font-semibold">Registrar pago</h2>
            {loan.status === "PAID" ? (
              <p className="text-muted">Este préstamo ya está pagado.</p>
            ) : (
              <PaymentForm loan={loan} />
            )}
          </section>

          <NotesEditor key={loan.id} loan={loan} />
        </div>
      </div>
    </>
  );
}
