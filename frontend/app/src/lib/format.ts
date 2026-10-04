import type { ISODate, Money } from "../api/types";
import { CURRENCY, LOCALE } from "../config";

const money = new Intl.NumberFormat(LOCALE, {
  style: "currency",
  currency: CURRENCY,
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const shortDate = new Intl.DateTimeFormat(LOCALE, { day: "numeric", month: "short", year: "numeric" });

/** "1200000.00" → "$ 1.200.000". Solo da formato: no hace cuentas con el dinero. */
export function formatMoney(value: Money | number): string {
  return money.format(Number(value));
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

export function todayISO(): ISODate {
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}
