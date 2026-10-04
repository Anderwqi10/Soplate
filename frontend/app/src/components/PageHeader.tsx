import type { ReactNode } from "react";

export default function PageHeader({ title, actions }: { title: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-3xl font-bold md:text-4xl">{title}</h1>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </header>
  );
}
