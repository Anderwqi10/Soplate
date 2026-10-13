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
    if (!/^\d{0,2}$/.test(cents)) return null; // "1.000," (coma recién escrita) vale 1000
    const join = cents ? `.${cents}` : "";
    if (/^\d+$/.test(whole)) return `${whole}${join}`;
    if (THOUSANDS.test(whole)) return `${whole.replace(/\./g, "")}${join}`;
    return null;
  }

  if (/^\d+$/.test(s)) return s;
  if (THOUSANDS.test(s)) return s.replace(/\./g, "");
  if (/^\d+\.\d{1,2}$/.test(s)) return s; // punto decimal: 20.5
  const decimalAfterThousands = /^(\d{1,3}(?:\.\d{3})+)\.(\d{1,2})$/.exec(s); // 1.500.50
  if (decimalAfterThousands) return `${decimalAfterThousands[1].replace(/\./g, "")}.${decimalAfterThousands[2]}`;
  if (/^(\d+|\d{1,3}(\.\d{3})+)\.$/.test(s)) return s.slice(0, -1).replace(/\./g, ""); // "1.000." -> 1000
  return null;
}

const group = (whole: string) => whole.replace(/\B(?=(\d{3})+(?!\d))/g, ".");

/**
 * Un texto sin coma que termina en "." o en un grupo de 1-2 cifras tras el último punto ("1.500.",
 * "1.500.5", "1500.50") todavía no se sabe si es decimal: se deja provisional hasta terminar.
 * Con un grupo final de 3 cifras o más son puntos de miles y se reagrupa como entero.
 */
function parseProvisional(text: string): { whole: string; frac: string } | null {
  if (text.includes(",")) return null;
  const t = text.replace(/[^\d.]/g, "");
  if (!t.includes(".")) return null;
  const groups = t.split(".");
  const frac = groups.pop() as string;
  if (frac.length > 2) return null;
  const [first, ...rest] = groups;
  if (rest.some((g) => g.length !== 3)) return null;
  if (first === "" && groups.length > 1) return null;
  return { whole: groups.join(""), frac };
}

/**
 * Texto que se muestra en un campo de dinero mientras se escribe: "$ 1.000.000,5".
 * Solo se conservan cifras y una coma (centavos, máximo 2); los puntos de miles se ponen solos.
 * Un punto final queda provisional ("$ 1.500.50") hasta que finalizeAmountInput lo decide.
 * `previous` (lo que se veía antes de la tecla) distingue borrar una cifra de "$ 10.000".
 */
export function formatAmountInput(typed: string, previous?: string): string {
  const prov = parseProvisional(typed);
  const isDeletion = previous !== undefined && typed.length < previous.length;
  if (prov && !(isDeletion && parseProvisional(previous) === null)) {
    const whole = prov.whole.replace(/^0+(?=\d)/, "") || "0";
    return `$ ${group(whole)}.${prov.frac}`;
  }
  const cleaned = typed.replace(/[^\d,]/g, "");
  if (!cleaned) return "";
  const commaAt = cleaned.indexOf(",");
  const rawWhole = commaAt === -1 ? cleaned : cleaned.slice(0, commaAt);
  const cents = commaAt === -1 ? null : cleaned.slice(commaAt + 1).replace(/,/g, "").slice(0, 2);
  const whole = rawWhole.replace(/^0+(?=\d)/, "") || "0";
  return `$ ${group(whole)}${cents === null ? "" : `,${cents}`}`;
}

/** Al terminar de escribir (blur): el punto provisional pasa a coma decimal, o se descarta si está solo. */
export function finalizeAmountInput(shown: string): string {
  const prov = parseProvisional(shown);
  if (!prov) return shown;
  const whole = prov.whole.replace(/^0+(?=\d)/, "") || "0";
  return `$ ${group(whole)}${prov.frac ? `,${prov.frac}` : ""}`;
}

/** Un monto de la API ("400000.00") listo para editar en un campo de dinero ("$ 400.000"). */
export function amountToInput(apiAmount: string): string {
  const [whole, decimals = ""] = apiAmount.replace("-", "").split(".");
  const cents = decimals.padEnd(2, "0").slice(0, 2);
  return formatAmountInput(Number(cents) === 0 ? whole : `${whole},${cents}`);
}
