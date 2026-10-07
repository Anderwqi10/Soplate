import { useEffect, useRef, type ReactNode } from "react";

/** Hoja que se abre en la página para un formulario. Escape la cierra y el foco entra al abrir. */
export default function Panel({ title, onClose, children }: { title: string; onClose(): void; children: ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("input, select, textarea")?.focus();
  }, []);

  return (
    <section
      ref={ref}
      aria-label={title}
      onKeyDown={(e) => e.key === "Escape" && onClose()}
      className="border border-rule border-t-[3px] border-t-accent bg-sheet p-5"
    >
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xl font-semibold">{title}</h2>
        <button type="button" onClick={onClose} className="text-sm text-muted underline-offset-4 hover:underline">
          Cancelar
        </button>
      </div>
      {children}
    </section>
  );
}
