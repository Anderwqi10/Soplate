import { useState } from "react";
import { Link } from "react-router";
import type { Borrower } from "../../api/types";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import Panel from "../../components/Panel";
import { useBorrowers, useDeleteBorrower } from "./api";
import BorrowerForm from "./BorrowerForm";

type Editing = { mode: "new" } | { mode: "edit"; borrower: Borrower } | null;

export default function BorrowersPage() {
  const borrowers = useBorrowers();
  const remove = useDeleteBorrower();
  const [editing, setEditing] = useState<Editing>(null);
  const [confirming, setConfirming] = useState<number | null>(null);
  const list = borrowers.data ?? [];

  function startNew() {
    remove.reset();
    setEditing({ mode: "new" });
  }

  return (
    <>
      <PageHeader
        title="Deudores"
        actions={
          <button type="button" className="btn btn-primary" onClick={startNew}>
            Nuevo deudor
          </button>
        }
      />

      {editing && (
        <div className="mb-8">
          <Panel
            title={editing.mode === "new" ? "Nuevo deudor" : `Editar a ${editing.borrower.full_name}`}
            onClose={() => setEditing(null)}
          >
            <BorrowerForm
              key={editing.mode === "edit" ? editing.borrower.id : "new"}
              borrower={editing.mode === "edit" ? editing.borrower : undefined}
              onDone={() => setEditing(null)}
            />
          </Panel>
        </div>
      )}

      <div className="mb-4 grid gap-3">
        <ErrorMessage error={borrowers.error} />
        <ErrorMessage error={remove.error} />
      </div>

      {borrowers.isPending && <p className="text-muted">Cargando deudores…</p>}

      {borrowers.isSuccess && list.length === 0 && !editing && (
        <EmptyState
          title="Aún no tienes deudores"
          action={
            <button type="button" className="btn btn-primary" onClick={startNew}>
              Nuevo deudor
            </button>
          }
        />
      )}

      {list.length > 0 && (
        <ul className="border-t-2 border-ink">
          {list.map((b) => (
            <li key={b.id} className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-rule py-4">
              <div className="grid">
                <span className="font-semibold">{b.full_name}</span>
                <span className="text-sm text-muted">
                  {[b.document_id && `Doc. ${b.document_id}`, b.phone].filter(Boolean).join(", ") || "Sin datos de contacto"}
                </span>
              </div>
              {confirming === b.id ? (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm">¿Eliminar a {b.full_name}?</span>
                  <button
                    type="button"
                    className="btn btn-quiet text-red"
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(b.id, { onSettled: () => setConfirming(null) })}
                  >
                    Sí, eliminar
                  </button>
                  <button type="button" className="text-sm text-muted underline-offset-4 hover:underline" onClick={() => setConfirming(null)}>
                    No
                  </button>
                </div>
              ) : (
                <div className="flex flex-wrap gap-4 text-sm">
                  <Link to={`/loans?borrower=${b.id}`} className="text-ledger underline-offset-4 hover:underline">
                    Ver préstamos
                  </Link>
                  <button type="button" className="underline-offset-4 hover:underline" onClick={() => setEditing({ mode: "edit", borrower: b })}>
                    Editar
                  </button>
                  <button
                    type="button"
                    aria-label={`Eliminar a ${b.full_name}`}
                    className="text-red underline-offset-4 hover:underline"
                    onClick={() => {
                      remove.reset();
                      setConfirming(b.id);
                    }}
                  >
                    Eliminar
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
