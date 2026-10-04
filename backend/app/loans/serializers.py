from decimal import Decimal

from rest_framework import serializers

from core.money import money_str
from ledger.serializers import POSITIVE, OwnedAccountField
from loans.domain import Frequency, InterestMode, ScheduledInstallment
from loans.models import Borrower, Loan, Payment
from loans.services import LoanSummary


class OwnedBorrowerField(serializers.PrimaryKeyRelatedField):
    def get_queryset(self):
        return Borrower.objects.filter(owner=self.context["request"].user)


class BorrowerSerializer(serializers.ModelSerializer):
    class Meta:
        model = Borrower
        fields = ["id", "full_name", "document_id", "phone", "address", "notes", "created_at"]
        read_only_fields = ["created_at"]


# --- Entrada ---------------------------------------------------------------

class LoanPreviewInputSerializer(serializers.Serializer):
    principal = serializers.DecimalField(**POSITIVE)
    interest_rate = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=Decimal("0"))
    interest_mode = serializers.ChoiceField(choices=InterestMode.choices)
    installments_count = serializers.IntegerField(min_value=1, max_value=1000)
    frequency = serializers.ChoiceField(choices=Frequency.choices)
    start_date = serializers.DateField()


class LoanInputSerializer(LoanPreviewInputSerializer):
    borrower = OwnedBorrowerField()
    account = OwnedAccountField()
    notes = serializers.CharField(required=False, allow_blank=True, default="")


class PaymentInputSerializer(serializers.Serializer):
    amount = serializers.DecimalField(**POSITIVE)
    date = serializers.DateField()
    account = OwnedAccountField(required=False, allow_null=True, default=None)
    note = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


# --- Salida (se arma desde LoanSummary, porque estado y saldos no son columnas) ---

def schedule_data(schedule: list[ScheduledInstallment]) -> dict:
    total = sum((s.amount for s in schedule), Decimal("0"))
    return {
        "interest_total": money_str(sum((s.interest_amount for s in schedule), Decimal("0"))),
        "total_amount": money_str(total),
        "installment_amount": money_str(schedule[0].amount),
        "end_date": schedule[-1].due_date.isoformat(),
        "installments": [
            {"number": s.number, "due_date": s.due_date.isoformat(), "principal_amount": money_str(s.principal_amount),
             "interest_amount": money_str(s.interest_amount), "amount": money_str(s.amount)}
            for s in schedule
        ],
    }


def loan_list_item(loan: Loan, summary: LoanSummary) -> dict:
    return {
        "id": loan.id,
        "borrower": loan.borrower_id,
        "borrower_name": loan.borrower.full_name,
        "account": loan.account_id,
        "account_name": loan.account.name,
        "principal": money_str(loan.principal),
        "interest_rate": str(loan.interest_rate),
        "interest_mode": loan.interest_mode,
        "installments_count": loan.installments_count,
        "frequency": loan.frequency,
        "start_date": loan.start_date.isoformat(),
        "end_date": summary.end_date.isoformat(),
        "installment_amount": money_str(summary.installment_amount),
        "total_amount": money_str(summary.total_amount),
        "paid_total": money_str(summary.paid_total),
        "outstanding": money_str(summary.outstanding),
        "status": summary.status,
        "days_overdue": summary.days_overdue,
        "next_due_date": summary.next_due_date.isoformat() if summary.next_due_date else None,
    }


def payment_data(payment: Payment) -> dict:
    return {"id": payment.id, "amount": money_str(payment.amount), "date": payment.date.isoformat(),
            "account": payment.account_id, "account_name": payment.account.name, "note": payment.note}


def loan_detail(loan: Loan, summary: LoanSummary) -> dict:
    return {
        **loan_list_item(loan, summary),
        "interest_total": money_str(summary.interest_total),
        "outstanding_principal": money_str(summary.outstanding_principal),
        "notes": loan.notes,
        "installments": [
            {"number": s.number, "due_date": s.due_date.isoformat(), "amount": money_str(s.amount),
             "principal_amount": money_str(s.principal_amount), "interest_amount": money_str(s.interest_amount),
             "paid_amount": money_str(s.paid_amount), "remaining": money_str(s.remaining), "status": s.status}
            for s in summary.installments
        ],
        "payments": [payment_data(p) for p in loan.payments.select_related("account")],
    }
