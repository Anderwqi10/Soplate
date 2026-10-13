import { useState } from "react";
import { useNavigate } from "react-router";
import type { LoanDetail, LoanStatus } from "../../api/types";
import ConfirmBox from "../../components/ConfirmBox";
import { formatMoney } from "../../lib/format";
import AccountSelect from "../accounts/AccountSelect";
import { useAccounts } from "../accounts/api";
import { useDeleteLoan, useSettleLoan, useWriteOffLoan } from "./api";

type Action = "settle" | "writeOff" | "delete";

// Qué se puede hacer según el estado (acordado con el usuario).
const ALLOWED: Record<LoanStatus, Action[]> = {
  ACTIVE: ["settle"],
  OVERDUE: ["settle", "writeOff"],
  DEFAULTED: ["writeOff"],
  PAID: ["delete"],
};

const BUTTON: Record<Action, string> = {
  settle: "Liquidar préstamo",
  writeOff: "Reportar como pérdida",
  delete: "Eliminar préstamo",
};

export default function LoanActions({ loan }: { loan: LoanDetail }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState<Action | null>(null);
  const settle = useSettleLoan(loan.id);
  const writeOff = useWriteOffLoan(loan.id);
  const remove = useDeleteLoan(loan.id);

  const { data: accounts = [] } = useAccounts();
  const loanAccountIsActive = accounts.some((a) => a.id === loan.account && a.is_active);
  const [chosenAccount, setAccount] = useState<number | null>(null);
  const account: number | "" = chosenAccount ?? (loanAccountIsActive ? loan.account : "");
  const accountName = accounts.find((a) => a.id === account)?.name ?? "la cuenta que elijas";

  const leave = (notice: string) => navigate("/loans", { state: { notice } });
  const who = loan.borrower_name;
  const close = () => {
    setOpen(null);
    [settle, writeOff, remove].forEach((m) => m.reset());
  };

  return (
    <section className="grid gap-3">
      <h2 className="text-xl font-semibold">Cerrar préstamo</h2>

      {!open && (
        <div className="flex flex-wrap gap-2">
          {ALLOWED[loan.status].map((action) => (
            <button
              key={action}
              type="button"
              className={`btn btn-quiet ${action === "settle" ? "" : "text-red"}`}
              onClick={() => setOpen(action)}
            >
              {BUTTON[action]}
            </button>
          ))}
        </div>
      )}

      {open === "settle" && (
        <ConfirmBox
          title={`¿Liquidar el préstamo de ${who}?`}
          confirmLabel="Sí, liquidar"
          pending={settle.isPending}
          confirmDisabled={account === ""}
          error={settle.error}
          onCancel={close}
          onConfirm={() => account !== "" && settle.mutate(account, { onSuccess: () => leave(`El préstamo de ${who} se liquidó.`) })}
        >
          <p className="mb-3">
            Se registrará hoy un pago de <strong className="tabular">{formatMoney(loan.outstanding)}</strong> en {accountName}{" "}
            y el préstamo desaparecerá de la lista.
          </p>
          <AccountSelect label="Cuenta donde entra el dinero" value={account} onChange={setAccount} />
          {account === "" && <p className="mt-2 text-red">Elige la cuenta donde entra el dinero.</p>}
        </ConfirmBox>
      )}

      {open === "writeOff" && (
        <ConfirmBox
          danger
          title={`¿Reportar como pérdida el préstamo de ${who}?`}
          confirmLabel="Sí, reportar pérdida"
          pending={writeOff.isPending}
          error={writeOff.error}
          onCancel={close}
          onConfirm={() => writeOff.mutate(undefined, { onSuccess: () => leave(`El préstamo de ${who} se reportó como pérdida.`) })}
        >
          <p>
            <strong className="tabular">{formatMoney(loan.outstanding)}</strong> quedarán como pérdida y el préstamo desaparecerá
            de la lista. Tus cuentas no cambian: ese dinero ya había salido al prestarlo.
          </p>
        </ConfirmBox>
      )}

      {open === "delete" && (
        <ConfirmBox
          danger
          title={`¿Eliminar el préstamo de ${who}?`}
          confirmLabel="Sí, eliminar"
          pending={remove.isPending}
          error={remove.error}
          onCancel={close}
          onConfirm={() => remove.mutate(undefined, { onSuccess: () => leave(`El préstamo de ${who} se eliminó.`) })}
        >
          <p>Ya está pagado. Desaparecerá de la lista y tus cuentas no cambian.</p>
        </ConfirmBox>
      )}
    </section>
  );
}
