import { formatMoney } from "../../lib/format";
import { useAccounts } from "./api";

interface Props {
  label: string;
  value: number | "";
  onChange(id: number): void;
}

/** Selector de cuentas activas (las archivadas no reciben movimientos), con su saldo a la vista. */
export default function AccountSelect({ label, value, onChange }: Props) {
  const { data = [] } = useAccounts();
  return (
    <label className="field">
      <span>{label}</span>
      <select className="input" required value={value} onChange={(e) => onChange(Number(e.target.value))}>
        <option value="" disabled>
          Elige una cuenta
        </option>
        {data
          .filter((a) => a.is_active)
          .map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} ({formatMoney(a.balance)})
            </option>
          ))}
      </select>
    </label>
  );
}
