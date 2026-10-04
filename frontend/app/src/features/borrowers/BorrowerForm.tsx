import { useState, type FormEvent } from "react";
import type { Borrower, BorrowerInput } from "../../api/types";
import ErrorMessage from "../../components/ErrorMessage";
import { useCreateBorrower, useUpdateBorrower } from "./api";

const EMPTY: BorrowerInput = { full_name: "", document_id: "", phone: "", address: "", notes: "" };

/** Crea un deudor, o edita uno existente si se pasa `borrower`. */
export default function BorrowerForm({ borrower, onDone }: { borrower?: Borrower; onDone(): void }) {
  const create = useCreateBorrower();
  const update = useUpdateBorrower(borrower?.id ?? 0);
  const mutation = borrower ? update : create;
  const [form, setForm] = useState<BorrowerInput>(() =>
    borrower
      ? { full_name: borrower.full_name, document_id: borrower.document_id, phone: borrower.phone,
          address: borrower.address, notes: borrower.notes }
      : EMPTY,
  );

  const set = (field: keyof BorrowerInput) => (e: { target: { value: string } }) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const body = Object.fromEntries(Object.entries(form).map(([k, v]) => [k, v.trim()])) as BorrowerInput;
    mutation.mutate(body, { onSuccess: onDone });
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-4 md:grid-cols-2">
      <label className="field md:col-span-2">
        <span>Nombre completo</span>
        <input className="input" required value={form.full_name} onChange={set("full_name")} />
      </label>
      <label className="field">
        <span>Documento</span>
        <input className="input" value={form.document_id} onChange={set("document_id")} placeholder="Opcional" />
      </label>
      <label className="field">
        <span>Teléfono</span>
        <input className="input" type="tel" value={form.phone} onChange={set("phone")} placeholder="Opcional" />
      </label>
      <label className="field md:col-span-2">
        <span>Dirección</span>
        <input className="input" value={form.address} onChange={set("address")} placeholder="Opcional" />
      </label>
      <label className="field md:col-span-2">
        <span>Notas</span>
        <textarea className="input" rows={2} value={form.notes} onChange={set("notes")} placeholder="Opcional" />
      </label>
      <div className="grid gap-3 md:col-span-2">
        <ErrorMessage error={mutation.error} />
        <div>
          <button type="submit" className="btn btn-primary" disabled={mutation.isPending}>
            Guardar deudor
          </button>
        </div>
      </div>
    </form>
  );
}
