from django.conf import settings
from django.http import HttpResponse, JsonResponse
from rest_framework.decorators import api_view
from rest_framework.response import Response


class OwnedQuerysetMixin:
    """Cada usuario solo ve y crea registros propios; los ajenos dan 404."""

    def get_queryset(self):
        return super().get_queryset().filter(owner=self.request.user)

    def perform_create(self, serializer):
        serializer.save(owner=self.request.user)


@api_view(["GET"])
def me(request):
    user = request.user
    return Response({"id": user.id, "username": user.username, "email": user.email})


def frontend_index(request):
    """Devuelve index.html de la app compilada (la navegación la resuelve React)."""
    index = settings.FRONTEND_DIST / "index.html"
    if not index.is_file():
        return HttpResponse(
            "Falta compilar la app: ejecuta scripts\\publicar.ps1",
            status=503,
            content_type="text/plain; charset=utf-8",
        )
    response = HttpResponse(index.read_text(encoding="utf-8"), content_type="text/html; charset=utf-8")
    response["Cache-Control"] = "no-cache"
    return response


def api_not_found(request, exception=None):
    """404 de la API en JSON (el resto de rutas las resuelve la app)."""
    return JsonResponse({"detail": "No encontrado."}, status=404)
