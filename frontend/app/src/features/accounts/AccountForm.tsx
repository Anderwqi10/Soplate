import { useState, type FormEvent } from "react";
import type { AccountKind } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import MoneyInput from "../../components/MoneyInput";
import { normalizeAmount } from "../../lib/amount";
import { ACCOUNT_KIND_LABEL } from "../../lib/status";
import { useCreateAccount } from "./api";

export default function AccountForm({ onDone }: { onDone(): void }) {
  const create = useCreateAccount();
  const [name, setName] = useState("");
  const [kind, setKind] = useState<AccountKind>("BANK");
  const [initialBalance, setInitialBalance] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    create.mutate({ name: name.trim(), kind, initial_balance: normalizeAmount(initialBalance) ?? (initialBalance.trim() || "0") }, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-3">
      <label className="field">
        <span>Nombre</span>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Bancolombia" />
      </label>
      <label className="field">
        <span>Tipo</span>
        <select className="input" value={kind} onChange={(e) => setKind(e.target.value as AccountKind)}>
          {Object.entries(ACCOUNT_KIND_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Saldo inicial</span>
        <MoneyInput value={initialBalance} onChange={setInitialBalance} placeholder="$ 0" />
      </label>
      <div className="grid gap-3 md:col-span-3">
        <ErrorMessage error={create.error} />
        <div>
          <button type="submit" className="btn btn-primary" disabled={create.isPending}>
            Crear cuenta
          </button>
        </div>
      </div>
    </form>
  );
}
