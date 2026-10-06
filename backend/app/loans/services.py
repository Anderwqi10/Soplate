from dataclasses import dataclass
from datetime import date as Date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce

from core.exceptions import BusinessError
from core.money import q2
from ledger.models import Account, TransactionKind
from ledger.services import account_balance, record_transaction
from loans.domain import (InstallmentState, InstallmentStatus, LoanStatus, allocate_payments, build_schedule,
                          days_overdue, loan_status)
from loans.models import Borrower, CloseReason, Installment, Loan, Payment


@dataclass
class LoanSummary:
    interest_total: Decimal
    total_amount: Decimal
    installment_amount: Decimal
    paid_total: Decimal
    outstanding: Decimal
    outstanding_principal: Decimal
    end_date: Date
    status: str
    days_overdue: int
    next_due_date: Date | None
    installments: list[InstallmentState]


def loans_with_totals():
    """Préstamos con lo necesario para resumirlos en pocas consultas (sin N+1)."""
    zero = Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2))
    return (Loan.objects.select_related("borrower", "account").prefetch_related("installments")
            .annotate(paid_total=Coalesce(Sum("payments__amount"), zero)))


def _paid_total(loan: Loan) -> Decimal:
    # Si la consulta ya trajo la suma (annotate), se reutiliza y se evita otra consulta.
    paid = getattr(loan, "paid_total", None)
    if paid is None:
        paid = loan.payments.aggregate(total=Sum("amount"))["total"]
    return q2(paid or 0)


def summarize_loan(loan: Loan, today: Date) -> LoanSummary:
    paid = _paid_total(loan)
    states = allocate_payments(list(loan.installments.all()), paid, today)
    total = sum((s.amount for s in states), Decimal("0.00"))
    pending = [s for s in states if s.status != InstallmentStatus.PAID]
    return LoanSummary(
        interest_total=sum((s.interest_amount for s in states), Decimal("0.00")),
        total_amount=total,
        installment_amount=states[0].amount,
        paid_total=paid,
        outstanding=total - paid,
        # Parte de capital de lo que falta, con la proporción capital/total del préstamo completo
        # (redondear cuota por cuota acumulaba centavos de error).
        outstanding_principal=q2((total - paid) * sum(s.principal_amount for s in states) / total),
        end_date=states[-1].due_date,
        status=loan_status(states, today),
        days_overdue=days_overdue(states, today),
        next_due_date=pending[0].due_date if pending else None,
        installments=states,
    )


@db_transaction.atomic
def create_loan(*, owner, borrower: Borrower, account: Account, principal: Decimal, interest_rate: Decimal,
                interest_mode: str, installments_count: int, frequency: str, start_date: Date,
                notes: str = "") -> Loan:
    """Crea préstamo + cuotas + salida de dinero de la cuenta. Todo o nada."""
    if borrower.owner_id != owner.id or account.owner_id != owner.id:
        raise BusinessError("El deudor o la cuenta no existen.")
    principal = q2(principal)
    if principal > account_balance(account):
        raise BusinessError("Saldo insuficiente en la cuenta")
    loan = Loan.objects.create(
        owner=owner, borrower=borrower, account=account, principal=principal, interest_rate=interest_rate,
        interest_mode=interest_mode, installments_count=installments_count, frequency=frequency,
        start_date=start_date, notes=notes,
    )
    schedule = build_schedule(principal, interest_rate, interest_mode, installments_count, frequency, start_date)
    Installment.objects.bulk_create([
        Installment(loan=loan, number=s.number, due_date=s.due_date, principal_amount=s.principal_amount,
                    interest_amount=s.interest_amount, amount=s.amount)
        for s in schedule
    ])
    record_transaction(owner=owner, account=account, kind=TransactionKind.LOAN_DISBURSEMENT, amount=principal,
                       date=start_date, loan=loan, description=f"Préstamo a {borrower.full_name}")
    return loan


@db_transaction.atomic
def register_payment(*, owner, loan: Loan, amount: Decimal, date: Date, account: Account | None = None,
                     note: str = "") -> Payment:
    """Registra dinero recibido: movimiento de entrada en la cuenta + pago del préstamo."""
    if loan.owner_id != owner.id:
        raise BusinessError("El préstamo no existe.")
    # Bloquea el préstamo: dos pagos simultáneos (p. ej. doble clic) no pueden superar el saldo.
    loan = Loan.objects.select_for_update().get(pk=loan.pk)
    account = account or loan.account
    amount = q2(amount)
    if date < loan.start_date:
        raise BusinessError("La fecha del pago es anterior al inicio del préstamo")
    total = loan.installments.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    paid = loan.payments.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    if amount > total - paid:
        raise BusinessError("El pago supera el saldo pendiente")
    tx = record_transaction(owner=owner, account=account, kind=TransactionKind.LOAN_PAYMENT, amount=amount,
                            date=date, loan=loan, description=f"Pago de {loan.borrower.full_name}")
    return Payment.objects.create(loan=loan, account=account, transaction=tx, amount=amount, date=date, note=note)


def _lock_open_loan(owner, loan: Loan) -> Loan:
    """Bloquea el préstamo para cerrarlo; falla si es ajeno o ya fue cerrado."""
    if loan.owner_id != owner.id:
        raise BusinessError("El préstamo no existe.")
    loan = Loan.objects.select_for_update().get(pk=loan.pk)
    if loan.closed_at:
        raise BusinessError("Este préstamo ya fue cerrado.")
    return loan


def _close(loan: Loan, reason: str, today: Date, written_off: Decimal | None = None) -> Loan:
    loan.closed_at = today
    loan.close_reason = reason
    loan.written_off_amount = written_off
    loan.save(update_fields=["closed_at", "close_reason", "written_off_amount"])
    return loan


@db_transaction.atomic
def settle_loan(*, owner, loan: Loan, today: Date, account: Account | None = None) -> Loan:
    """El deudor paga todo lo pendiente hoy: entra a la cuenta y el préstamo se cierra."""
    loan = _lock_open_loan(owner, loan)
    summary = summarize_loan(loan, today)
    if summary.status not in (LoanStatus.ACTIVE, LoanStatus.OVERDUE):
        raise BusinessError("Solo se puede liquidar un préstamo al día o retrasado.")
    register_payment(owner=owner, loan=loan, amount=summary.outstanding, date=today, account=account,
                     note="Liquidación del préstamo")
    return _close(loan, CloseReason.SETTLED, today)


@db_transaction.atomic
def write_off_loan(*, owner, loan: Loan, today: Date) -> Loan:
    """Lo que no se pagó pasa a pérdida; las cuentas no cambian (ese dinero salió al prestar)."""
    loan = _lock_open_loan(owner, loan)
    summary = summarize_loan(loan, today)
    if summary.status not in (LoanStatus.OVERDUE, LoanStatus.DEFAULTED):
        raise BusinessError("Solo se puede reportar como pérdida un préstamo retrasado o vencido.")
    return _close(loan, CloseReason.WRITTEN_OFF, today, written_off=summary.outstanding)


@db_transaction.atomic
def delete_loan(*, owner, loan: Loan, today: Date) -> Loan:
    """Quita de la lista un préstamo ya pagado; sus pagos siguen contando en las cuentas."""
    loan = _lock_open_loan(owner, loan)
    if summarize_loan(loan, today).status != LoanStatus.PAID:
        raise BusinessError("Solo se puede eliminar un préstamo pagado. Liquídalo o repórtalo como pérdida.")
    return _close(loan, CloseReason.DELETED, today)
