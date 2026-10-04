"""Reglas de cálculo de préstamos, sin base de datos (fáciles de probar y de cambiar).

- build_schedule: genera el cronograma de cuotas (interés simple sobre el capital).
- allocate_payments: reparte lo pagado sobre las cuotas, de la más vieja a la más nueva (FIFO).
- loan_status / days_overdue: derivan el estado a partir del reparto y la fecha de hoy.
"""
from dataclasses import dataclass
from datetime import date, timedelta
from decimal import Decimal
from typing import Protocol, Sequence

from dateutil.relativedelta import relativedelta
from django.db import models

from core.money import q2

ZERO = Decimal("0.00")


class Frequency(models.TextChoices):
    DAILY = "DAILY", "Diaria"
    WEEKLY = "WEEKLY", "Semanal"
    BIWEEKLY = "BIWEEKLY", "Quincenal"
    MONTHLY = "MONTHLY", "Mensual"


class InterestMode(models.TextChoices):
    TOTAL = "TOTAL", "Una sola vez sobre el capital"
    PER_PERIOD = "PER_PERIOD", "Por cada cuota"


class LoanStatus(models.TextChoices):
    ACTIVE = "ACTIVE", "Al día"
    OVERDUE = "OVERDUE", "Retrasado"
    DEFAULTED = "DEFAULTED", "Vencido"
    PAID = "PAID", "Pagado"


class InstallmentStatus(models.TextChoices):
    PENDING = "PENDING", "Pendiente"
    PARTIAL = "PARTIAL", "Parcial"
    OVERDUE = "OVERDUE", "Vencida"
    PAID = "PAID", "Pagada"


def add_periods(start: date, frequency: str, k: int) -> date:
    """Fecha de la cuota k. Siempre desde `start` (no encadenado) para que el 31-ene no derive."""
    if frequency == Frequency.DAILY:
        return start + timedelta(days=k)
    if frequency == Frequency.WEEKLY:
        return start + timedelta(days=7 * k)
    if frequency == Frequency.BIWEEKLY:
        return start + timedelta(days=15 * k)
    if frequency == Frequency.MONTHLY:
        return start + relativedelta(months=k)
    raise ValueError(f"Frecuencia desconocida: {frequency}")


@dataclass(frozen=True)
class ScheduledInstallment:
    number: int
    due_date: date
    principal_amount: Decimal
    interest_amount: Decimal
    amount: Decimal


def interest_total(principal: Decimal, interest_rate: Decimal, interest_mode: str,
                   installments_count: int) -> Decimal:
    base = Decimal(principal) * Decimal(interest_rate) / 100
    if interest_mode == InterestMode.PER_PERIOD:
        base *= installments_count
    return q2(base)


def _split(total: Decimal, n: int) -> list[Decimal]:
    """Divide en n partes de 2 decimales; la última absorbe el redondeo para que la suma sea exacta."""
    part = q2(total / n)
    return [part] * (n - 1) + [q2(total) - part * (n - 1)]


def build_schedule(principal: Decimal, interest_rate: Decimal, interest_mode: str,
                   installments_count: int, frequency: str, start_date: date) -> list[ScheduledInstallment]:
    principals = _split(Decimal(principal), installments_count)
    interests = _split(interest_total(principal, interest_rate, interest_mode, installments_count),
                       installments_count)
    return [
        ScheduledInstallment(
            number=k,
            due_date=add_periods(start_date, frequency, k),
            principal_amount=p,
            interest_amount=i,
            amount=p + i,
        )
        for k, (p, i) in enumerate(zip(principals, interests), start=1)
    ]


class InstallmentLike(Protocol):
    number: int
    due_date: date
    amount: Decimal
    principal_amount: Decimal
    interest_amount: Decimal


@dataclass(frozen=True)
class InstallmentState:
    number: int
    due_date: date
    amount: Decimal
    principal_amount: Decimal
    interest_amount: Decimal
    paid_amount: Decimal
    remaining: Decimal
    status: str


def allocate_payments(installments: Sequence[InstallmentLike], total_paid: Decimal,
                      today: date) -> list[InstallmentState]:
    available = q2(total_paid)
    states = []
    for inst in sorted(installments, key=lambda i: i.number):
        amount = q2(inst.amount)
        paid = min(available, amount)
        available -= paid
        remaining = amount - paid
        if remaining == 0:
            status = InstallmentStatus.PAID
        elif inst.due_date < today:
            status = InstallmentStatus.OVERDUE
        elif paid > 0:
            status = InstallmentStatus.PARTIAL
        else:
            status = InstallmentStatus.PENDING
        states.append(InstallmentState(
            number=inst.number, due_date=inst.due_date, amount=amount,
            principal_amount=q2(inst.principal_amount), interest_amount=q2(inst.interest_amount),
            paid_amount=paid, remaining=remaining, status=status.value,
        ))
    return states


def loan_status(states: list[InstallmentState], today: date) -> str:
    if all(s.remaining == 0 for s in states):
        return LoanStatus.PAID.value
    if today > states[-1].due_date:
        return LoanStatus.DEFAULTED.value
    if any(s.status == InstallmentStatus.OVERDUE for s in states):
        return LoanStatus.OVERDUE.value
    return LoanStatus.ACTIVE.value


def days_overdue(states: list[InstallmentState], today: date) -> int:
    overdue = [s.due_date for s in states if s.status == InstallmentStatus.OVERDUE]
    return (today - min(overdue)).days if overdue else 0
