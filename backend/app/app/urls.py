from django.contrib import admin
from django.urls import path
from rest_framework_simplejwt.views import TokenObtainPairView, TokenRefreshView

from core.views import me

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/token/", TokenObtainPairView.as_view()),
    path("api/auth/token/refresh/", TokenRefreshView.as_view()),
    path("api/me/", me),
]
