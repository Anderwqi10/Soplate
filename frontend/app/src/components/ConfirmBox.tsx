import { useEffect, useRef, type ReactNode } from "react";
import ErrorMessage from "./ErrorMessage";

interface Props {
  title: string;
  /** Qué va a pasar, con cifras reales: la persona confirma sabiendo el efecto. */
  children: ReactNode;
  confirmLabel: string;
  onConfirm(): void;
  onCancel(): void;
  pending?: boolean;
  error?: unknown;
  danger?: boolean;
}

/** Segundo paso obligatorio antes de una acción que no se puede deshacer. */
export default function ConfirmBox({ title, children, confirmLabel, onConfirm, onCancel, pending, error, danger }: Props) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  // El foco empieza en "volver": confirmar exige un movimiento deliberado.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <div
      role="alertdialog"
      aria-label={title}
      onKeyDown={(e) => e.key === "Escape" && onCancel()}
      className={`grid gap-3 border border-t-[3px] bg-sheet p-4 ${danger ? "border-rule border-t-red" : "border-rule border-t-ledger"}`}
    >
      <p className="font-semibold">{title}</p>
      <div className="text-sm">{children}</div>
      <ErrorMessage error={error} />
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={`btn ${danger ? "bg-red text-paper" : "btn-primary"}`}
          disabled={pending}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
        <button ref={cancelRef} type="button" className="btn btn-quiet" onClick={onCancel}>
          No, volver
        </button>
      </div>
    </div>
  );
}
