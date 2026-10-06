"""Cerrar préstamos según su estado: liquidar, reportar pérdida o eliminar."""
from datetime import date
from decimal import Decimal

import pytest

from core.exceptions import BusinessError
from ledger.models import Account
from ledger.services import account_balance
from loans.models import Loan
from loans.services import delete_loan, register_payment, settle_loan, write_off_loan
from reports.services import dashboard, projection

pytestmark = pytest.mark.django_db

# Préstamo por defecto (conftest): 1.000.000 al 20 %, 3 cuotas de 400.000: 28-feb, 31-mar, 30-abr de 2026.
ON_TIME = date(2026, 2, 15)  # al día
LATE = date(2026, 3, 5)  # retrasado: la cuota del 28-feb no se pagó
EXPIRED = date(2026, 5, 15)  # vencido: pasó la última cuota


# --- Liquidar ---

def test_settle_active_loan_pays_outstanding_and_closes(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("400000"), date=date(2026, 2, 10))
    settle_loan(owner=user, loan=loan, today=ON_TIME)
    loan.refresh_from_db()
    assert loan.close_reason == "SETTLED" and loan.closed_at == ON_TIME
    assert account_balance(account) == Decimal("1200000.00")  # 0 tras prestar + 400.000 + 800.000


def test_settle_into_another_account(user, account, loan_factory):
    caja = Account.objects.create(owner=user, name="Caja", kind="CASH")
    loan = loan_factory()
    settle_loan(owner=user, loan=loan, today=LATE, account=caja)
    assert account_balance(caja) == Decimal("1200000.00")


def test_cannot_settle_defaulted_loan(user, loan_factory):
    loan = loan_factory()
    with pytest.raises(BusinessError):
        settle_loan(owner=user, loan=loan, today=EXPIRED)


# --- Reportar pérdida ---

def test_write_off_defaulted_loan_records_loss_without_touching_accounts(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("400000"), date=date(2026, 2, 28))
    write_off_loan(owner=user, loan=loan, today=EXPIRED)
    loan.refresh_from_db()
    assert loan.close_reason == "WRITTEN_OFF" and loan.written_off_amount == Decimal("800000.00")
    assert account_balance(account) == Decimal("400000.00")


def test_write_off_overdue_loan_is_allowed(user, loan_factory):
    loan = loan_factory()
    write_off_loan(owner=user, loan=loan, today=LATE)
    loan.refresh_from_db()
    assert loan.written_off_amount == Decimal("1200000.00")


def test_cannot_write_off_loan_that_is_on_time(user, loan_factory):
    with pytest.raises(BusinessError):
        write_off_loan(owner=user, loan=loan_factory(), today=ON_TIME)


# --- Eliminar ---

def test_delete_paid_loan_keeps_account_balances(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("1200000"), date=date(2026, 2, 1))
    delete_loan(owner=user, loan=loan, today=ON_TIME)
    loan.refresh_from_db()
    assert loan.close_reason == "DELETED"
    assert account_balance(account) == Decimal("1200000.00")


def test_cannot_delete_unpaid_loan(user, loan_factory):
    with pytest.raises(BusinessError):
        delete_loan(owner=user, loan=loan_factory(), today=ON_TIME)


def test_closed_loan_cannot_be_closed_again(user, loan_factory):
    loan = loan_factory()
    write_off_loan(owner=user, loan=loan, today=EXPIRED)
    with pytest.raises(BusinessError):
        write_off_loan(owner=user, loan=loan, today=EXPIRED)


def test_other_user_cannot_close(other_user, loan_factory):
    with pytest.raises(BusinessError):
        write_off_loan(owner=other_user, loan=loan_factory(), today=EXPIRED)


# --- Efecto en reportes ---

def test_dashboard_counts_losses_and_ignores_closed_loans(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("600000"), date=date(2026, 2, 28))
    write_off_loan(owner=user, loan=loan, today=EXPIRED)
    d = dashboard(user, today=EXPIRED)
    assert d["losses_total"] == "600000.00"
    assert d["outstanding_total"] == "0.00"
    assert d["interest_earned"] == "100000.00"  # lo cobrado sigue contando como ganancia
    assert sum(d["loans_by_status"].values()) == 0
    assert d["overdue"] == []


def test_projection_ignores_closed_loans(user, loan_factory):
    write_off_loan(owner=user, loan=loan_factory(), today=LATE)
    p = projection(user, target_date=date(2026, 4, 30), today=LATE, include_overdue=True)
    assert p["expected_inflows"] == "0.00" and p["overdue_amount"] == "0.00"


# --- API ---

def _create(api, account, borrower):
    return api.post("/api/loans/", {"borrower": borrower.id, "account": account.id, "principal": "1000000",
                                    "interest_rate": "20", "interest_mode": "TOTAL", "installments_count": 3,
                                    "frequency": "MONTHLY", "start_date": "2026-01-31"}, format="json").json()["id"]


def test_api_write_off_hides_loan(api, account, borrower):
    loan_id = _create(api, account, borrower)  # fechas de 2026: hoy ya está vencido
    r = api.post(f"/api/loans/{loan_id}/write-off/")
    assert r.status_code == 200 and r.json()["written_off_amount"] == "1200000.00"
    assert api.get(f"/api/loans/{loan_id}/").status_code == 404
    assert api.get("/api/loans/").json() == []


def test_api_delete_unpaid_loan_is_400(api, account, borrower):
    loan_id = _create(api, account, borrower)
    r = api.delete(f"/api/loans/{loan_id}/")
    assert r.status_code == 400 and "detail" in r.json()
    assert Loan.objects.get(pk=loan_id).closed_at is None


def test_api_delete_paid_loan(api, account, borrower):
    loan_id = _create(api, account, borrower)
    api.post(f"/api/loans/{loan_id}/payments/", {"amount": "1200000", "date": "2026-02-01"}, format="json")
    assert api.delete(f"/api/loans/{loan_id}/").status_code == 204
    assert api.get("/api/loans/").json() == []


def test_api_settle_requires_open_status(api, account, borrower):
    loan_id = _create(api, account, borrower)  # vencido hoy: no se puede liquidar
    r = api.post(f"/api/loans/{loan_id}/settle/", {}, format="json")
    assert r.status_code == 400
