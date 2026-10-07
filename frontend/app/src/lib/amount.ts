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

/**
 * Texto que se muestra en un campo de dinero mientras se escribe: "$ 1.000.000,5".
 * Solo se conservan cifras y una coma (centavos, máximo 2); los puntos de miles se ponen solos.
 */
export function formatAmountInput(typed: string): string {
  const cleaned = typed.replace(/[^\d,]/g, "");
  if (!cleaned) return "";
  const commaAt = cleaned.indexOf(",");
  const rawWhole = commaAt === -1 ? cleaned : cleaned.slice(0, commaAt);
  const cents = commaAt === -1 ? null : cleaned.slice(commaAt + 1).replace(/,/g, "").slice(0, 2);
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `$ ${grouped}${cents === null ? "" : `,${cents}`}`;
}

/** Un monto de la API ("400000.00") listo para editar en un campo de dinero ("$ 400.000"). */
export function amountToInput(apiAmount: string): string {
  const [whole, decimals = ""] = apiAmount.replace("-", "").split(".");
  const cents = decimals.padEnd(2, "0").slice(0, 2);
  return formatAmountInput(Number(cents) === 0 ? whole : `${whole},${cents}`);
}
