from rest_framework.routers import DefaultRouter

from loans.views import BorrowerViewSet, LoanViewSet

router = DefaultRouter(trailing_slash=True)
router.register("borrowers", BorrowerViewSet, basename="borrower")
router.register("loans", LoanViewSet, basename="loan")

urlpatterns = router.urls
