import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";

const NAV = [
  { to: "/", label: "Resumen", end: true },
  { to: "/accounts", label: "Cuentas", end: false },
  { to: "/borrowers", label: "Deudores", end: false },
  { to: "/loans", label: "Préstamos", end: false },
  { to: "/projection", label: "Proyección", end: false },
];

/**
 * Escritorio: columna lateral fija. Celular: barra superior con el nombre y
 * barra inferior de pestañas al alcance del pulgar (se cobra en la calle).
 */
export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[13rem_1fr]">
      <header className="flex items-center justify-between border-b border-rule px-4 py-3 md:hidden">
        <span className="font-display text-xl font-bold">Soplate</span>
        <button type="button" onClick={logout} className="text-sm text-muted underline-offset-4 hover:underline">
          Cerrar sesión
        </button>
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col border-r border-rule px-4 py-6 md:flex">
        <span className="px-3 font-display text-2xl font-bold">Soplate</span>
        <nav aria-label="Principal" className="mt-8 grid gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `border-l-[3px] px-3 py-2 ${isActive ? "border-ledger font-semibold text-ink" : "border-transparent text-muted hover:text-ink"}`
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button type="button" onClick={logout} className="mt-auto px-3 py-2 text-left text-muted hover:text-ink">
          Cerrar sesión
        </button>
      </aside>

      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-24 md:px-10 md:py-10">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 grid grid-cols-5 border-t border-rule bg-paper md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `border-t-[3px] py-3 text-center text-xs ${isActive ? "border-ledger font-semibold text-ink" : "border-transparent text-muted"}`
            }
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
