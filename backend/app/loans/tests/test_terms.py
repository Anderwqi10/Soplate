"""Cambiar la tasa o la fecha de inicio de un préstamo: se recalcula todo y lo pagado se reparte de nuevo."""
from datetime import date
from decimal import Decimal

import pytest

from core.exceptions import BusinessError
from ledger.models import Transaction
from loans.services import register_payment, summarize_loan, update_loan_terms, write_off_loan

pytestmark = pytest.mark.django_db

TODAY = date(2026, 3, 1)


def test_new_rate_recalculates_the_whole_loan(user, loan_factory):
    loan = loan_factory()  # 1.000.000 al 20 %, 3 cuotas mensuales desde el 31-ene
    register_payment(owner=user, loan=loan, amount=Decimal("400000"), date=date(2026, 2, 28))
    update_loan_terms(owner=user, loan=loan, interest_rate=Decimal("10"), today=TODAY)
    loan.refresh_from_db()
    s = summarize_loan(loan, TODAY)
    assert loan.interest_rate == Decimal("10.00")
    assert s.total_amount == Decimal("1100000.00") and s.installment_amount == Decimal("366666.66")
    assert s.outstanding == Decimal("700000.00")  # lo pagado se reparte sobre las cuotas nuevas
    assert loan.installments.count() == 3


def test_new_start_date_moves_every_installment_and_the_disbursement(user, loan_factory):
    loan = loan_factory()
    update_loan_terms(owner=user, loan=loan, start_date=date(2026, 2, 15), today=TODAY)
    loan.refresh_from_db()
    assert loan.start_date == date(2026, 2, 15)
    assert [i.due_date for i in loan.installments.all()] == [date(2026, 3, 15), date(2026, 4, 15), date(2026, 5, 15)]
    assert Transaction.objects.get(loan=loan, kind="LOAN_DISBURSEMENT").date == date(2026, 2, 15)


def test_start_date_after_a_payment_is_rejected(user, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("100000"), date=date(2026, 2, 10))
    with pytest.raises(BusinessError, match="pagos"):
        update_loan_terms(owner=user, loan=loan, start_date=date(2026, 2, 20), today=TODAY)
    loan.refresh_from_db()
    assert loan.start_date == date(2026, 1, 31)


def test_rate_that_leaves_payments_above_the_new_total_is_rejected(user, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("1200000"), date=date(2026, 2, 1))
    with pytest.raises(BusinessError, match="supera"):
        update_loan_terms(owner=user, loan=loan, interest_rate=Decimal("0"), today=TODAY)
    loan.refresh_from_db()
    assert loan.interest_rate == Decimal("20.00") and loan.installments.count() == 3


def test_closed_loan_cannot_be_edited(user, loan_factory):
    loan = loan_factory()
    write_off_loan(owner=user, loan=loan, today=date(2026, 5, 15))
    with pytest.raises(BusinessError):
        update_loan_terms(owner=user, loan=loan, interest_rate=Decimal("30"), today=TODAY)


def test_api_patch_terms_returns_updated_detail(api, account, borrower):
    loan_id = api.post("/api/loans/", {"borrower": borrower.id, "account": account.id, "principal": "1000000",
                                       "interest_rate": "15", "interest_mode": "TOTAL", "installments_count": 4,
                                       "frequency": "MONTHLY", "start_date": "2026-01-31"}, format="json").json()["id"]
    r = api.patch(f"/api/loans/{loan_id}/terms/", {"interest_rate": "20"}, format="json")
    assert r.status_code == 200
    assert r.json()["interest_rate"] == "20.00" and r.json()["installment_amount"] == "300000.00"


def test_api_patch_terms_needs_a_change(api, account, borrower):
    loan_id = api.post("/api/loans/", {"borrower": borrower.id, "account": account.id, "principal": "1000",
                                       "interest_rate": "0", "interest_mode": "TOTAL", "installments_count": 1,
                                       "frequency": "MONTHLY", "start_date": "2026-01-31"}, format="json").json()["id"]
    assert api.patch(f"/api/loans/{loan_id}/terms/", {}, format="json").status_code == 400
