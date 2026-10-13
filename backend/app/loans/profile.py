"""Perfil del deudor: todos sus préstamos (incluidos los cerrados) y su historial de cumplimiento."""
from datetime import date
from decimal import Decimal

from core.money import money_str
from loans.domain import Punctuality, borrower_rating, installment_punctuality
from loans.models import Borrower
from loans.serializers import BorrowerSerializer
from loans.services import loans_with_totals, summarize_loan

ZERO = Decimal("0.00")


def borrower_profile(borrower: Borrower, today: date) -> dict:
    loans = loans_with_totals().filter(borrower=borrower).prefetch_related("payments")
    on_time = late = 0
    late_days: list[int] = []
    lent = collected = outstanding = losses = ZERO
    rows = []

    for loan in loans:
        summary = summarize_loan(loan, today)
        payments = [(p.date, p.amount) for p in loan.payments.all()]
        # Un préstamo cerrado se evalúa a la fecha de cierre: no sigue "atrasándose" después.
        as_of = today if loan.closed_at is None else min(today, loan.closed_at)
        for p in installment_punctuality(loan.installments.all(), payments, as_of):
            if p.status == Punctuality.ON_TIME:
                on_time += 1
            elif p.status == Punctuality.LATE:
                late += 1
                late_days.append(p.days_late)

        is_open = loan.closed_at is None
        lent += loan.principal
        collected += summary.paid_total
        outstanding += summary.outstanding if is_open else ZERO
        losses += loan.written_off_amount or ZERO
        rows.append({
            "id": loan.id,
            "start_date": loan.start_date.isoformat(),
            "end_date": summary.end_date.isoformat(),
            "principal": money_str(loan.principal),
            "total_amount": money_str(summary.total_amount),
            "paid_total": money_str(summary.paid_total),
            "outstanding": money_str(summary.outstanding if is_open else ZERO),
            # Abiertos: estado calculado (ACTIVE, OVERDUE...). Cerrados: por qué se cerraron.
            "status": summary.status if is_open else loan.close_reason,
            "is_open": is_open,
        })

    counted = on_time + late
    return {
        "borrower": BorrowerSerializer(borrower).data,
        "rating": borrower_rating(on_time, late, has_write_off=losses > 0),
        "on_time_count": on_time,
        "late_count": late,
        "on_time_percent": round(100 * on_time / counted) if counted else None,
        "avg_days_late": round(sum(late_days) / len(late_days)) if late_days else 0,
        "total_lent": money_str(lent),
        "total_collected": money_str(collected),
        "outstanding": money_str(outstanding),
        "losses": money_str(losses),
        "loans": rows,
    }
