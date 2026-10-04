import type { InstallmentStatus, LoanStatus } from "../api/types";
import { INSTALLMENT_STATUS, LOAN_STATUS, type Tone } from "../lib/status";

const TONE_CLASS: Record<Tone, string> = {
  green: "text-ledger",
  amber: "text-amber",
  red: "text-red",
  gray: "text-muted",
};

type Props =
  | { kind: "loan"; status: LoanStatus }
  | { kind: "installment"; status: InstallmentStatus };

/** Estado = color + palabra (nunca solo color). El cuadrito repite la forma de la tarjeta de cobro. */
export default function StatusBadge(props: Props) {
  const { label, tone } = props.kind === "loan" ? LOAN_STATUS[props.status] : INSTALLMENT_STATUS[props.status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${TONE_CLASS[tone]}`}>
      <span aria-hidden="true" className="size-2 bg-current" />
      {label}
    </span>
  );
}
