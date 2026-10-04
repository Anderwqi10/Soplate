import { Link, useSearchParams } from "react-router";
import type { LoanListItem, LoanStatus } from "../../api/types";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import StatusBadge from "../../components/StatusBadge";
import { formatDate, formatMoney } from "../../lib/format";
import { LOAN_STATUS } from "../../lib/status";
import { useLoans } from "./api";

const TABS: { status?: LoanStatus; label: string; empty: string }[] = [
  { label: "Todos", empty: "Aún no tienes préstamos" },
  { status: "ACTIVE", label: LOAN_STATUS.ACTIVE.label, empty: "No hay préstamos al día" },
  { status: "OVERDUE", label: LOAN_STATUS.OVERDUE.label, empty: "No hay préstamos retrasados" },
  { status: "DEFAULTED", label: LOAN_STATUS.DEFAULTED.label, empty: "No hay préstamos vencidos" },
  { status: "PAID", label: LOAN_STATUS.PAID.label, empty: "No hay préstamos pagados" },
];

const isStatus = (value: string | null): value is LoanStatus => !!value && value in LOAN_STATUS;

/** Porcentaje pagado, solo para el ancho de la barra; las cifras mostradas vienen del backend. */
function paidPercent(loan: LoanListItem): number {
  const total = Number(loan.total_amount);
  return total > 0 ? Math.round((Number(loan.paid_total) / total) * 100) : 0;
}

function LoanRow({ loan }: { loan: LoanListItem }) {
  const percent = paidPercent(loan);
  return (
    <li className="grid grid-cols-2 gap-x-6 gap-y-2 border-b border-rule py-4 md:grid-cols-[1.4fr_1fr_1fr_1.2fr_1fr] md:items-center">
      <div className="col-span-2 grid md:col-span-1">
        <Link to={`/loans/${loan.id}`} className="font-semibold underline-offset-4 hover:underline">
          {loan.borrower_name}
        </Link>
        <span className="flex flex-wrap items-center gap-x-3 text-sm">
          <StatusBadge kind="loan" status={loan.status} />
          {loan.days_overdue > 0 && <span className="text-muted">{loan.days_overdue} días de atraso</span>}
        </span>
      </div>
      <div className="grid text-sm">
        <span className="text-muted">Cuota</span>
        <span data-testid={`installment-${loan.id}`} className="tabular text-base">
          {formatMoney(loan.installment_amount)}
        </span>
      </div>
      <div className="grid text-sm">
        <span className="text-muted">{loan.status === "PAID" ? "Terminó" : "Termina"}</span>
        <span className="text-base">{formatDate(loan.end_date)}</span>
      </div>
      <div className="col-span-2 grid gap-1 text-sm md:col-span-1">
        <span className="tabular text-muted">
          {formatMoney(loan.paid_total)} de {formatMoney(loan.total_amount)}
        </span>
        <div
          role="progressbar"
          aria-label={`Pagado del préstamo de ${loan.borrower_name}`}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={percent}
          className="h-1.5 bg-rule"
        >
          <div className="h-full bg-ledger" style={{ width: `${percent}%` }} />
        </div>
      </div>
      <div className="col-span-2 grid text-sm md:col-span-1 md:text-right">
        <span className="text-muted">Pendiente</span>
        <span data-testid={`outstanding-${loan.id}`} className="tabular font-display text-lg">
          {formatMoney(loan.outstanding)}
        </span>
      </div>
    </li>
  );
}

export default function LoansPage() {
  const [params, setParams] = useSearchParams();
  const status = isStatus(params.get("status")) ? (params.get("status") as LoanStatus) : undefined;
  const borrower = Number(params.get("borrower")) || undefined;
  const loans = useLoans({ status, borrower });
  const tab = TABS.find((t) => t.status === status) ?? TABS[0];
  const list = loans.data ?? [];

  function hrefFor(next?: LoanStatus) {
    const p = new URLSearchParams(params);
    if (next) p.set("status", next);
    else p.delete("status");
    const qs = p.toString();
    return `/loans${qs ? `?${qs}` : ""}`;
  }

  return (
    <>
      <PageHeader
        title="Préstamos"
        actions={
          <Link to="/loans/new" className="btn btn-primary">
            Nuevo préstamo
          </Link>
        }
      />

      <nav aria-label="Filtrar por estado" className="mb-6 flex gap-1 overflow-x-auto border-b border-rule">
        {TABS.map((t) => {
          const current = t.status === status;
          return (
            <Link
              key={t.label}
              to={hrefFor(t.status)}
              aria-current={current ? "page" : undefined}
              className={`-mb-px border-b-[3px] px-3 py-2 whitespace-nowrap ${current ? "border-ledger font-semibold" : "border-transparent text-muted hover:text-ink"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </nav>

      {borrower && (
        <p className="mb-4 text-sm text-muted">
          Mostrando los préstamos de un deudor.{" "}
          <button type="button" className="text-ledger underline-offset-4 hover:underline" onClick={() => setParams(status ? { status } : {})}>
            Ver todos
          </button>
        </p>
      )}

      <ErrorMessage error={loans.error} />
      {loans.isPending && <p className="text-muted">Cargando préstamos…</p>}

      {loans.isSuccess && list.length === 0 && (
        <EmptyState
          title={tab.empty}
          action={
            !status && (
              <Link to="/loans/new" className="btn btn-primary">
                Nuevo préstamo
              </Link>
            )
          }
        />
      )}

      {list.length > 0 && (
        <ul className="border-t-2 border-ink">
          {list.map((loan) => (
            <LoanRow key={loan.id} loan={loan} />
          ))}
        </ul>
      )}
    </>
  );
}
