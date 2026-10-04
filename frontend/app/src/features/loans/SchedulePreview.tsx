import type { LoanPreview } from "../../api/types";
import { formatDate, formatMoney } from "../../lib/format";

/** Lo que el deudor va a pagar, calculado por el backend antes de guardar nada. */
export default function SchedulePreview({ preview }: { preview: LoanPreview }) {
  return (
    <section aria-label="Vista previa" className="border border-rule bg-sheet p-5">
      <dl className="grid grid-cols-2 gap-4 border-b-2 border-ink pb-4 md:grid-cols-4">
        <div>
          <dt className="text-sm text-muted">Cuota</dt>
          <dd data-testid="preview-installment" className="tabular font-display text-2xl font-bold">
            {formatMoney(preview.installment_amount)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Total a pagar</dt>
          <dd data-testid="preview-total" className="tabular font-display text-2xl">
            {formatMoney(preview.total_amount)}
          </dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Interés</dt>
          <dd className="tabular text-lg">{formatMoney(preview.interest_total)}</dd>
        </div>
        <div>
          <dt className="text-sm text-muted">Termina</dt>
          <dd className="text-lg">{formatDate(preview.end_date)}</dd>
        </div>
      </dl>
      <div className="mt-2 max-h-72 overflow-y-auto">
        <table className="w-full text-left text-sm">
          <thead className="text-muted">
            <tr>
              <th className="py-2 pr-4 font-semibold">Cuota</th>
              <th className="py-2 pr-4 font-semibold">Fecha</th>
              <th className="py-2 pr-4 text-right font-semibold">Capital</th>
              <th className="py-2 pr-4 text-right font-semibold">Interés</th>
              <th className="py-2 text-right font-semibold">Valor</th>
            </tr>
          </thead>
          <tbody>
            {preview.installments.map((i) => (
              <tr key={i.number} className="border-t border-rule">
                <td className="py-2 pr-4">{i.number}</td>
                <td className="py-2 pr-4 whitespace-nowrap">{formatDate(i.due_date)}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(i.principal_amount)}</td>
                <td className="py-2 pr-4 text-right">{formatMoney(i.interest_amount)}</td>
                <td className="py-2 text-right font-semibold">{formatMoney(i.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
