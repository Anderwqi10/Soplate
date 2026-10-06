import { useState } from "react";
import { Link } from "react-router";
import type { Account } from "../../api/types";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Notice from "../../components/Notice";
import PageHeader from "../../components/PageHeader";
import Panel from "../../components/Panel";
import { formatMoney } from "../../lib/format";
import { ACCOUNT_KIND_LABEL } from "../../lib/status";
import { useDashboard } from "../dashboard/api";
import AccountForm from "./AccountForm";
import { useAccounts } from "./api";
import TransactionForm from "./TransactionForm";
import TransferForm from "./TransferForm";

type Open = "account" | "transaction" | "transfer" | null;

const PANEL_TITLE: Record<Exclude<Open, null>, string> = {
  account: "Nueva cuenta",
  transaction: "Nuevo movimiento",
  transfer: "Transferir entre cuentas",
};

/** Un renglón del libro: nombre y tipo a la izquierda, saldo a la derecha. */
function AccountRow({ account }: { account: Account }) {
  const negative = account.balance.startsWith("-");
  return (
    <li className="border-b border-rule">
      <Link to={`/accounts/${account.id}`} className="flex items-baseline justify-between gap-4 py-4 hover:bg-sheet">
        <span className="grid">
          <span className="font-semibold">{account.name}</span>
          <span className="text-sm text-muted">{ACCOUNT_KIND_LABEL[account.kind]}</span>
        </span>
        <span data-testid={`balance-${account.id}`} className={`tabular font-display text-xl ${negative ? "text-red" : ""}`}>
          {formatMoney(account.balance)}
        </span>
      </Link>
    </li>
  );
}

export default function AccountsPage() {
  const accounts = useAccounts();
  const dashboard = useDashboard();
  const [open, setOpen] = useState<Open>(null);
  const close = () => setOpen(null);

  const list = accounts.data ?? [];
  const active = list.filter((a) => a.is_active);
  const archived = list.filter((a) => !a.is_active);
  const hasAccounts = active.length > 0;

  return (
    <>
      <PageHeader
        title="Cuentas"
        actions={
          <>
            <button type="button" className="btn btn-quiet" onClick={() => setOpen("account")}>
              Nueva cuenta
            </button>
            {hasAccounts && (
              <>
                <button type="button" className="btn btn-quiet" onClick={() => setOpen("transaction")}>
                  Movimiento
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setOpen("transfer")}>
                  Transferir
                </button>
              </>
            )}
          </>
        }
      />

      {open && (
        <div className="mb-8">
          {/* key: al cambiar de formulario se monta un panel nuevo y el foco entra al primer campo */}
          <Panel key={open} title={PANEL_TITLE[open]} onClose={close}>
            {open === "account" && <AccountForm onDone={close} />}
            {open === "transaction" && <TransactionForm onDone={close} />}
            {open === "transfer" && <TransferForm onDone={close} />}
          </Panel>
        </div>
      )}

      <Notice />
      <ErrorMessage error={accounts.error} />

      {accounts.isPending && <p className="text-muted">Cargando cuentas…</p>}

      {accounts.isSuccess && !hasAccounts && archived.length === 0 && open !== "account" && (
        <EmptyState
          title="Aún no tienes cuentas"
          action={
            <button type="button" className="btn btn-primary" onClick={() => setOpen("account")}>
              Nueva cuenta
            </button>
          }
        />
      )}

      {hasAccounts && (
        <section aria-label="Cuentas activas">
          <div className="flex items-baseline justify-between gap-4 border-b-2 border-ink pb-3">
            <span className="text-muted">Dinero disponible</span>
            <span data-testid="total-balance" className="tabular font-display text-3xl font-bold md:text-4xl">
              {dashboard.data ? formatMoney(dashboard.data.total_balance) : "…"}
            </span>
          </div>
          <ul>
            {active.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </ul>
        </section>
      )}

      {archived.length > 0 && (
        <section className="mt-10 text-muted">
          <h2 className="text-lg font-semibold">Archivadas</h2>
          <ul>
            {archived.map((a) => (
              <AccountRow key={a.id} account={a} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
