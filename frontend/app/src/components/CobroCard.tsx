import type { InstallmentStatus } from "../api/types";
import { INSTALLMENT_STATUS } from "../lib/status";

const CELL: Record<InstallmentStatus, string> = {
  PAID: "bg-ledger text-on-ledger border-ledger",
  PARTIAL: "border-amber text-ink [background:linear-gradient(to_top,var(--color-amber)_50%,transparent_50%)]",
  OVERDUE: "border-red text-red [background:linear-gradient(to_top_right,transparent_calc(50%-1px),var(--color-red)_50%,transparent_calc(50%+1px))]",
  PENDING: "border-rule text-muted",
};

interface Props {
  installments: { number: number; status: InstallmentStatus }[];
  /** Sella las cuotas pagadas una tras otra al aparecer (solo en la pantalla de entrada). */
  animate?: boolean;
  label?: string;
}

/**
 * La tarjeta de cobro: cada cuota es un cuadrito que se sella al pagarse,
 * como las tarjetas de cartón que usan los prestamistas.
 */
export default function CobroCard({ installments, animate = false, label }: Props) {
  return (
    <ol
      aria-label={label}
      aria-hidden={label ? undefined : true}
      className="grid grid-cols-[repeat(auto-fill,minmax(2.25rem,1fr))] gap-1.5"
    >
      {installments.map((inst, i) => (
        <li
          key={inst.number}
          title={`Cuota ${inst.number}: ${INSTALLMENT_STATUS[inst.status].label}`}
          className={`tabular grid aspect-square place-items-center rounded-[2px] border text-xs font-semibold ${CELL[inst.status]} ${
            animate && inst.status === "PAID" ? "animate-[stamp_320ms_ease-out_both]" : ""
          }`}
          style={animate ? { animationDelay: `${i * 45}ms` } : undefined}
        >
          {inst.number}
        </li>
      ))}
    </ol>
  );
}
