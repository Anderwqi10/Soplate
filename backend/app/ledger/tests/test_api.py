import pytest

from ledger.models import Account

pytestmark = pytest.mark.django_db


def test_create_and_list_accounts_with_balance(api):
    r = api.post("/api/accounts/", {"name": "Efectivo", "kind": "CASH", "initial_balance": "250000.00"}, format="json")
    assert r.status_code == 201
    assert api.get("/api/accounts/").json()[0]["balance"] == "250000.00"


def test_manual_transaction_updates_balance(api, account):
    r = api.post("/api/transactions/", {"account": account.id, "kind": "EXPENSE", "amount": "50000",
                                        "date": "2026-01-05", "description": "Gasolina"}, format="json")
    assert r.status_code == 201 and r.json()["amount"] == "-50000.00"
    assert api.get(f"/api/accounts/{account.id}/").json()["balance"] == "950000.00"


def test_manual_transaction_rejects_system_kinds(api, account):
    r = api.post("/api/transactions/", {"account": account.id, "kind": "LOAN_PAYMENT", "amount": "10",
                                        "date": "2026-01-05"}, format="json")
    assert r.status_code == 400


def test_transactions_filter_by_account(api, account, user):
    other = Account.objects.create(owner=user, name="Caja", kind="CASH")
    api.post("/api/transactions/", {"account": account.id, "kind": "DEPOSIT", "amount": "10", "date": "2026-01-05"}, format="json")
    api.post("/api/transactions/", {"account": other.id, "kind": "DEPOSIT", "amount": "20", "date": "2026-01-05"}, format="json")
    rows = api.get("/api/transactions/", {"account": other.id}).json()
    assert [r["amount"] for r in rows] == ["20.00"] and rows[0]["account_name"] == "Caja"


def test_transfer_endpoint(api, account, user):
    dest = Account.objects.create(owner=user, name="Nequi", kind="WALLET")
    r = api.post("/api/transfers/", {"from_account": account.id, "to_account": dest.id, "amount": "300000",
                                     "date": "2026-01-05", "description": ""}, format="json")
    assert r.status_code == 201
    assert r.json()["outgoing"]["amount"] == "-300000.00" and r.json()["incoming"]["amount"] == "300000.00"
    balances = {a["name"]: a["balance"] for a in api.get("/api/accounts/").json()}
    assert balances == {"Banco": "700000.00", "Nequi": "300000.00"}


def test_other_user_gets_404_on_account(api, other_api):
    acc_id = api.post("/api/accounts/", {"name": "Mía", "kind": "BANK"}, format="json").json()["id"]
    assert other_api.get(f"/api/accounts/{acc_id}/").status_code == 404


def test_other_user_cannot_post_to_my_account(other_api, account):
    r = other_api.post("/api/transactions/", {"account": account.id, "kind": "DEPOSIT", "amount": "10",
                                              "date": "2026-01-05"}, format="json")
    assert r.status_code == 400


def test_delete_account_with_transactions_returns_400(api, account):
    api.post("/api/transactions/", {"account": account.id, "kind": "DEPOSIT", "amount": "10", "date": "2026-01-05"}, format="json")
    r = api.delete(f"/api/accounts/{account.id}/")
    assert r.status_code == 400 and "detail" in r.json()
    assert Account.objects.filter(pk=account.id).exists()


def test_initial_balance_not_editable_after_create(api, account):
    api.patch(f"/api/accounts/{account.id}/", {"initial_balance": "5", "name": "Banco X"}, format="json")
    account.refresh_from_db()
    assert account.initial_balance == 1000000 and account.name == "Banco X"
