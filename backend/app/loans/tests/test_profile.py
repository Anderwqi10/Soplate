"""Historial de cumplimiento del deudor: cuotas a tiempo o tarde, calificación y totales."""
from dataclasses import dataclass
from datetime import date
from decimal import Decimal

import pytest

from loans.domain import borrower_rating, installment_punctuality
from loans.profile import borrower_profile
from loans.services import register_payment, write_off_loan


@dataclass
class Row:
    number: int
    due_date: date
    amount: Decimal


THREE = [Row(1, date(2026, 1, 10), Decimal("100")), Row(2, date(2026, 1, 20), Decimal("100")),
         Row(3, date(2026, 1, 30), Decimal("100"))]


def test_punctuality_on_time_late_and_unpaid():
    payments = [(date(2026, 1, 9), Decimal("100")), (date(2026, 1, 25), Decimal("100"))]
    result = installment_punctuality(THREE, payments, today=date(2026, 2, 5))
    assert [(p.status, p.days_late) for p in result] == [("ON_TIME", 0), ("LATE", 5), ("LATE", 6)]


def test_installments_not_yet_due_do_not_count():
    result = installment_punctuality(THREE, [], today=date(2026, 1, 15))
    assert [p.status for p in result] == ["LATE", "NOT_DUE", "NOT_DUE"]


def test_one_payment_can_cover_several_installments_on_time():
    result = installment_punctuality(THREE, [(date(2026, 1, 5), Decimal("300"))], today=date(2026, 2, 1))
    assert [p.status for p in result] == ["ON_TIME", "ON_TIME", "ON_TIME"]


@pytest.mark.parametrize("on_time,late,write_off,expected", [
    (9, 1, False, "GOOD"),
    (7, 3, False, "REGULAR"),
    (6, 4, False, "RISKY"),
    (10, 0, True, "RISKY"),
    (0, 0, False, "NO_HISTORY"),
])
def test_rating(on_time, late, write_off, expected):
    assert borrower_rating(on_time, late, write_off) == expected


# --- Perfil completo (con base de datos) ---

@pytest.mark.django_db
def test_profile_counts_punctuality_and_totals(user, borrower, loan_factory):
    loan = loan_factory()  # cuotas de 400.000: 28-feb, 31-mar, 30-abr
    register_payment(owner=user, loan=loan, amount=Decimal("400000"), date=date(2026, 2, 28))  # a tiempo
    register_payment(owner=user, loan=loan, amount=Decimal("400000"), date=date(2026, 4, 5))  # 5 días tarde
    p = borrower_profile(borrower, today=date(2026, 5, 15))  # la 3.ª sigue sin pagar: 15 días tarde
    assert (p["on_time_count"], p["late_count"], p["on_time_percent"]) == (1, 2, 33)
    assert p["avg_days_late"] == 10
    assert p["rating"] == "RISKY"
    assert (p["total_lent"], p["total_collected"], p["outstanding"], p["losses"]) == (
        "1000000.00", "800000.00", "400000.00", "0.00")
    assert [(x["status"], x["is_open"]) for x in p["loans"]] == [("DEFAULTED", True)]


@pytest.mark.django_db
def test_profile_includes_closed_loans_and_losses(user, borrower, loan_factory):
    loan = loan_factory()
    write_off_loan(owner=user, loan=loan, today=date(2026, 5, 15))
    p = borrower_profile(borrower, today=date(2026, 5, 15))
    assert p["rating"] == "RISKY" and p["losses"] == "1200000.00"
    assert p["outstanding"] == "0.00"
    assert [(x["status"], x["is_open"]) for x in p["loans"]] == [("WRITTEN_OFF", False)]


@pytest.mark.django_db
def test_new_borrower_has_no_history(borrower):
    p = borrower_profile(borrower, today=date(2026, 5, 15))
    assert p["rating"] == "NO_HISTORY" and p["on_time_percent"] is None and p["loans"] == []


@pytest.mark.django_db
def test_api_profile_and_isolation(api, other_api, borrower, loan_factory):
    loan_factory()
    r = api.get(f"/api/borrowers/{borrower.id}/profile/")
    assert r.status_code == 200
    assert r.json()["borrower"]["full_name"] == "Luis Pérez" and len(r.json()["loans"]) == 1
    assert other_api.get(f"/api/borrowers/{borrower.id}/profile/").status_code == 404


@pytest.mark.django_db
def test_written_off_loan_punctuality_is_frozen_at_close(user, borrower, loan_factory):
    loan = loan_factory()  # cuotas: 28-feb, 31-mar, 30-abr
    write_off_loan(owner=user, loan=loan, today=date(2026, 3, 5))  # solo la de febrero estaba vencida
    later = borrower_profile(borrower, today=date(2026, 10, 1))
    assert (later["late_count"], later["avg_days_late"]) == (1, 5)
    assert later == borrower_profile(borrower, today=date(2026, 3, 5))
