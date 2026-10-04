from datetime import date
from decimal import Decimal

import pytest

from core.exceptions import BusinessError
from ledger.models import Account, Transaction
from ledger.services import account_balance, record_transaction, transfer

pytestmark = pytest.mark.django_db


def test_balance_is_initial_plus_signed_transactions(user):
    acc = Account.objects.create(owner=user, name="Banco", kind="BANK", initial_balance=Decimal("1000"))
    record_transaction(owner=user, account=acc, kind="DEPOSIT", amount=Decimal("500"), date=date(2026, 1, 1))
    record_transaction(owner=user, account=acc, kind="EXPENSE", amount=Decimal("200"), date=date(2026, 1, 2))
    assert account_balance(acc) == Decimal("1300.00")
    assert Account.objects.with_balance().get(pk=acc.pk).balance == Decimal("1300.00")
    assert Transaction.objects.get(kind="EXPENSE").amount == Decimal("-200.00")


def test_cannot_withdraw_more_than_balance(user):
    acc = Account.objects.create(owner=user, name="Caja", kind="CASH", initial_balance=Decimal("100"))
    with pytest.raises(BusinessError):
        record_transaction(owner=user, account=acc, kind="WITHDRAWAL", amount=Decimal("100.01"), date=date(2026, 1, 1))
    assert Transaction.objects.count() == 0


def test_cannot_use_other_users_account(user, other_user):
    acc = Account.objects.create(owner=user, name="Banco", kind="BANK")
    with pytest.raises(BusinessError):
        record_transaction(owner=other_user, account=acc, kind="DEPOSIT", amount=Decimal("10"), date=date(2026, 1, 1))


def test_transfer_creates_two_linked_legs(user):
    a = Account.objects.create(owner=user, name="A", kind="BANK", initial_balance=Decimal("1000"))
    b = Account.objects.create(owner=user, name="B", kind="CASH")
    out, inc = transfer(owner=user, from_account=a, to_account=b, amount=Decimal("300"), date=date(2026, 1, 1))
    assert account_balance(a) == Decimal("700.00") and account_balance(b) == Decimal("300.00")
    assert out.transfer_group == inc.transfer_group is not None
    assert (out.kind, inc.kind) == ("TRANSFER_OUT", "TRANSFER_IN")


def test_transfer_insufficient_funds_saves_nothing(user):
    a = Account.objects.create(owner=user, name="A", kind="BANK", initial_balance=Decimal("100"))
    b = Account.objects.create(owner=user, name="B", kind="CASH")
    with pytest.raises(BusinessError):
        transfer(owner=user, from_account=a, to_account=b, amount=Decimal("101"), date=date(2026, 1, 1))
    assert Transaction.objects.count() == 0


def test_transfer_to_same_account_rejected(user):
    a = Account.objects.create(owner=user, name="A", kind="BANK", initial_balance=Decimal("100"))
    with pytest.raises(BusinessError, match="misma cuenta"):
        transfer(owner=user, from_account=a, to_account=a, amount=Decimal("10"), date=date(2026, 1, 1))
