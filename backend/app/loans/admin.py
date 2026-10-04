from django.contrib import admin

from loans.models import Borrower, Installment, Loan, Payment


class InstallmentInline(admin.TabularInline):
    model = Installment
    extra = 0
    readonly_fields = ["number", "due_date", "principal_amount", "interest_amount", "amount"]


class PaymentInline(admin.TabularInline):
    model = Payment
    extra = 0
    readonly_fields = ["amount", "date", "account", "note"]


@admin.register(Borrower)
class BorrowerAdmin(admin.ModelAdmin):
    list_display = ["full_name", "document_id", "phone", "owner"]
    search_fields = ["full_name", "document_id"]


@admin.register(Loan)
class LoanAdmin(admin.ModelAdmin):
    list_display = ["id", "borrower", "principal", "interest_rate", "installments_count", "frequency", "start_date"]
    list_filter = ["frequency", "interest_mode"]
    inlines = [InstallmentInline, PaymentInline]
