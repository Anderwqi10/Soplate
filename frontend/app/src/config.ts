// Único lugar donde se configuran la API, el idioma y la moneda.

/**
 * Sin VITE_API_URL: con el servidor de desarrollo de Vite (puerto 5173) la API está en el puerto 8000
 * del mismo equipo; servida por Django (app compilada), la API está en el mismo origen.
 */
export function apiUrlFor(location: Pick<Location, "protocol" | "hostname" | "port" | "origin">): string {
  if (location.port === "5173") return `${location.protocol}//${location.hostname}:8000/api`;
  return `${location.origin}/api`;
}

export const API_URL: string = import.meta.env.VITE_API_URL ?? apiUrlFor(window.location);
export const LOCALE = "es-CO";
export const CURRENCY = "COP";
