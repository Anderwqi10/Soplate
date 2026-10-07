from django.utils import timezone
from rest_framework import serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.response import Response

from core.money import money_str
from core.views import OwnedQuerysetMixin
from ledger.serializers import OwnedAccountField
from loans.domain import build_schedule
from loans.models import Borrower, Loan
from loans.profile import borrower_profile
from loans.serializers import (BorrowerSerializer, LoanFilterSerializer, LoanInputSerializer,
                               LoanPreviewInputSerializer,
                               PaymentInputSerializer, loan_detail, loan_list_item, payment_data, schedule_data)
from loans.services import (create_loan, delete_loan, loans_with_totals, register_payment, settle_loan,
                            summarize_loan, update_loan_terms, write_off_loan)


class BorrowerViewSet(OwnedQuerysetMixin, viewsets.ModelViewSet):
    queryset = Borrower.objects.all()
    serializer_class = BorrowerSerializer

    @action(detail=True, methods=["get"])
    def profile(self, request, pk=None):
        return Response(borrower_profile(self.get_object(), timezone.localdate()))


class LoanViewSet(OwnedQuerysetMixin, viewsets.GenericViewSet):
    queryset = loans_with_totals()
    http_method_names = ["get", "post", "patch", "delete", "head", "options"]

    def get_queryset(self):
        # Los préstamos cerrados (liquidados, reportados o eliminados) desaparecen de la app.
        return super().get_queryset().open()

    @staticmethod
    def _closed_response(loan):
        return Response({
            "id": loan.id,
            "close_reason": loan.close_reason,
            "written_off_amount": money_str(loan.written_off_amount) if loan.written_off_amount is not None else None,
        })

    def _detail_response(self, pk, status_code=status.HTTP_200_OK):
        loan = self.get_queryset().get(pk=pk)  # re-leer con totales frescos
        return Response(loan_detail(loan, summarize_loan(loan, timezone.localdate())), status=status_code)

    def list(self, request):
        today = timezone.localdate()
        filters = LoanFilterSerializer(data={k: v for k, v in request.query_params.items() if v != ""})
        filters.is_valid(raise_exception=True)
        qs = self.get_queryset()
        if "borrower" in filters.validated_data:
            qs = qs.filter(borrower_id=filters.validated_data["borrower"])
        items = [loan_list_item(loan, summarize_loan(loan, today)) for loan in qs]
        wanted = filters.validated_data.get("status")
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

    def destroy(self, request, pk=None):
        delete_loan(owner=request.user, loan=self.get_object(), today=timezone.localdate())
        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=["post"])
    def settle(self, request, pk=None):
        data = SettleInputSerializer(data=request.data, context={"request": request})
        data.is_valid(raise_exception=True)
        loan = settle_loan(owner=request.user, loan=self.get_object(), today=timezone.localdate(),
                           account=data.validated_data["account"])
        return self._closed_response(loan)

    @action(detail=True, methods=["patch"])
    def terms(self, request, pk=None):
        data = TermsInputSerializer(data=request.data)
        data.is_valid(raise_exception=True)
        loan = update_loan_terms(owner=request.user, loan=self.get_object(), today=timezone.localdate(),
                                 **data.validated_data)
        return self._detail_response(loan.pk)

    @action(detail=True, methods=["post"], url_path="write-off")
    def write_off(self, request, pk=None):
        loan = write_off_loan(owner=request.user, loan=self.get_object(), today=timezone.localdate())
        return self._closed_response(loan)


class SettleInputSerializer(serializers.Serializer):
    account = OwnedAccountField(required=False, allow_null=True, default=None)


class TermsInputSerializer(serializers.Serializer):
    interest_rate = serializers.DecimalField(max_digits=6, decimal_places=2, min_value=0, required=False)
    start_date = serializers.DateField(required=False)

    def validate(self, attrs):
        if not attrs:
            raise serializers.ValidationError("Indica la nueva tasa o la nueva fecha de inicio.")
        return attrs
