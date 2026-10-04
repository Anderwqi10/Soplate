from django.urls import path

from reports.views import dashboard_view, projection_view

urlpatterns = [
    path("reports/dashboard/", dashboard_view),
    path("reports/projection/", projection_view),
]
