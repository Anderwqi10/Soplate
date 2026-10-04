import { useState } from "react";
import { Link, useParams } from "react-router";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import Panel from "../../components/Panel";
import { formatDate, formatMoney } from "../../lib/format";
import { ACCOUNT_KIND_LABEL, TRANSACTION_KIND_LABEL } from "../../lib/status";
import { useAccount, useTransactions, useUpdateAccount } from "./api";
import TransactionForm from "./TransactionForm";

export default function AccountDetailPage() {
  const id = Number(useParams().id);
  const account = useAccount(id);
  const transactions = useTransactions({ account: id });
  const update = useUpdateAccount(id);
  const [adding, setAdding] = useState(false);

  if (account.isPending) return <p className="text-muted">Cargando cuenta…</p>;
  if (account.isError) return <ErrorMessage error={account.error} />;

  const acc = account.data;
  const rows = transactions.data ?? [];

  return (
    <>
      <Link to="/accounts" className="text-sm text-muted underline-offset-4 hover:underline">
        Todas las cuentas
      </Link>
      <PageHeader
        title={acc.name}
        actions={
          <>
            {acc.is_active && (
              <button type="button" className="btn btn-primary" onClick={() => setAdding(true)}>
                Movimiento
              </button>
            )}
            <button
              type="button"
              className="btn btn-quiet"
              disabled={update.isPending}
              onClick={() => update.mutate({ is_active: !acc.is_active })}
            >
              {acc.is_active ? "Archivar cuenta" : "Reactivar cuenta"}
            </button>
          </>
        }
      />

      <div className="mb-8 flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
        <span className="text-muted">
          {ACCOUNT_KIND_LABEL[acc.kind]}
          {!acc.is_active && " (archivada)"}
        </span>
        <span className={`tabular font-display text-3xl font-bold md:text-4xl ${acc.balance.startsWith("-") ? "text-red" : ""}`}>
          {formatMoney(acc.balance)}
        </span>
      </div>

      <div className="mb-6">
        <ErrorMessage error={update.error} />
      </div>

      {adding && (
        <div className="mb-8">
          <Panel title="Nuevo movimiento" onClose={() => setAdding(false)}>
            <TransactionForm defaultAccount={id} onDone={() => setAdding(false)} />
          </Panel>
        </div>
      )}

      <h2 className="mb-2 text-xl font-semibold">Movimientos</h2>
      <ErrorMessage error={transactions.error} />
      {transactions.isSuccess && rows.length === 0 && <EmptyState title="Esta cuenta aún no tiene movimientos" />}
      {rows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="border-b-2 border-ink text-sm text-muted">
              <tr>
                <th className="py-2 pr-4 font-semibold">Fecha</th>
                <th className="py-2 pr-4 font-semibold">Detalle</th>
                <th className="py-2 text-right font-semibold">Monto</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((tx) => {
                const negative = tx.amount.startsWith("-");
                return (
                  <tr key={tx.id} className="border-b border-rule align-top">
                    <td className="py-3 pr-4 whitespace-nowrap">{formatDate(tx.date)}</td>
                    <td className="py-3 pr-4">
                      <span className="block">{TRANSACTION_KIND_LABEL[tx.kind]}</span>
                      {tx.description && <span className="block text-sm text-muted">{tx.description}</span>}
                      {tx.loan && (
                        <Link to={`/loans/${tx.loan}`} className="text-sm text-ledger underline-offset-4 hover:underline">
                          Ver préstamo
                        </Link>
                      )}
                    </td>
                    <td className={`py-3 text-right whitespace-nowrap ${negative ? "text-red" : "text-ledger"}`}>
                      {negative ? "" : "+"}
                      {formatMoney(tx.amount)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
