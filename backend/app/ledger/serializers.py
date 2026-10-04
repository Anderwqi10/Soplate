from decimal import Decimal

from rest_framework import serializers

from ledger.models import MANUAL_KINDS, Account, Transaction

POSITIVE = {"max_digits": 14, "decimal_places": 2, "min_value": Decimal("0.01")}


class OwnedAccountField(serializers.PrimaryKeyRelatedField):
    """Solo acepta cuentas del usuario que hace la petición (una ajena = "no existe")."""

    def get_queryset(self):
        return Account.objects.filter(owner=self.context["request"].user)


class AccountSerializer(serializers.ModelSerializer):
    balance = serializers.DecimalField(max_digits=14, decimal_places=2, read_only=True)

    class Meta:
        model = Account
        fields = ["id", "name", "kind", "initial_balance", "is_active", "balance", "created_at"]
        read_only_fields = ["created_at"]

    def update(self, instance, validated_data):
        # El saldo inicial solo se fija al crear; cambiarlo después reescribiría la historia.
        validated_data.pop("initial_balance", None)
        return super().update(instance, validated_data)


class TransactionSerializer(serializers.ModelSerializer):
    account_name = serializers.CharField(source="account.name", read_only=True)

    class Meta:
        model = Transaction
        fields = ["id", "account", "account_name", "kind", "amount", "date", "description",
                  "loan", "transfer_group", "created_at"]
        read_only_fields = fields


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
