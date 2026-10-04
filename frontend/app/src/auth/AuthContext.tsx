import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, tokenStore } from "../api/client";

interface AuthValue {
  isAuthenticated: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setAuthenticated] = useState(() => tokenStore.get().access !== null);

  const login = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    setAuthenticated(true);
  }, []);

  const logout = useCallback(() => {
    tokenStore.clear();
    setAuthenticated(false);
  }, []);

  // El cliente API avisa cuando la sesión expiró y no se pudo renovar.
  useEffect(() => {
    const onExpired = () => setAuthenticated(false);
    window.addEventListener("soplate:logout", onExpired);
    return () => window.removeEventListener("soplate:logout", onExpired);
  }, []);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return value;
}
