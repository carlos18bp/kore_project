"""URL patterns for Wompi payment gateway endpoints."""

from django.urls import path

from core_app.views.wompi_views import generate_signature, wompi_config, wompi_webhook

urlpatterns = [
    path('config/', wompi_config, name='wompi-config'),
    path('generate-signature/', generate_signature, name='wompi-generate-signature'),
    path('webhook/', wompi_webhook, name='wompi-webhook'),
]
