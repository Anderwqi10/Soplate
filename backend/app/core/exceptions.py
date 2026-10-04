from django.db.models import ProtectedError
from rest_framework import status
from rest_framework.response import Response
from rest_framework.views import exception_handler


class BusinessError(Exception):
    """Regla de negocio violada (saldo insuficiente, pago excesivo...). La API responde 400."""


def api_exception_handler(exc, context):
    if isinstance(exc, BusinessError):
        return Response({"detail": str(exc)}, status=status.HTTP_400_BAD_REQUEST)
    if isinstance(exc, ProtectedError):
        return Response(
            {"detail": "No se puede eliminar: tiene movimientos o registros asociados."},
            status=status.HTTP_400_BAD_REQUEST,
        )
    return exception_handler(exc, context)
