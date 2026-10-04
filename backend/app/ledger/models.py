from decimal import Decimal

from django.conf import settings
from django.db import models
from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce

MONEY = {"max_digits": 14, "decimal_places": 2}


class AccountKind(models.TextChoices):
    BANK = "BANK", "Banco"
    CASH = "CASH", "Efectivo"
    WALLET = "WALLET", "Billetera digital"
    OTHER = "OTHER", "Otra"


class TransactionKind(models.TextChoices):
    DEPOSIT = "DEPOSIT", "Depósito"
    WITHDRAWAL = "WITHDRAWAL", "Retiro"
    INCOME = "INCOME", "Ingreso"
    EXPENSE = "EXPENSE", "Gasto"
    TRANSFER_IN = "TRANSFER_IN", "Transferencia recibida"
    TRANSFER_OUT = "TRANSFER_OUT", "Transferencia enviada"
    LOAN_DISBURSEMENT = "LOAN_DISBURSEMENT", "Desembolso de préstamo"
    LOAN_PAYMENT = "LOAN_PAYMENT", "Pago de préstamo"


# Dirección del dinero por tipo: +1 entra a la cuenta, -1 sale.
SIGNS: dict[str, int] = {
    TransactionKind.DEPOSIT: 1,
    TransactionKind.INCOME: 1,
    TransactionKind.TRANSFER_IN: 1,
    TransactionKind.LOAN_PAYMENT: 1,
    TransactionKind.WITHDRAWAL: -1,
    TransactionKind.EXPENSE: -1,
    TransactionKind.TRANSFER_OUT: -1,
    TransactionKind.LOAN_DISBURSEMENT: -1,
}

# Los únicos tipos que el usuario crea a mano; el resto los crea el sistema.
MANUAL_KINDS = [
    TransactionKind.DEPOSIT,
    TransactionKind.WITHDRAWAL,
    TransactionKind.INCOME,
    TransactionKind.EXPENSE,
]


class AccountQuerySet(models.QuerySet):
    def with_balance(self):
        """Saldo = saldo inicial + suma de movimientos (calculado por la base de datos)."""
        zero = Value(Decimal("0"), output_field=DecimalField(**MONEY))
        return self.annotate(
            balance=models.F("initial_balance") + Coalesce(Sum("transactions__amount"), zero)
        )


class Account(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="accounts")
    name = models.CharField(max_length=100)
    kind = models.CharField(max_length=10, choices=AccountKind.choices, default=AccountKind.BANK)
    initial_balance = models.DecimalField(**MONEY, default=Decimal("0"))
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(auto_now_add=True)

    objects = AccountQuerySet.as_manager()

    class Meta:
        ordering = ["name"]

    def __str__(self):
        return self.name


class Transaction(models.Model):
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="transactions")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="transactions")
    kind = models.CharField(max_length=20, choices=TransactionKind.choices)
    amount = models.DecimalField(**MONEY)  # con signo: + entra, - sale
    date = models.DateField()
    description = models.CharField(max_length=255, blank=True)
    transfer_group = models.UUIDField(null=True, blank=True)  # une las dos patas de una transferencia
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"{self.get_kind_display()} {self.amount} ({self.account})"
