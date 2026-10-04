from datetime import date, timedelta
from decimal import Decimal

import pytest
from django.utils import timezone

from core.exceptions import BusinessError
from loans.services import register_payment
from reports.services import dashboard, projection

pytestmark = pytest.mark.django_db


def test_dashboard_numbers(user, account, loan_factory):
    loan = loan_factory()  # 1.000.000 al 20 %, 3 cuotas de 400.000
    register_payment(owner=user, loan=loan, amount=Decimal("600000"), date=date(2026, 2, 28))
    d = dashboard(user, today=date(2026, 3, 1))
    assert d["total_balance"] == "600000.00"
    assert d["outstanding_total"] == "600000.00"
    assert d["outstanding_principal"] == "500000.00"
    assert d["interest_earned"] == "100000.00"
    assert d["net_worth"] == "1200000.00"
    assert d["loans_by_status"] == {"ACTIVE": 1, "OVERDUE": 0, "DEFAULTED": 0, "PAID": 0}
    assert d["accounts"] == [{"id": account.id, "name": "Banco", "balance": "600000.00"}]


def test_dashboard_upcoming_and_overdue(user, loan_factory):
    loan_factory()
    d = dashboard(user, today=date(2026, 3, 25))
    assert [(u["number"], u["due_date"], u["remaining"]) for u in d["upcoming"]] == [(2, "2026-03-31", "400000.00")]
    assert [(o["number"], o["days_overdue"]) for o in d["overdue"]] == [(1, 25)]
    assert d["overdue"][0]["borrower_name"] == "Luis Pérez"


def test_dashboard_ignores_archived_accounts(user, account):
    account.is_active = False
    account.save()
    assert dashboard(user, today=date(2026, 3, 1))["total_balance"] == "0.00"


def test_projection_only_counts_due_until_target(user, account, loan_factory):
    loan_factory()
    p = projection(user, target_date=date(2026, 3, 31), today=date(2026, 2, 1))
    assert p["expected_inflows"] == "800000.00"  # cuotas 28-feb y 31-mar
    assert p["projected_balance"] == "800000.00"  # saldo actual 0 + 800.000
    assert p["by_account"] == [{"id": account.id, "name": "Banco", "current_balance": "0.00",
                                "expected_inflows": "800000.00", "projected_balance": "800000.00"}]


def test_projection_overdue_separate(user, account, loan_factory):
    loan_factory()
    p = projection(user, date(2026, 3, 31), today=date(2026, 3, 1), include_overdue=False)
    assert p["overdue_amount"] == "400000.00" and p["projected_balance"] == "400000.00"
    assert projection(user, date(2026, 3, 31), date(2026, 3, 1), True)["projected_balance"] == "800000.00"


def test_projection_rejects_past_date(user):
    with pytest.raises(BusinessError):
        projection(user, date(2026, 1, 1), today=date(2026, 2, 1))


def test_projection_endpoint(api, account):
    target = (timezone.localdate() + timedelta(days=30)).isoformat()
    r = api.get("/api/reports/projection/", {"date": target, "include_overdue": "true"})
    assert r.status_code == 200 and r.json()["projected_balance"] == "1000000.00"


def test_projection_endpoint_requires_date(api):
    assert api.get("/api/reports/projection/").status_code == 400
    assert api.get("/api/reports/projection/", {"date": "no-es-fecha"}).status_code == 400


def test_dashboard_endpoint(api, account):
    r = api.get("/api/reports/dashboard/")
    assert r.status_code == 200 and r.json()["total_balance"] == "1000000.00"


def test_reports_isolated_per_user(other_api, loan_factory):
    loan_factory()
    d = other_api.get("/api/reports/dashboard/").json()
    assert d["total_balance"] == "0.00" and set(d["loans_by_status"].values()) == {0}
