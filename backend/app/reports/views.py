from datetime import date

from django.utils import timezone
from rest_framework.decorators import api_view
from rest_framework.response import Response

from core.exceptions import BusinessError
from reports.services import dashboard, projection


@api_view(["GET"])
def dashboard_view(request):
    return Response(dashboard(request.user, timezone.localdate()))


@api_view(["GET"])
def projection_view(request):
    try:
        target = date.fromisoformat(request.query_params.get("date", ""))
    except ValueError:
        raise BusinessError("Indica una fecha válida con formato AAAA-MM-DD")
    include_overdue = request.query_params.get("include_overdue", "false").lower() == "true"
    return Response(projection(request.user, target, timezone.localdate(), include_overdue))
