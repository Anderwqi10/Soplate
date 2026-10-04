from datetime import date
from decimal import Decimal

import pytest

from core.exceptions import BusinessError
from ledger.models import Account, Transaction
from ledger.services import account_balance
from loans.models import Loan, Payment
from loans.services import create_loan, register_payment, summarize_loan

pytestmark = pytest.mark.django_db


def test_create_loan_generates_schedule_and_disbursement(account, loan_factory):
    loan = loan_factory()
    assert loan.installments.count() == 3
    assert account_balance(account) == Decimal("0.00")
    assert Transaction.objects.get(loan=loan).kind == "LOAN_DISBURSEMENT"


def test_create_loan_insufficient_balance_saves_nothing(loan_factory):
    with pytest.raises(BusinessError, match="Saldo insuficiente"):
        loan_factory(principal=Decimal("1000000.01"))
    assert Loan.objects.count() == 0 and Transaction.objects.count() == 0


def test_create_loan_with_other_users_account_fails(other_user, account, borrower):
    with pytest.raises(BusinessError):
        create_loan(owner=other_user, borrower=borrower, account=account, principal=Decimal("10"),
                    interest_rate=Decimal("0"), interest_mode="TOTAL", installments_count=1,
                    frequency="DAILY", start_date=date(2026, 1, 1))
    assert Loan.objects.count() == 0


def test_payment_updates_balance_and_summary(user, account, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("500000"), date=date(2026, 2, 28))
    s = summarize_loan(loan, today=date(2026, 3, 1))
    assert s.paid_total == Decimal("500000.00") and s.outstanding == Decimal("700000.00")
    assert s.status == "ACTIVE" and s.next_due_date == date(2026, 3, 31)
    assert account_balance(account) == Decimal("500000.00")
    assert s.end_date == date(2026, 4, 30) and s.interest_total == Decimal("200000.00")
    assert s.installment_amount == Decimal("400000.00") and s.total_amount == Decimal("1200000.00")


def test_payment_to_another_account(user, account, loan_factory):
    caja = Account.objects.create(owner=user, name="Caja", kind="CASH")
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("100000"), date=date(2026, 2, 1), account=caja)
    assert account_balance(caja) == Decimal("100000.00") and account_balance(account) == Decimal("0.00")


def test_overpayment_rejected(user, loan_factory):
    loan = loan_factory()
    with pytest.raises(BusinessError, match="supera"):
        register_payment(owner=user, loan=loan, amount=Decimal("1200000.01"), date=date(2026, 2, 1))
    assert Payment.objects.count() == 0 and Transaction.objects.filter(kind="LOAN_PAYMENT").count() == 0


def test_payment_before_start_rejected(user, loan_factory):
    loan = loan_factory()
    with pytest.raises(BusinessError, match="anterior"):
        register_payment(owner=user, loan=loan, amount=Decimal("10"), date=date(2026, 1, 30))


def test_full_payment_marks_paid(user, loan_factory):
    loan = loan_factory()
    register_payment(owner=user, loan=loan, amount=Decimal("1200000"), date=date(2026, 2, 1))
    s = summarize_loan(loan, today=date(2026, 2, 2))
    assert s.status == "PAID" and s.outstanding == Decimal("0.00") and s.next_due_date is None


def test_defaulted_after_end_date(loan_factory):
    s = summarize_loan(loan_factory(), today=date(2026, 5, 1))
    assert s.status == "DEFAULTED" and s.days_overdue == 62
    assert s.outstanding_principal == Decimal("1000000.00")
