from rest_framework import mixins, status, viewsets
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.views import OwnedQuerysetMixin
from ledger.models import Account, Transaction
from ledger.serializers import (AccountSerializer, TransactionFilterSerializer, TransactionInputSerializer,
                                TransactionSerializer, TransferInputSerializer)
from ledger.services import delete_account, record_transaction, transfer


class AccountViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Account.objects.visible().with_balance()
    serializer_class = AccountSerializer

    def destroy(self, request, *args, **kwargs):
        delete_account(owner=request.user, account=self.get_object())
        return Response(status=status.HTTP_204_NO_CONTENT)

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        account = serializer.save(owner=request.user)
        # Re-leer con el saldo anotado por la base de datos.
        fresh = self.get_queryset().get(pk=account.pk)
        return Response(self.get_serializer(fresh).data, status=status.HTTP_201_CREATED)


class TransactionViewSet(OwnedQuerysetMixin, mixins.ListModelMixin, mixins.CreateModelMixin,
                         viewsets.GenericViewSet):
    # Los movimientos de cuentas eliminadas salen del historial (los saldos de las demás no cambian).
    queryset = Transaction.objects.select_related("account", "loan").filter(account__deleted_at__isnull=True)
    serializer_class = TransactionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        if self.action != "list":
            return qs
        # Parámetros vacíos se ignoran; inválidos ("abc", "2026-13-01") responden 400.
        filters = TransactionFilterSerializer(data={k: v for k, v in self.request.query_params.items() if v != ""})
        filters.is_valid(raise_exception=True)
        f = filters.validated_data
        if "account" in f:
            qs = qs.filter(account_id=f["account"])
        if "kind" in f:
            qs = qs.filter(kind=f["kind"])
        if "date_from" in f:
            qs = qs.filter(date__gte=f["date_from"])
        if "date_to" in f:
            qs = qs.filter(date__lte=f["date_to"])
        return qs

    def create(self, request, *args, **kwargs):
        data = TransactionInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        tx = record_transaction(owner=request.user, **data.validated_data)
        return Response(TransactionSerializer(tx).data, status=status.HTTP_201_CREATED)


@api_view(["POST"])
def transfer_view(request):
    data = TransferInputSerializer(data=request.data, context={"request": request})
    data.is_valid(raise_exception=True)
    outgoing, incoming = transfer(owner=request.user, **data.validated_data)
    return Response(
        {"outgoing": TransactionSerializer(outgoing).data, "incoming": TransactionSerializer(incoming).data},
        status=status.HTTP_201_CREATED,
    )
