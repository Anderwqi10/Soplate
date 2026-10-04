from django.urls import path
from rest_framework.routers import DefaultRouter

from ledger.views import AccountViewSet, TransactionViewSet, transfer_view

router = DefaultRouter(trailing_slash=True)
router.register("accounts", AccountViewSet, basename="account")
router.register("transactions", TransactionViewSet, basename="transaction")

urlpatterns = [path("transfers/", transfer_view)] + router.urls
