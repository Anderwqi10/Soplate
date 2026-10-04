/** Página temporal hasta que su tarea del plan la construya. */
export default function PlaceholderPage({ title }: { title: string }) {
  return (
    <section className="grid gap-2">
      <h1 className="text-3xl font-bold">{title}</h1>
      <p className="text-muted">Esta sección se construye en el siguiente paso.</p>
    </section>
  );
}
