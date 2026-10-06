import pytest

from loans.models import Borrower, Loan

pytestmark = pytest.mark.django_db

PREVIEW = {"principal": "1000000", "interest_rate": "20", "interest_mode": "TOTAL",
           "installments_count": 3, "frequency": "MONTHLY", "start_date": "2026-01-31"}


def create_loan(api, account, borrower, **overrides):
    body = {**PREVIEW, "borrower": borrower.id, "account": account.id, "notes": ""}
    body.update(overrides)
    return api.post("/api/loans/", body, format="json")


def test_preview_does_not_persist(api):
    r = api.post("/api/loans/preview/", PREVIEW, format="json")
    assert r.status_code == 200
    data = r.json()
    assert data["installment_amount"] == "400000.00" and data["end_date"] == "2026-04-30"
    assert data["interest_total"] == "200000.00" and data["total_amount"] == "1200000.00"
    assert [i["due_date"] for i in data["installments"]] == ["2026-02-28", "2026-03-31", "2026-04-30"]
    assert Loan.objects.count() == 0


def test_preview_validates_input(api):
    r = api.post("/api/loans/preview/", {**PREVIEW, "installments_count": 0}, format="json")
    assert r.status_code == 400 and "installments_count" in r.json()


def test_create_loan_and_detail(api, account, borrower):
    r = create_loan(api, account, borrower)
    assert r.status_code == 201
    data = r.json()
    assert len(data["installments"]) == 3 and data["payments"] == []
    assert data["status"] in {"ACTIVE", "OVERDUE", "DEFAULTED"}
    assert data["borrower_name"] == "Luis Pérez" and data["account_name"] == "Banco"
    detail = api.get(f"/api/loans/{data['id']}/").json()
    assert detail["outstanding"] == "1200000.00" and detail["installments"][0]["status"] in {"PENDING", "OVERDUE"}


def test_create_loan_insufficient_balance_400(api, account, borrower):
    r = create_loan(api, account, borrower, principal="2000000")
    assert r.status_code == 400 and "Saldo insuficiente" in r.json()["detail"]


def test_payment_endpoint_and_overpay(api, account, borrower):
    loan_id = create_loan(api, account, borrower).json()["id"]
    r = api.post(f"/api/loans/{loan_id}/payments/", {"amount": "400000", "date": "2026-02-28"}, format="json")
    assert r.status_code == 201
    assert r.json()["paid_total"] == "400000.00" and r.json()["installments"][0]["status"] == "PAID"
    assert len(api.get(f"/api/loans/{loan_id}/payments/").json()) == 1
    r = api.post(f"/api/loans/{loan_id}/payments/", {"amount": "900000", "date": "2026-03-01"}, format="json")
    assert r.status_code == 400 and "supera" in r.json()["detail"]


def test_filter_by_status(api, account, borrower):
    loan_id = create_loan(api, account, borrower).json()["id"]
    api.post(f"/api/loans/{loan_id}/payments/", {"amount": "1200000", "date": "2026-02-01"}, format="json")
    assert [x["id"] for x in api.get("/api/loans/", {"status": "PAID"}).json()] == [loan_id]
    assert api.get("/api/loans/", {"status": "ACTIVE"}).json() == []


def test_patch_only_changes_notes(api, account, borrower):
    loan_id = create_loan(api, account, borrower).json()["id"]
    r = api.patch(f"/api/loans/{loan_id}/", {"notes": "Paga los viernes", "principal": "1"}, format="json")
    assert r.status_code == 200 and r.json()["notes"] == "Paga los viernes" and r.json()["principal"] == "1000000.00"


def test_unpaid_loans_cannot_be_deleted(api, account, borrower):
    # Solo los préstamos pagados se eliminan; los demás se liquidan o se reportan como pérdida.
    loan_id = create_loan(api, account, borrower).json()["id"]
    assert api.delete(f"/api/loans/{loan_id}/").status_code == 400


def test_other_user_cannot_see_or_use(api, other_api, account, borrower):
    loan_id = create_loan(api, account, borrower).json()["id"]
    assert other_api.get(f"/api/loans/{loan_id}/").status_code == 404
    assert other_api.get("/api/loans/").json() == []
    r = other_api.post("/api/loans/", {**PREVIEW, "borrower": borrower.id, "account": account.id}, format="json")
    assert r.status_code == 400


def test_borrowers_crud(api):
    r = api.post("/api/borrowers/", {"full_name": "Marta Gómez", "phone": "3110000000"}, format="json")
    assert r.status_code == 201
    assert api.get("/api/borrowers/").json()[0]["full_name"] == "Marta Gómez"


def test_delete_borrower_with_loans_400(api, account, borrower):
    create_loan(api, account, borrower)
    r = api.delete(f"/api/borrowers/{borrower.id}/")
    assert r.status_code == 400 and "detail" in r.json()
    assert Borrower.objects.filter(pk=borrower.id).exists()
