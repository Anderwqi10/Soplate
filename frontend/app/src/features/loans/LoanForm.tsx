import { useEffect, useMemo, useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router";
import type { Frequency, InterestMode, LoanPreviewInput } from "../../api/types";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import { normalizeAmount } from "../../lib/amount";
import { todayISO } from "../../lib/format";
import { FREQUENCY_LABEL } from "../../lib/status";
import AccountSelect from "../accounts/AccountSelect";
import { useAccounts } from "../accounts/api";
import { useBorrowers } from "../borrowers/api";
import { useCreateLoan, usePreviewLoan } from "./api";
import SchedulePreview from "./SchedulePreview";

const PREVIEW_DELAY_MS = 400;

interface Fields {
  principal: string; rate: string; mode: InterestMode; count: string; frequency: Frequency; start: string;
}

/**
 * Valida los campos del cálculo. `input` existe solo si todo es válido;
 * `errors` explica qué arreglar (los campos vacíos los marca el navegador con `required`).
 */
function validate(f: Fields): { input: LoanPreviewInput | null; errors: string[] } {
  const errors: string[] = [];
  const principal = normalizeAmount(f.principal);
  const rate = normalizeAmount(f.rate);
  const count = Number(f.count);
  if (f.principal.trim() && (principal === null || Number(principal) <= 0)) {
    errors.push("El capital no es un monto válido. Escríbelo así: 1000000 o 1.000.000.");
  }
  if (f.rate.trim() && rate === null) errors.push("La tasa no es válida. Escríbela así: 20 o 1,5.");
  if (f.count.trim() && (!Number.isInteger(count) || count < 1 || count > 1000)) {
    errors.push("El número de cuotas debe ser un entero entre 1 y 1000.");
  }
  if (errors.length > 0 || !principal || !rate || !f.count.trim() || !f.start) return { input: null, errors };
  return {
    input: {
      principal, interest_rate: rate, interest_mode: f.mode,
      installments_count: count, frequency: f.frequency, start_date: f.start,
    },
    errors,
  };
}

export default function LoanForm() {
  const navigate = useNavigate();
  const accounts = useAccounts();
  const borrowers = useBorrowers();
  const preview = usePreviewLoan();
  const create = useCreateLoan();

  const [borrower, setBorrower] = useState<number | "">("");
  const [account, setAccount] = useState<number | "">("");
  const [principal, setPrincipal] = useState("");
  const [rate, setRate] = useState("");
  const [mode, setMode] = useState<InterestMode>("TOTAL");
  const [count, setCount] = useState("");
  const [frequency, setFrequency] = useState<Frequency>("MONTHLY");
  const [start, setStart] = useState(todayISO());
  const [notes, setNotes] = useState("");

  // Mismo objeto mientras los campos no cambien: así el efecto de abajo solo corre ante cambios reales.
  const { input, errors } = useMemo(
    () => validate({ principal, rate, mode, count, frequency, start }),
    [principal, rate, mode, count, frequency, start],
  );
  const [triedSubmit, setTriedSubmit] = useState(false);
  const inputKey = JSON.stringify(input);
  const { mutate: requestPreview } = preview;

  // Espera a que el usuario deje de escribir antes de pedir el cálculo al backend.
  useEffect(() => {
    if (!input) return;
    const timer = setTimeout(() => requestPreview(input), PREVIEW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input, requestPreview]);

  // No mostrar un cronograma viejo si los datos ya cambiaron.
  const previewIsCurrent = preview.data && JSON.stringify(preview.variables) === inputKey;

  const noAccounts = accounts.isSuccess && !accounts.data.some((a) => a.is_active);
  const noBorrowers = borrowers.isSuccess && borrowers.data.length === 0;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setTriedSubmit(true);
    if (!input || borrower === "" || account === "") return;
    create.mutate(
      { ...input, borrower, account, notes: notes.trim() },
      { onSuccess: (loan) => navigate(`/loans/${loan.id}`) },
    );
  }

  if (noAccounts || noBorrowers) {
    return (
      <>
        <PageHeader title="Nuevo préstamo" />
        {noAccounts ? (
          <EmptyState
            title="Primero crea una cuenta"
            action={<Link to="/accounts" className="btn btn-primary">Ir a Cuentas</Link>}
          />
        ) : (
          <EmptyState
            title="Primero registra un deudor"
            action={<Link to="/borrowers" className="btn btn-primary">Ir a Deudores</Link>}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Link to="/loans" className="text-sm text-muted underline-offset-4 hover:underline">
        Todos los préstamos
      </Link>
      <PageHeader title="Nuevo préstamo" />

      <form onSubmit={onSubmit} className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-4 md:grid-cols-2">
          <label className="field md:col-span-2">
            <span>Deudor</span>
            <select className="input" required value={borrower} onChange={(e) => setBorrower(Number(e.target.value))}>
              <option value="" disabled>
                Elige a quién le prestas
              </option>
              {(borrowers.data ?? []).map((b) => (
                <option key={b.id} value={b.id}>
                  {b.full_name}
                </option>
              ))}
            </select>
          </label>
          <div className="md:col-span-2">
            <AccountSelect label="Cuenta de origen" value={account} onChange={setAccount} />
          </div>
          <label className="field">
            <span>Capital prestado</span>
            <input className="input tabular" inputMode="decimal" required value={principal} onChange={(e) => setPrincipal(e.target.value)} />
          </label>
          <label className="field">
            <span>Tasa de interés (%)</span>
            <input className="input tabular" inputMode="decimal" required value={rate} onChange={(e) => setRate(e.target.value)} />
          </label>
          <fieldset className="grid gap-2 md:col-span-2">
            <legend className="mb-1 text-sm font-semibold">Cómo se cobra el interés</legend>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" className="mt-1.5" checked={mode === "TOTAL"} onChange={() => setMode("TOTAL")} />
              <span>
                Una sola vez sobre el capital
                <span className="block text-sm text-muted">1.000.000 al 20 % = se devuelven 1.200.000</span>
              </span>
            </label>
            <label className="flex items-start gap-2">
              <input type="radio" name="mode" className="mt-1.5" checked={mode === "PER_PERIOD"} onChange={() => setMode("PER_PERIOD")} />
              <span>
                Por cada cuota
                <span className="block text-sm text-muted">1.000.000 al 10 % mensual en 6 cuotas = 600.000 de interés</span>
              </span>
            </label>
          </fieldset>
          <label className="field">
            <span>Número de cuotas</span>
            <input className="input tabular" type="number" min={1} max={1000} required value={count} onChange={(e) => setCount(e.target.value)} />
          </label>
          <label className="field">
            <span>Frecuencia</span>
            <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as Frequency)}>
              {Object.entries(FREQUENCY_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="field md:col-span-2">
            <span>Fecha de inicio</span>
            <input className="input" type="date" required value={start} onChange={(e) => setStart(e.target.value)} />
          </label>
          <label className="field md:col-span-2">
            <span>Notas</span>
            <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Opcional" />
          </label>
          <div className="grid gap-3 md:col-span-2">
            {triedSubmit && errors.length > 0 && (
              <ul role="alert" className="border-l-4 border-red bg-sheet px-4 py-3 text-sm text-red">
                {errors.map((e) => (
                  <li key={e}>{e}</li>
                ))}
              </ul>
            )}
            <ErrorMessage error={create.error} />
            <div>
              <button type="submit" className="btn btn-primary" disabled={create.isPending}>
                Crear préstamo
              </button>
            </div>
          </div>
        </div>

        <div className="content-start">
          {previewIsCurrent && preview.data ? (
            <SchedulePreview preview={preview.data} />
          ) : (
            <p className="border border-dashed border-rule p-5 text-muted">
              Completa capital, tasa, cuotas y fecha para ver las cuotas antes de crear el préstamo.
            </p>
          )}
          <div className="mt-3">
            <ErrorMessage error={preview.error} />
          </div>
        </div>
      </form>
    </>
  );
}
