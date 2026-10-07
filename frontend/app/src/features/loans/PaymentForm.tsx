import { useState, type FormEvent } from "react";
import type { LoanDetail } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import MoneyInput from "../../components/MoneyInput";
import { todayISO } from "../../lib/format";
import { amountToInput, normalizeAmount } from "../../lib/amount";
import AccountSelect from "../accounts/AccountSelect";
import { useAccounts } from "../accounts/api";
import { useCreatePayment } from "./api";

export default function PaymentForm({ loan }: { loan: LoanDetail }) {
  const pay = useCreatePayment(loan.id);
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(todayISO());
  const { data: accounts = [] } = useAccounts();
  // Por defecto, la cuenta del préstamo; si fue archivada, se obliga a elegir otra
  // (si no, la lista mostraría una cuenta y el formulario enviaría otra).
  const loanAccountIsActive = accounts.some((a) => a.id === loan.account && a.is_active);
  const [chosenAccount, setAccount] = useState<number | null>(null);
  const account: number | "" = chosenAccount ?? (loanAccountIsActive ? loan.account : "");
  const [note, setNote] = useState("");
  const next = loan.installments.find((i) => i.status !== "PAID");

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (account === "") return;
    pay.mutate(
      { amount: normalizeAmount(amount) ?? amount.trim(), date, account, note: note.trim() },
      {
        onSuccess: () => {
          setAmount("");
          setNote("");
        },
      },
    );
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <div className="field md:col-span-2">
        <label htmlFor="payment-amount" className="text-sm font-semibold">
          Monto
        </label>
        <div className="flex flex-wrap gap-2">
          <MoneyInput id="payment-amount" className="min-w-0 flex-1" required value={amount} onChange={setAmount} />
          {next && (
            <button type="button" className="btn btn-quiet" onClick={() => setAmount(amountToInput(next.remaining))}>
              Cuota
            </button>
          )}
          <button type="button" className="btn btn-quiet" onClick={() => setAmount(amountToInput(loan.outstanding))}>
            Total
          </button>
        </div>
      </div>
      <label className="field">
        <span>Fecha</span>
        <input className="input" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
      </label>
      <AccountSelect label="Cuenta donde entra" value={account} onChange={setAccount} />
      <label className="field md:col-span-2">
        <span>Nota</span>
        <input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Opcional" />
      </label>
      <div className="grid gap-3 md:col-span-2">
        <ErrorMessage error={pay.error} />
        {pay.isSuccess && <p role="status" className="text-sm text-ledger">Pago registrado.</p>}
        <div>
          <button type="submit" className="btn btn-primary" disabled={pay.isPending}>
            Registrar pago
          </button>
        </div>
      </div>
    </form>
  );
}
