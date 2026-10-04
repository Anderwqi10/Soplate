import { useState, type FormEvent } from "react";
import type { ManualTransactionKind } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import { normalizeAmount } from "../../lib/amount";
import { todayISO } from "../../lib/format";
import { TRANSACTION_KIND_LABEL } from "../../lib/status";
import AccountSelect from "./AccountSelect";
import { useCreateTransaction } from "./api";

// Los demás tipos (préstamos, transferencias) los crea el sistema.
const MANUAL_KINDS: ManualTransactionKind[] = ["DEPOSIT", "WITHDRAWAL", "INCOME", "EXPENSE"];

export default function TransactionForm({ onDone, defaultAccount }: { onDone(): void; defaultAccount?: number }) {
  const create = useCreateTransaction();
  const [account, setAccount] = useState<number | "">(defaultAccount ?? "");
  const [kind, setKind] = useState<ManualTransactionKind>("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (account === "") return;
    create.mutate({ account, kind, amount: normalizeAmount(amount) ?? amount.trim(), date, description: description.trim() }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <AccountSelect label="Cuenta" value={account} onChange={setAccount} />
      <label className="field">
        <span>Tipo</span>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as ManualTransactionKind)}>
          {MANUAL_KINDS.map((k) => (
            <option key={k} value={k}>
              {TRANSACTION_KIND_LABEL[k]}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Monto</span>
        <input className="input tabular" inputMode="decimal" required value={amount} onChange={(e) => setAmount(e.target.value)} />
      </label>
      <label className="field">
        <span>Fecha</span>
        <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <label className="field md:col-span-2">
        <span>Descripción</span>
        <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Opcional" />
      </label>
      <div className="grid gap-3 md:col-span-2">
        <ErrorMessage error={create.error} />
        <div>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            Registrar movimiento
          </button>
        </div>
      </div>
    </form>
  );
}
