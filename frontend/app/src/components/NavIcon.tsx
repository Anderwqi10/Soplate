/** Íconos del menú: trazos simples de 24×24 que heredan el color del texto. */
const PATHS: Record<string, string> = {
  home: "M4 11.5 12 5l8 6.5V19a1 1 0 0 1-1 1h-4.5v-5h-5v5H5a1 1 0 0 1-1-1z",
  wallet: "M4 7.5A2.5 2.5 0 0 1 6.5 5H18v3M4 7.5V17a2 2 0 0 0 2 2h13a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H6.5A2.5 2.5 0 0 1 4 7.5Zm12.5 6h.01",
  people: "M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1.5-9a3 3 0 1 0 0-6m1.5 15h3a5.5 5.5 0 0 0-4-5.3",
  loan: "M3 7h18v10H3zM7 7v10m10-10v10M12 10a2 2 0 1 0 0 4 2 2 0 0 0 0-4Z",
  chart: "M4 19h16M5 15l4-4 3 3 6-7m0 0h-3.5M18 7v3.5",
};

export type NavIconName = keyof typeof PATHS;

export default function NavIcon({ name, className = "size-6" }: { name: NavIconName; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className}>
      <path d={PATHS[name]} />
    </svg>
  );
}
