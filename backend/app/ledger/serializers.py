from decimal import Decimal

from rest_framework import serializers

from core.exceptions import BusinessError
from ledger.models import MANUAL_KINDS, Account, Transaction, TransactionKind
from ledger.services import account_balance

POSITIVE = {"max_digits": 14, "decimal_places": 2, "min_value": Decimal("0.01")}


class OwnedAccountField(serializers.PrimaryKeyRelatedField):
    """Solo acepta cuentas del usuario que hace la petición (una ajena = "no existe")."""

    def get_queryset(self):
        return Account.objects.visible().filter(owner=self.context["request"].user)


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = ["id", "name", "kind", "initial_balance", "is_active", "balance", "created_at"]
        read_only_fields = ["created_at"]

    def update(self, instance, validated_data):
        # El saldo inicial solo se fija al crear; cambiarlo después reescribiría la historia.
        validated_data.pop("initial_balance", None)
        # Archivar una cuenta con dinero lo haría desaparecer del balance general.
        if validated_data.get("is_active") is False and instance.is_active and account_balance(instance) != 0:
            raise BusinessError("No puedes archivar una cuenta con saldo; transfiere el dinero primero.")
        return super().update(instance, validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)
    loan_open = serializers.SerializerMethodField()

    class Meta:
        model = Transaction
        fields = ["id", "account", "account_name", "kind", "amount", "date", "description",
                  "loan", "loan_open", "transfer_group", "created_at"]
        read_only_fields = fields

    def get_loan_open(self, tx) -> bool:
        """El préstamo existe y sigue abierto (los cerrados ya no tienen página)."""
        return tx.loan_id is not None and tx.loan.closed_at is None


class TransactionInputSerializer(serializers.Serializer):
    account = OwnedAccountField()
    kind = serializers.ChoiceField(choices=MANUAL_KINDS)
    amount = serializers.DecimalField(**POSITIVE)
    date = serializers.DateField()
    description = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class TransferInputSerializer(serializers.Serializer):
    from_account = OwnedAccountField()
    to_account = OwnedAccountField()
    amount = serializers.DecimalField(**POSITIVE)
    date = serializers.DateField()
    description = serializers.CharField(max_length=255, required=False, allow_blank=True, default="")


class TransactionFilterSerializer(serializers.Serializer):
    account = serializers.IntegerField(required=False)
    kind = serializers.ChoiceField(choices=TransactionKind.choices, required=False)
    date_from = serializers.DateField(required=False)
    date_to = serializers.DateField(required=False)
