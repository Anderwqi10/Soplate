from decimal import Decimal

import pytest

from ledger.models import Account


@pytest.fixture
def account(user):
    return Account.objects.create(owner=user, name="Banco", kind="BANK", initial_balance=Decimal("1000000"))
