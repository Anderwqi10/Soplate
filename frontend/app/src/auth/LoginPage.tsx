import { useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router";
import type { InstallmentStatus } from "../api/types";
import CobroCard from "../components/CobroCard";
import ErrorMessage from "../components/ErrorMessage";
import { useAuth } from "./AuthContext";

// Una tarjeta de cobro de muestra: 24 cuotas, casi todas selladas, una atrasada.
const SAMPLE: { number: number; status: InstallmentStatus }[] = Array.from({ length: 24 }, (_, i) => ({
  number: i + 1,
  status: i < 15 ? "PAID" : i === 15 ? "PARTIAL" : i === 16 ? "OVERDUE" : "PENDING",
}));

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = (location.state as { from?: string } | null)?.from ?? "/";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<unknown>(null);
  const [submitting, setSubmitting] = useState(false);

  if (isAuthenticated) return <Navigate to={from} replace />;

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(username, password);
      navigate(from, { replace: true });
    } catch (e) {
      setError(e);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="mx-auto grid min-h-dvh max-w-5xl content-center gap-12 px-4 py-10 md:grid-cols-[1fr_22rem] md:gap-16">
      <section className="grid content-center gap-6">
        <h1 className="text-5xl font-bold tracking-tight md:text-7xl">Soplate</h1>
        <p className="max-w-md text-lg text-muted">Tus préstamos, tus cuotas y tus cuentas, al día y en un solo lugar.</p>
        <div className="max-w-md">
          <CobroCard installments={SAMPLE} animate />
        </div>
      </section>

      <form onSubmit={onSubmit} className="grid content-center gap-5">
        <h2 className="text-2xl font-semibold">Entrar</h2>
        <label className="field">
          <span>Usuario</span>
          <input
            className="input"
            autoComplete="username"
            required
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Contraseña</span>
          <input
            className="input"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
        <ErrorMessage error={error} />
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? "Ingresando…" : "Ingresar"}
        </button>
      </form>
    </main>
  );
}
