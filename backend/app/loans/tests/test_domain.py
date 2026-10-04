"""Cálculos de préstamos sin base de datos: cronograma, reparto FIFO y estados."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import pytest

from loans.domain import add_periods, allocate_payments, build_schedule, days_overdue, loan_status


def test_total_mode_monthly_from_jan_31():
    s = build_schedule(Decimal("1000000"), Decimal("20"), "TOTAL", 3, "MONTHLY", date(2026, 1, 31))
    assert [i.due_date for i in s] == [date(2026, 2, 28), date(2026, 3, 31), date(2026, 4, 30)]
    assert [i.principal_amount for i in s] == [Decimal("333333.33"), Decimal("333333.33"), Decimal("333333.34")]
    assert [i.interest_amount for i in s] == [Decimal("66666.67"), Decimal("66666.67"), Decimal("66666.66")]
    assert all(i.amount == Decimal("400000.00") for i in s)


def test_rounding_last_installment_absorbs_difference():
    s = build_schedule(Decimal("100"), Decimal("0"), "TOTAL", 3, "DAILY", date(2026, 1, 1))
    assert [i.amount for i in s] == [Decimal("33.33"), Decimal("33.33"), Decimal("33.34")]
    assert [i.due_date for i in s] == [date(2026, 1, 2), date(2026, 1, 3), date(2026, 1, 4)]


def test_per_period_interest():
    s = build_schedule(Decimal("1000000"), Decimal("10"), "PER_PERIOD", 6, "MONTHLY", date(2026, 1, 1))
    assert sum(i.interest_amount for i in s) == Decimal("600000.00")
    assert sum(i.amount for i in s) == Decimal("1600000.00")
    assert s[0].amount == Decimal("266666.67") and s[-1].amount == Decimal("266666.65")


def test_weekly_and_biweekly_dates():
    assert add_periods(date(2026, 1, 1), "WEEKLY", 1) == date(2026, 1, 8)
    assert add_periods(date(2026, 1, 1), "BIWEEKLY", 2) == date(2026, 1, 31)


@dataclass
class Row:
    number: int
    due_date: date
    amount: Decimal
    principal_amount: Decimal
    interest_amount: Decimal


@pytest.fixture
def three():
    return [Row(n, d, Decimal("100"), Decimal("80"), Decimal("20"))
            for n, d in [(1, date(2026, 1, 10)), (2, date(2026, 1, 20)), (3, date(2026, 1, 30))]]


def test_allocate_fifo_partial(three):
    st = allocate_payments(three, Decimal("150"), today=date(2026, 1, 15))
    assert [(x.paid_amount, x.remaining, x.status) for x in st] == [
        (Decimal("100.00"), Decimal("0.00"), "PAID"),
        (Decimal("50.00"), Decimal("50.00"), "PARTIAL"),
        (Decimal("0.00"), Decimal("100.00"), "PENDING")]


def test_partial_becomes_overdue_after_due_date(three):
    st = allocate_payments(three, Decimal("150"), today=date(2026, 1, 25))
    assert st[1].status == "OVERDUE"


@pytest.mark.parametrize("paid,today,expected", [
    ("150", date(2026, 1, 15), "ACTIVE"),
    ("50", date(2026, 1, 15), "OVERDUE"),
    ("0", date(2026, 1, 10), "ACTIVE"),  # vence hoy: aún no está retrasada
    ("150", date(2026, 2, 1), "DEFAULTED"),
    ("300", date(2026, 2, 1), "PAID"),
])
def test_loan_status(three, paid, today, expected):
    assert loan_status(allocate_payments(three, Decimal(paid), today), today) == expected


def test_days_overdue(three):
    today = date(2026, 1, 15)
    assert days_overdue(allocate_payments(three, Decimal("0"), today), today) == 5
    assert days_overdue(allocate_payments(three, Decimal("100"), today), today) == 0
