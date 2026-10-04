from decimal import Decimal

from django.db.models import DecimalField, Sum, Value
from django.db.models.functions import Coalesce
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.views import OwnedQuerysetMixin
from loans.domain import build_schedule
from loans.models import Borrower, Loan
from loans.serializers import (BorrowerSerializer, LoanInputSerializer, LoanPreviewInputSerializer,
                               PaymentInputSerializer, loan_detail, loan_list_item, payment_data, schedule_data)
from loans.services import create_loan, register_payment, summarize_loan


class BorrowerViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Borrower.objects.all()
    serializer_class = BorrowerSerializer


def loans_with_totals():
    """Préstamos con lo necesario para resumirlos en pocas consultas (sin N+1)."""
    zero = Value(Decimal("0"), output_field=DecimalField(max_digits=14, decimal_places=2))
    return (Loan.objects.select_related("borrower", "account").prefetch_related("installments")
            .annotate(paid_total=Coalesce(Sum("payments__amount"), zero)))


class LoanViewSet(OwnedQuerysetMixin, viewsets.GenericViewSet):
    queryset = loans_with_totals()
    http_method_names = ["get", "post", "patch", "head", "options"]  # los préstamos no se borran

    def _detail_response(self, pk, status_code=status.HTTP_200_OK):
        loan = self.get_queryset().get(pk=pk)  # re-leer con totales frescos
        return Response(loan_detail(loan, summarize_loan(loan, timezone.localdate())), status=status_code)

    def list(self, request):
        today = timezone.localdate()
        qs = self.get_queryset()
        if request.query_params.get("borrower"):
            qs = qs.filter(borrower_id=request.query_params["borrower"])
        items = [loan_list_item(loan, summarize_loan(loan, today)) for loan in qs]
        wanted = request.query_params.get("status")
        if wanted:
            # El estado depende de la fecha de hoy, por eso se filtra después de calcularlo.
            items = [i for i in items if i["status"] == wanted]
        return Response(items)

    def retrieve(self, request, pk=None):
        return self._detail_response(self.get_object().pk)

    def create(self, request):
        data = LoanInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        loan = create_loan(owner=request.user, **data.validated_data)
        return self._detail_response(loan.pk, status.HTTP_201_CREATED)

    def partial_update(self, request, pk=None):
        loan = self.get_object()
        if "notes" in request.data:
            loan.notes = request.data["notes"] or ""
            loan.save(update_fields=["notes"])
        return self._detail_response(loan.pk)

    @action(detail=False, methods=["post"])
    def preview(self, request):
        data = LoanPreviewInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        return Response(schedule_data(build_schedule(**data.validated_data)))

    @action(detail=True, methods=["get", "post"])
    def payments(self, request, pk=None):
        loan = self.get_object()
        if request.method == "GET":
            return Response([payment_data(p) for p in loan.payments.select_related("account")])
        data = PaymentInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        register_payment(owner=request.user, loan=loan, **data.validated_data)
        return self._detail_response(loan.pk, status.HTTP_201_CREATED)
