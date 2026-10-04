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
