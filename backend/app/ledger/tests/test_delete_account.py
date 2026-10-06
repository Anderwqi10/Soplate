"""Eliminar una cuenta: solo con saldo $ 0 y sin préstamos abiertos."""
from datetime import date
from decimal import Decimal

import pytest

from ledger.models import Account
from ledger.services import record_transaction, transfer

pytestmark = pytest.mark.django_db


def test_account_with_zero_balance_and_history_can_be_deleted(api, user):
    a = Account.objects.create(owner=user, name="Nequi", kind="WALLET", initial_balance=Decimal("500"))
    b = Account.objects.create(owner=user, name="Banco", kind="BANK")
    transfer(owner=user, from_account=a, to_account=b, amount=Decimal("500"), date=date(2026, 1, 1))
    assert api.delete(f"/api/accounts/{a.id}/").status_code == 204
    assert api.get(f"/api/accounts/{a.id}/").status_code == 404
    assert [x["name"] for x in api.get("/api/accounts/").json()] == ["Banco"]
    assert api.get("/api/accounts/").json()[0]["balance"] == "500.00"  # la otra cuenta no cambia


def test_account_with_money_cannot_be_deleted(api, account):
    r = api.delete(f"/api/accounts/{account.id}/")
    assert r.status_code == 400 and "$ 0" in r.json()["detail"]
    assert Account.objects.get(pk=account.id).deleted_at is None


def test_account_with_open_loans_cannot_be_deleted(api, user, account, loan_factory):
    loan_factory()  # presta todo el saldo: la cuenta queda en 0 pero el préstamo sigue abierto
    r = api.delete(f"/api/accounts/{account.id}/")
    assert r.status_code == 400 and "préstamos" in r.json()["detail"]


def test_deleted_account_disappears_from_selectors(api, other_api, user):
    a = Account.objects.create(owner=user, name="Vacía", kind="CASH")
    api.delete(f"/api/accounts/{a.id}/")
    r = api.post("/api/transactions/", {"account": a.id, "kind": "DEPOSIT", "amount": "10",
                                        "date": "2026-01-01"}, format="json")
    assert r.status_code == 400


def test_deleted_account_movements_leave_the_history(api, user):
    a = Account.objects.create(owner=user, name="Vieja", kind="CASH")
    record_transaction(owner=user, account=a, kind="DEPOSIT", amount=Decimal("10"), date=date(2026, 1, 1))
    record_transaction(owner=user, account=a, kind="WITHDRAWAL", amount=Decimal("10"), date=date(2026, 1, 2))
    api.delete(f"/api/accounts/{a.id}/")
    assert api.get("/api/transactions/").json() == []
