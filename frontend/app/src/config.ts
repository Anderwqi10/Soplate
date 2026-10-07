// Único lugar donde se configuran la API, el idioma y la moneda.

/**
 * Sin VITE_API_URL, la API se busca en el mismo equipo desde el que se abrió la app (puerto 8000).
 * Así funciona igual en el computador (localhost) y en el celular por WiFi (IP del computador).
 */
export function apiUrlFor(location: Pick<Location, "protocol" | "hostname">): string {
  return `${location.protocol}//${location.hostname}:8000/api`;
}

export const API_URL: string = import.meta.env.VITE_API_URL ?? apiUrlFor(window.location);
export const LOCALE = "es-CO";
export const CURRENCY = "COP";
