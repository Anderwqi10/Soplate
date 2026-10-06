import { useLocation } from "react-router";

/** Muestra el resultado de una acción hecha en la pantalla anterior (se pasa en el estado de navegación). */
export default function Notice() {
  const notice = (useLocation().state as { notice?: string } | null)?.notice;
  if (!notice) return null;
  return (
    <p role="status" className="mb-6 border-l-4 border-ledger bg-sheet px-4 py-3">
      {notice}
    </p>
  );
}
