import type { ReactNode } from "react";

/** Pantalla vacía = invitación a actuar, no una tabla vacía. */
export default function EmptyState({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <div className="grid justify-items-start gap-4 border border-dashed border-rule px-6 py-10">
      <p className="font-display text-xl">{title}</p>
      {action}
    </div>
  );
}
