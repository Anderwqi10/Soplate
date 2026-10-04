"""Regresiones de la revisión final del backend."""
from datetime import date
from decimal import Decimal
from unittest import mock

import pytest
from django.db.models import QuerySet

from core.exceptions import BusinessError
from ledger.models import Account
from ledger.services import record_transaction
from loans.services import register_payment

pytestmark = pytest.mark.django_db


# --- Filtros inválidos: 400, no 500 ---

@pytest.mark.parametrize("params", [{"account": "abc"}, {"date_from": "xx"}, {"date_to": "2026-13-01"}])
def test_bad_transaction_filters_return_400(api, params):
    assert api.get("/api/transactions/", params).status_code == 400


def test_bad_loan_filter_returns_400(api):
    assert api.get("/api/loans/", {"borrower": "abc"}).status_code == 400


# --- Bloqueo de filas para evitar dobles pagos/retiros simultáneos ---

def test_record_transaction_locks_account_row(user, account):
    with mock.patch.object(QuerySet, "select_for_update", autospec=True, side_effect=lambda qs, *a, **k: qs) as spy:
        record_transaction(owner=user, account=account, kind="WITHDRAWAL", amount=Decimal("10"), date=date(2026, 1, 1))
    assert spy.call_args_list and spy.call_args_list[0].args[0].model is Account


def test_register_payment_locks_loan_row(user, loan_factory):
    loan = loan_factory()
    with mock.patch.object(QuerySet, "select_for_update", autospec=True, side_effect=lambda qs, *a, **k: qs) as spy:
        register_payment(owner=user, loan=loan, amount=Decimal("10"), date=date(2026, 2, 1))
    assert "Loan" in [c.args[0].model.__name__ for c in spy.call_args_list]


# --- Cuentas archivadas ---

def test_cannot_archive_account_with_money(api, account):
    r = api.patch(f"/api/accounts/{account.id}/", {"is_active": False}, format="json")
    assert r.status_code == 400 and "saldo" in r.json()["detail"]
    account.refresh_from_db()
    assert account.is_active


def test_can_archive_empty_account(api, user):
    acc = Account.objects.create(owner=user, name="Vieja", kind="CASH")
    r = api.patch(f"/api/accounts/{acc.id}/", {"is_active": False}, format="json")
    assert r.status_code == 200 and r.json()["is_active"] is False


def test_archived_account_rejects_new_movements(user):
    acc = Account.objects.create(owner=user, name="Vieja", kind="CASH", is_active=False)
    with pytest.raises(BusinessError, match="archivada"):
        record_transaction(owner=user, account=acc, kind="DEPOSIT", amount=Decimal("10"), date=date(2026, 1, 1))


# --- Huecos de aislamiento señalados por la revisión (cubiertos, sin test) ---

def test_other_user_cannot_pay_my_loan(api, other_api, account, borrower):
    loan_id = api.post("/api/loans/", {"borrower": borrower.id, "account": account.id, "principal": "1000",
                                       "interest_rate": "0", "interest_mode": "TOTAL", "installments_count": 1,
                                       "frequency": "MONTHLY", "start_date": "2026-01-01"}, format="json").json()["id"]
    r = other_api.post(f"/api/loans/{loan_id}/payments/", {"amount": "10", "date": "2026-01-02"}, format="json")
    assert r.status_code == 404
