import { useQueryClient } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { login as apiLogin, tokenStore } from "../api/client";

interface AuthValue {
  isAuthenticated: boolean;
  login(username: string, password: string): Promise<void>;
  logout(): void;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [isAuthenticated, setAuthenticated] = useState(() => tokenStore.get().access !== null);

  const login = useCallback(async (username: string, password: string) => {
    await apiLogin(username, password);
    setAuthenticated(true);
  }, []);

  // Al salir se borra la memoria de datos: quien entre después no debe ver ni un instante lo anterior.
  const logout = useCallback(() => {
    tokenStore.clear();
    queryClient.clear();
    setAuthenticated(false);
  }, [queryClient]);

  // El cliente API avisa cuando la sesión expiró y no se pudo renovar.
  useEffect(() => {
    const onExpired = () => {
      queryClient.clear();
      setAuthenticated(false);
    };
    window.addEventListener("soplate:logout", onExpired);
    return () => window.removeEventListener("soplate:logout", onExpired);
  }, [queryClient]);

  const value = useMemo(() => ({ isAuthenticated, login, logout }), [isAuthenticated, login, logout]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth debe usarse dentro de <AuthProvider>");
  return value;
}
