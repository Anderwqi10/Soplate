import pytest
from rest_framework.test import APIClient


@pytest.fixture
def user(django_user_model):
    return django_user_model.objects.create_user("ana", password="clave-segura-1")


@pytest.fixture
def other_user(django_user_model):
    return django_user_model.objects.create_user("beto", password="clave-segura-2")


@pytest.fixture
def api(user):
    client = APIClient()
    client.force_authenticate(user)
    return client


@pytest.fixture
def other_api(other_user):
    client = APIClient()
    client.force_authenticate(other_user)
    return client


@pytest.fixture
def account(user):
    from decimal import Decimal

    from ledger.models import Account

    return Account.objects.create(owner=user, name="Banco", kind="BANK", initial_balance=Decimal("1000000"))


@pytest.fixture
def borrower(user):
    from loans.models import Borrower

    return Borrower.objects.create(owner=user, full_name="Luis Pérez", phone="3001234567")


@pytest.fixture
def loan_factory(user, account, borrower):
    """Crea préstamos con valores por defecto: 1.000.000 al 20 % en 3 cuotas mensuales desde el 31-ene-2026."""
    from datetime import date
    from decimal import Decimal

    from loans.services import create_loan

    def make(**overrides):
        params = dict(owner=user, borrower=borrower, account=account, principal=Decimal("1000000"),
                      interest_rate=Decimal("20"), interest_mode="TOTAL", installments_count=3,
                      frequency="MONTHLY", start_date=date(2026, 1, 31))
        params.update(overrides)
        return create_loan(**params)

    return make
