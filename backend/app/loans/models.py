from decimal import Decimal

from django.conf import settings
from django.core.validators import MinValueValidator
from django.db import models

from ledger.models import MONEY, Account, Transaction
from loans.domain import Frequency, InterestMode


class Borrower(models.Model):
    """Persona a la que se le presta."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="borrowers")
    full_name = models.CharField(max_length=150)
    document_id = models.CharField(max_length=30, blank=True)
    phone = models.CharField(max_length=30, blank=True)
    address = models.CharField(max_length=255, blank=True)
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["full_name"]

    def __str__(self):
        return self.full_name


class Loan(models.Model):
    """Condiciones del préstamo. Estado, saldo y fecha de fin se calculan (ver loans.services)."""
    owner = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="loans")
    borrower = models.ForeignKey(Borrower, on_delete=models.PROTECT, related_name="loans")
    # De aquí sale el dinero, y aquí llegan los pagos por defecto.
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="loans")
    principal = models.DecimalField(**MONEY, validators=[MinValueValidator(Decimal("0.01"))])
    interest_rate = models.DecimalField(max_digits=6, decimal_places=2, validators=[MinValueValidator(Decimal("0"))])
    interest_mode = models.CharField(max_length=10, choices=InterestMode.choices, default=InterestMode.TOTAL)
    installments_count = models.PositiveIntegerField(validators=[MinValueValidator(1)])
    frequency = models.CharField(max_length=10, choices=Frequency.choices, default=Frequency.MONTHLY)
    start_date = models.DateField()
    notes = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-start_date", "-id"]

    def __str__(self):
        return f"Préstamo #{self.pk} a {self.borrower}"


class Installment(models.Model):
    """Una cuota del cronograma. Se genera al crear el préstamo y no cambia."""
    loan = models.ForeignKey(Loan, on_delete=models.CASCADE, related_name="installments")
    number = models.PositiveIntegerField()
    due_date = models.DateField()
    principal_amount = models.DecimalField(**MONEY)
    interest_amount = models.DecimalField(**MONEY)
    amount = models.DecimalField(**MONEY)

    class Meta:
        ordering = ["number"]
        unique_together = [("loan", "number")]

    def __str__(self):
        return f"Cuota {self.number} de {self.loan}"


class Payment(models.Model):
    """Dinero recibido de un préstamo. Se aplica a las cuotas en orden (FIFO) al calcular."""
    loan = models.ForeignKey(Loan, on_delete=models.PROTECT, related_name="payments")
    account = models.ForeignKey(Account, on_delete=models.PROTECT, related_name="payments")
    transaction = models.OneToOneField(Transaction, on_delete=models.PROTECT, related_name="payment")
    amount = models.DecimalField(**MONEY)
    date = models.DateField()
    note = models.CharField(max_length=255, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["-date", "-id"]

    def __str__(self):
        return f"Pago {self.amount} de {self.loan}"
