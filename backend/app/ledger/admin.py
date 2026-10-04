from django.contrib import admin

from ledger.models import Account, Transaction


@admin.register(Account)
class AccountAdmin(admin.ModelAdmin):
    list_display = ["name", "kind", "initial_balance", "is_active", "owner"]
    list_filter = ["kind", "is_active"]


@admin.register(Transaction)
class TransactionAdmin(admin.ModelAdmin):
    list_display = ["date", "account", "kind", "amount", "description"]
    list_filter = ["kind", "account"]
    date_hierarchy = "date"
