import { Link, useParams } from "react-router";
import type { BorrowerProfile, CloseReason, LoanStatus } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { CLOSE_REASON_LABEL, LOAN_STATUS, RATING, type Tone } from "../../lib/status";
import { useBorrowerProfile } from "./api";

const TONE_CLASS: Record<Tone, string> = { green: "text-ledger", amber: "text-amber", red: "text-red", gray: "text-muted" };

function Figure({ label, value, testId }: { label: string; value: string; testId: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2">
      <dt className="text-muted">{label}</dt>
      <dd data-testid={testId} className="tabular">{formatMoney(value)}</dd>
    </div>
  );
}

function LoanRow({ loan }: { loan: BorrowerProfile["loans"][number] }) {
  const closed = !loan.is_open;
  const label = closed ? CLOSE_REASON_LABEL[loan.status as CloseReason] : LOAN_STATUS[loan.status as LoanStatus].label;
  const dates = `${formatDate(loan.start_date)} a ${formatDate(loan.end_date)}`;
  return (
    <li className={`grid gap-1 border-b border-rule py-3 sm:grid-cols-[1fr_auto] sm:items-baseline ${closed ? "text-muted" : ""}`}>
      <div className="grid">
        {closed ? (
          <span className="font-semibold">{formatMoney(loan.principal)} prestados</span>
        ) : (
          <Link to={`/loans/${loan.id}`} className="font-semibold underline-offset-4 hover:underline">
            {formatMoney(loan.principal)} prestados
          </Link>
        )}
        <span className="text-sm">{dates}</span>
      </div>
      <div className="flex flex-wrap items-baseline gap-x-4 text-sm sm:justify-end">
        {closed ? <span>{label}</span> : <StatusBadge kind="loan" status={loan.status as LoanStatus} />}
        <span className="tabular">
          Pagado {formatMoney(loan.paid_total)} de {formatMoney(loan.total_amount)}
        </span>
      </div>
    </li>
  );
}

export default function BorrowerProfilePage() {
  const id = Number(useParams().id);
  const query = useBorrowerProfile(id);

  if (query.isPending) return <p className="text-muted">Cargando perfil…</p>;
  if (query.isError) return <ErrorMessage error={query.error} />;

  const p = query.data;
  const rating = RATING[p.rating];
  const name = p.borrower.full_name;
  const contact = [p.borrower.document_id && `Doc. ${p.borrower.document_id}`, p.borrower.phone].filter(Boolean).join(", ");

  return (
    <>
      <Link to="/borrowers" className="text-sm text-muted underline-offset-4 hover:underline">
        Todos los deudores
      </Link>
      <header className="mt-1 mb-8 grid gap-1">
        <h1 className="text-3xl font-bold md:text-4xl">{name}</h1>
        {contact && <p className="text-muted">{contact}</p>}
      </header>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
        <div className="grid content-start gap-8">
          <section aria-label="Cumplimiento" className="grid gap-2 border-b-2 border-ink pb-4">
            <p data-testid="rating" className={`font-display text-4xl font-bold ${TONE_CLASS[rating.tone]}`}>
              {rating.label}
            </p>
            {p.on_time_percent === null ? (
              <p className="text-muted">Todavía no le ha vencido ninguna cuota.</p>
            ) : (
              <>
                <p className="text-lg">{p.on_time_percent} % de sus cuotas a tiempo</p>
                <p className="text-sm text-muted">
                  {p.on_time_count} a tiempo, {p.late_count} tarde, {p.avg_days_late} días de atraso en promedio
                </p>
              </>
            )}
          </section>

          <dl>
            <Figure label="Total prestado" value={p.total_lent} testId="total_lent" />
            <Figure label="Total cobrado" value={p.total_collected} testId="total_collected" />
            <Figure label="Te debe hoy" value={p.outstanding} testId="outstanding" />
            {Number(p.losses) > 0 && <Figure label="Pérdidas" value={p.losses} testId="losses" />}
          </dl>
        </div>

        <section className="grid content-start gap-3">
          <h2 className="text-xl font-semibold">Préstamos</h2>
          {p.loans.length === 0 ? (
            <p className="text-muted">Aún no le has prestado.</p>
          ) : (
            <ul aria-label={`Préstamos de ${name}`} className="border-t border-rule">
              {p.loans.map((loan) => (
                <LoanRow key={loan.id} loan={loan} />
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
