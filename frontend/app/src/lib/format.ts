import type { ISODate, Money } from "../api/types";
import { CURRENCY, LOCALE } from "../config";

// Sin centavos: "$ 400.000". Con centavos, siempre dos cifras: "$ 33,30" (no "$ 33,3").
const wholeMoney = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, maximumFractionDigits: 0 });
const centsMoney = new Intl.NumberFormat(LOCALE, { style: "currency", currency: CURRENCY, minimumFractionDigits: 2 });

const shortDate = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

/** "1200000.00" → "$ 1.200.000". Solo da formato: no hace cuentas con el dinero. */
export function formatMoney(value: Money | number): string {
  const amount = Number(value);
  return (Number.isInteger(amount) ? wholeMoney : centsMoney).format(amount);
}

/** Parsea "AAAA-MM-DD" como fecha local: `new Date("2026-02-28")` sería UTC y en Bogotá mostraría el 27. */
export function parseISODate(iso: ISODate): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d);
}

/** "2026-02-28" → "28 feb 2026". */
export function formatDate(iso: ISODate): string {
  return shortDate.format(parseISODate(iso)).replace(/\./g, "");
}

function toISODate(date: Date): ISODate {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO(): ISODate {
  return toISODate(new Date());
}

/** Suma (o resta) días a una fecha "AAAA-MM-DD", cruzando meses y años. */
export function addDaysISO(iso: ISODate, days: number): ISODate {
  const date = parseISODate(iso);
  date.setDate(date.getDate() + days);
  return toISODate(date);
}
