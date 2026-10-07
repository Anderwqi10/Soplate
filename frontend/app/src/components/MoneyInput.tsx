import { useLayoutEffect, useRef, type InputHTMLAttributes } from "react";
import { formatAmountInput } from "../lib/amount";

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "value" | "onChange" | "type"> & {
  /** Texto mostrado, ya formateado ("$ 1.000.000"). Se convierte con normalizeAmount al enviar. */
  value: string;
  onChange(value: string): void;
};

const isSignificant = (ch: string) => /[\d,]/.test(ch);

/** Posición en `text` justo después de la cifra (o coma) número `count`. */
function positionAfter(text: string, count: number): number {
  if (count === 0) return text.indexOf(" ") + 1 || 0; // después de "$ "
  let seen = 0;
  for (let i = 0; i < text.length; i++) {
    if (isSignificant(text[i]) && ++seen === count) return i + 1;
  }
  return text.length;
}

/** Campo de dinero: pone "$" y los puntos de miles mientras se escribe, sin que el cursor salte. */
export default function MoneyInput({ value, onChange, className = "", ...rest }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const pendingCaret = useRef<number | null>(null);

  // Después de reformatear, devolver el cursor junto a la cifra que se acaba de escribir.
  useLayoutEffect(() => {
    if (pendingCaret.current !== null && ref.current && document.activeElement === ref.current) {
      ref.current.setSelectionRange(pendingCaret.current, pendingCaret.current);
    }
    pendingCaret.current = null;
  }, [value]);

  return (
    <input
      {...rest}
      ref={ref}
      type="text"
      inputMode="decimal"
      autoComplete="off"
      className={`input tabular ${className}`}
      value={value}
      onChange={(e) => {
        const typed = e.target.value;
        const caret = e.target.selectionStart ?? typed.length;
        // Contar cifras antes del cursor: los puntos cambian de sitio, las cifras no.
        const digitsBefore = [...typed.slice(0, caret)].filter(isSignificant).length;
        const formatted = formatAmountInput(typed);
        pendingCaret.current = positionAfter(formatted, digitsBefore);
        onChange(formatted);
      }}
    />
  );
}
