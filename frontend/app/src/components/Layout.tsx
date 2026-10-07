import { NavLink, Outlet } from "react-router";
import { useAuth } from "../auth/AuthContext";
import NavIcon, { type NavIconName } from "./NavIcon";

const NAV: { to: string; label: string; icon: NavIconName; end: boolean }[] = [
  { to: "/", label: "Resumen", icon: "home", end: true },
  { to: "/accounts", label: "Cuentas", icon: "wallet", end: false },
  { to: "/borrowers", label: "Deudores", icon: "people", end: false },
  { to: "/loans", label: "Préstamos", icon: "loan", end: false },
  { to: "/projection", label: "Proyección", icon: "chart", end: false },
];

/**
 * Escritorio: columna lateral azul noche. Celular: barra superior con el nombre y
 * barra inferior de pestañas con ícono y palabra, al alcance del pulgar.
 * La sección activa se marca en naranja, el color de lo que se puede tocar.
 */
export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="min-h-dvh md:grid md:grid-cols-[15rem_1fr]">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-rule bg-sheet px-4 py-3 md:hidden">
        <span className="font-display text-xl font-extrabold tracking-tight text-ink">Soplate</span>
        <button type="button" onClick={logout} className="rounded-lg px-2 py-1 text-sm font-semibold text-muted hover:text-ink">
          Cerrar sesión
        </button>
      </header>

      <aside className="sticky top-0 hidden h-dvh flex-col bg-navy px-4 py-6 text-on-navy md:flex">
        <span className="px-3 font-display text-2xl font-extrabold tracking-tight">Soplate</span>
        <nav aria-label="Principal" className="mt-10 grid gap-1">
          {NAV.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg border-l-[3px] px-3 py-2.5 font-semibold transition-colors ${
                  isActive ? "border-accent bg-navy-soft text-on-navy" : "border-transparent text-on-navy/70 hover:bg-navy-soft/60 hover:text-on-navy"
                }`
              }
            >
              <NavIcon name={item.icon} className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </nav>
        <button
          type="button"
          onClick={logout}
          className="mt-auto rounded-lg px-3 py-2.5 text-left font-semibold text-on-navy/70 hover:bg-navy-soft/60 hover:text-on-navy"
        >
          Cerrar sesión
        </button>
      </aside>

      {/* pb extra en celular: la barra inferior no debe tapar el contenido. */}
      <main className="mx-auto w-full max-w-6xl px-4 pt-6 pb-[calc(6rem+env(safe-area-inset-bottom))] md:px-10 md:py-10">
        <Outlet />
      </main>

      <nav
        aria-label="Principal"
        className="fixed inset-x-0 bottom-0 z-10 grid grid-cols-5 bg-navy pb-[env(safe-area-inset-bottom)] text-on-navy md:hidden"
      >
        {NAV.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.end}
            className={({ isActive }) =>
              `flex flex-col items-center gap-1 border-t-[3px] pt-2 pb-2.5 text-[0.6875rem] font-semibold ${
                isActive ? "border-accent text-accent" : "border-transparent text-on-navy/70"
              }`
            }
          >
            <NavIcon name={item.icon} />
            {item.label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
