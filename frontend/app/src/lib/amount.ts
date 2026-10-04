/**
 * Convierte un monto escrito por una persona al formato que entiende la API ("1000000.50").
 * Acepta la forma colombiana: puntos de miles y coma decimal ("1.000.000,50", "1,5"),
 * además de la forma simple ("1000000", "20.5"). Devuelve null si no es un monto.
 */
export function normalizeAmount(raw: string): string | null {
  const s = raw.trim().replace(/^\$/, "").replace(/\s/g, "");
  if (!s) return null;

  const THOUSANDS = /^\d{1,3}(\.\d{3})+$/; // 1.000.000

  if (s.includes(",")) {
    const parts = s.split(",");
    if (parts.length !== 2) return null;
    const [whole, cents] = parts;
    if (!/^\d{1,2}$/.test(cents)) return null;
    if (/^\d+$/.test(whole)) return `${whole}.${cents}`;
    if (THOUSANDS.test(whole)) return `${whole.replace(/\./g, "")}.${cents}`;
    return null;
  }

  if (/^\d+$/.test(s)) return s;
  if (THOUSANDS.test(s)) return s.replace(/\./g, "");
  if (/^\d+\.\d{1,2}$/.test(s)) return s; // punto decimal: 20.5
  return null;
}
