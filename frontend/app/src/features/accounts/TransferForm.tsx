import { useState, type FormEvent } from "react";
import ErrorMessage from "../../components/ErrorMessage";
import { todayISO } from "../../lib/format";
import AccountSelect from "./AccountSelect";
import { useCreateTransfer } from "./api";

export default function TransferForm({ onDone }: { onDone(): void }) {
  const transfer = useCreateTransfer();
  const [from, setFrom] = useState<number | "">("");
  const [to, setTo] = useState<number | "">("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (from === "" || to === "") return;
    transfer.mutate(
      { from_account: from, to_account: to, amount: amount.trim(), date, description: description.trim() },
      { onSuccess: onDone },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <AccountSelect label="Desde" value={from} onChange={setFrom} />
      <AccountSelect label="Hacia" value={to} onChange={setTo} />
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
        <ErrorMessage error={transfer.error} />
        <div>
          <button type="submit" className="btn btn-primary" disabled={transfer.isPending}>
            Transferir
          </button>
        </div>
      </div>
    </form>
  );
}
