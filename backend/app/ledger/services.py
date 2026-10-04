import uuid
from datetime import date as Date
from decimal import Decimal

from django.db import transaction as db_transaction
from django.db.models import Sum

from core.exceptions import BusinessError
from core.money import q2
from ledger.models import SIGNS, Account, Transaction, TransactionKind


def account_balance(account: Account) -> Decimal:
    moves = account.transactions.aggregate(total=Sum("amount"))["total"] or Decimal("0")
    return q2(account.initial_balance + moves)


@db_transaction.atomic
def record_transaction(*, owner, account: Account, kind: str, amount: Decimal, date: Date,
                       description: str = "", transfer_group=None, loan=None) -> Transaction:
    """Registra un movimiento. `amount` llega positivo; el signo lo pone el tipo."""
    if account.owner_id != owner.id:
        raise BusinessError("La cuenta no existe.")
    # Bloquea la fila de la cuenta hasta terminar: dos retiros simultáneos no pueden
    # pasar ambos la verificación de saldo.
    account = Account.objects.select_for_update().get(pk=account.pk)
    if not account.is_active:
        raise BusinessError(f"La cuenta {account.name} está archivada.")
    amount = q2(amount)
    if amount <= 0:
        raise BusinessError("El monto debe ser mayor que cero.")
    sign = SIGNS[kind]
    if sign < 0 and amount > account_balance(account):
        raise BusinessError(f"Saldo insuficiente en la cuenta {account.name}.")
    return Transaction.objects.create(
        owner=owner, account=account, kind=kind, amount=amount * sign, date=date,
        description=description, transfer_group=transfer_group, loan=loan,
    )


@db_transaction.atomic
def transfer(*, owner, from_account: Account, to_account: Account, amount: Decimal, date: Date,
             description: str = "") -> tuple[Transaction, Transaction]:
    """Mueve dinero entre cuentas propias: dos movimientos unidos por el mismo UUID, o ninguno."""
    if from_account.pk == to_account.pk:
        raise BusinessError("No puedes transferir a la misma cuenta.")
    group = uuid.uuid4()
    outgoing = record_transaction(owner=owner, account=from_account, kind=TransactionKind.TRANSFER_OUT,
                                  amount=amount, date=date, description=description, transfer_group=group)
    incoming = record_transaction(owner=owner, account=to_account, kind=TransactionKind.TRANSFER_IN,
                                  amount=amount, date=date, description=description, transfer_group=group)
    return outgoing, incoming
