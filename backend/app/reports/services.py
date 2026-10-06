"""Reportes de solo lectura: balance general y proyección de saldo."""
from collections import Counter
from datetime import date, timedelta
from decimal import Decimal

from core.exceptions import BusinessError
from core.money import money_str, q2
from ledger.models import Account
from loans.domain import InstallmentStatus, LoanStatus
from loans.services import loans_with_totals, summarize_loan

ZERO = Decimal("0.00")
UPCOMING_DAYS = 7


def _summaries(owner, today: date, include_closed: bool = False):
    loans = loans_with_totals().filter(owner=owner)
    if not include_closed:
        loans = loans.open()
    return [(loan, summarize_loan(loan, today)) for loan in loans]


def dashboard(owner, today: date) -> dict:
    accounts = list(Account.objects.filter(owner=owner, is_active=True).with_balance())
    total_balance = sum((a.balance for a in accounts), ZERO)
    all_summaries = _summaries(owner, today, include_closed=True)
    # Lo pendiente y los estados solo cuentan préstamos abiertos; los cerrados ya no se cobran.
    summaries = [(loan, s) for loan, s in all_summaries if loan.closed_at is None]

    outstanding = sum((s.outstanding for _, s in summaries), ZERO)
    outstanding_principal = sum((s.outstanding_principal for _, s in summaries), ZERO)
    # Cada peso cobrado trae capital e interés en la misma proporción que el total del préstamo.
    # Incluye préstamos cerrados: lo que ya se cobró fue ganancia real.
    interest_earned = sum((q2(s.paid_total * s.interest_total / s.total_amount) for _, s in all_summaries), ZERO)
    losses = sum((loan.written_off_amount or ZERO for loan, _ in all_summaries), ZERO)
    by_status = Counter(s.status for _, s in summaries)

    upcoming, overdue = [], []
    horizon = today + timedelta(days=UPCOMING_DAYS)
    for loan, s in summaries:
        for inst in s.installments:
            row = {"loan_id": loan.id, "borrower_name": loan.borrower.full_name, "number": inst.number,
                   "due_date": inst.due_date.isoformat(), "remaining": money_str(inst.remaining)}
            if inst.status == InstallmentStatus.OVERDUE:
                overdue.append({**row, "days_overdue": (today - inst.due_date).days})
            elif inst.status != InstallmentStatus.PAID and today <= inst.due_date <= horizon:
                upcoming.append(row)

    return {
        "total_balance": money_str(total_balance),
        "outstanding_total": money_str(outstanding),
        "outstanding_principal": money_str(outstanding_principal),
        "interest_earned": money_str(interest_earned),
        "losses_total": money_str(losses),
        "net_worth": money_str(total_balance + outstanding),
        "accounts": [{"id": a.id, "name": a.name, "balance": money_str(a.balance)} for a in accounts],
        "loans_by_status": {st: by_status.get(st, 0) for st in LoanStatus.values},
        "upcoming": sorted(upcoming, key=lambda r: r["due_date"]),
        "overdue": sorted(overdue, key=lambda r: r["due_date"]),
    }


def projection(owner, target_date: date, today: date, include_overdue: bool = False) -> dict:
    if target_date < today:
        raise BusinessError("La fecha debe ser hoy o posterior")

    rows = {a.id: {"id": a.id, "name": a.name, "current_balance": a.balance, "expected": ZERO, "overdue": ZERO}
            for a in Account.objects.filter(owner=owner, is_active=True).with_balance()}

    for loan, s in _summaries(owner, today):
        row = rows.setdefault(loan.account_id, {
            "id": loan.account_id, "name": loan.account.name, "current_balance": ZERO, "expected": ZERO,
            "overdue": ZERO})
        for inst in s.installments:
            if inst.status == InstallmentStatus.OVERDUE:
                row["overdue"] += inst.remaining
            elif inst.status != InstallmentStatus.PAID and today <= inst.due_date <= target_date:
                row["expected"] += inst.remaining

    def projected(r):
        return r["current_balance"] + r["expected"] + (r["overdue"] if include_overdue else ZERO)

    values = list(rows.values())
    return {
        "date": target_date.isoformat(),
        "current_balance": money_str(sum((r["current_balance"] for r in values), ZERO)),
        "expected_inflows": money_str(sum((r["expected"] for r in values), ZERO)),
        "overdue_amount": money_str(sum((r["overdue"] for r in values), ZERO)),
        "projected_balance": money_str(sum((projected(r) for r in values), ZERO)),
        "by_account": [
            {"id": r["id"], "name": r["name"], "current_balance": money_str(r["current_balance"]),
             "expected_inflows": money_str(r["expected"]), "projected_balance": money_str(projected(r))}
            for r in values
        ],
    }
