import { useState, type FormEvent } from "react";
import type { LoanDetail, LoanPreview } from "../../api/types";
import ConfirmBox from "../../components/ConfirmBox";
import ErrorMessage from "../../components/ErrorMessage";
import { normalizeAmount } from "../../lib/amount";
import { formatDate, formatMoney } from "../../lib/format";
import { usePreviewLoan, useUpdateLoanTerms } from "./api";

const rateText = (rate: string) => `${Number(rate)} %`;

/** Cambiar la tasa o la fecha de inicio. Antes de guardar, una pregunta de seguridad compara antes y después. */
export default function LoanTermsEditor({ loan }: { loan: LoanDetail }) {
  const preview = usePreviewLoan();
  const save = useUpdateLoanTerms(loan.id);
  const [editing, setEditing] = useState(false);
  const [rate, setRate] = useState(String(Number(loan.interest_rate)));
  const [start, setStart] = useState(loan.start_date);
  const [problem, setProblem] = useState<string | null>(null);
  const [after, setAfter] = useState<LoanPreview | null>(null);
  const [changes, setChanges] = useState<{ interest_rate?: string; start_date?: string }>({});

  // Si las condiciones cambian (se guardaron y la ficha se recargó), el formulario muestra las nuevas.
  const termsKey = `${loan.interest_rate}|${loan.start_date}`;
  const [seenTerms, setSeenTerms] = useState(termsKey);
  if (seenTerms !== termsKey) {
    setSeenTerms(termsKey);
    setRate(String(Number(loan.interest_rate)));
    setStart(loan.start_date);
  }

  function reset() {
    setEditing(false);
    setAfter(null);
    setProblem(null);
    setRate(String(Number(loan.interest_rate)));
    setStart(loan.start_date);
    preview.reset();
    save.reset();
  }

  function review(event: FormEvent) {
    event.preventDefault();
    setProblem(null);
    const newRate = normalizeAmount(rate);
    if (newRate === null) return setProblem("La tasa no es válida. Escríbela así: 20 o 1,5.");
    const next: typeof changes = {};
    if (Number(newRate) !== Number(loan.interest_rate)) next.interest_rate = newRate;
    if (start && start !== loan.start_date) next.start_date = start;
    if (Object.keys(next).length === 0) return setProblem("No cambiaste la tasa ni la fecha.");
    setChanges(next);
    // El "después" lo calcula el backend con las mismas reglas que usará al guardar.
    preview.mutate(
      {
        principal: loan.principal, interest_rate: newRate, interest_mode: loan.interest_mode,
        installments_count: loan.installments_count, frequency: loan.frequency, start_date: start,
      },
      { onSuccess: setAfter },
    );
  }

  if (!editing) {
    return (
      <div className="grid gap-2">
        {save.isSuccess && <p role="status" className="text-sm text-ledger">Condiciones actualizadas.</p>}
        <div>
          <button type="button" className="btn btn-quiet" onClick={() => setEditing(true)}>
            Editar condiciones
          </button>
        </div>
      </div>
    );
  }

  if (after) {
    return (
      <ConfirmBox
        title={`¿Cambiar las condiciones del préstamo de ${loan.borrower_name}?`}
        confirmLabel="Sí, cambiar condiciones"
        pending={save.isPending}
        error={save.error}
        onCancel={reset}
        onConfirm={() =>
          save.mutate(changes, {
            onSuccess: () => {
              setEditing(false);
              setAfter(null);
            },
          })
        }
      >
        <ul className="tabular grid gap-1">
          {changes.interest_rate && (
            <li>Tasa: {rateText(loan.interest_rate)} → <strong>{rateText(changes.interest_rate)}</strong></li>
          )}
          {changes.start_date && (
            <li>Inicio: {formatDate(loan.start_date)} → <strong>{formatDate(changes.start_date)}</strong></li>
          )}
          <li>Cuota: {formatMoney(loan.installment_amount)} → <strong>{formatMoney(after.installment_amount)}</strong></li>
          <li>Total: {formatMoney(loan.total_amount)} → <strong>{formatMoney(after.total_amount)}</strong></li>
        </ul>
        <p className="mt-2">Lo ya pagado ({formatMoney(loan.paid_total)}) se reparte sobre las cuotas nuevas.</p>
      </ConfirmBox>
    );
  }

  return (
    <form onSubmit={review} className="grid gap-3 border border-rule bg-sheet p-4">
      <p className="font-semibold">Editar condiciones</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          <span>Tasa de interés (%)</span>
          <input className="input tabular" inputMode="decimal" required value={rate} onChange={(e) => setRate(e.target.value)} />
        </label>
        <label className="field">
          <span>Fecha de inicio</span>
          <input className="input" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
        </label>
      </div>
      {problem && <p role="alert" className="text-sm text-red">{problem}</p>}
      <ErrorMessage error={preview.error} />
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="btn btn-primary" disabled={preview.isPending}>
          Revisar cambios
        </button>
        <button type="button" className="btn btn-quiet" onClick={reset}>
          Cancelar
        </button>
      </div>
    </form>
  );
}
