"""Tests for the admin Reports endpoint (Fase 2 — Parte 11a)."""

import pytest
from django.urls import reverse
from rest_framework import status

URL_NAME = 'admin-reports'


@pytest.mark.django_db
def test_non_admin_cannot_read_reports(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_admin_gets_report_with_all_groups(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME))
    assert response.status_code == status.HTTP_200_OK
    assert set(response.data) == {'window', 'revenue', 'subscriptions', 'credits', 'quality'}
    assert response.data['window'] == '30d'  # default


@pytest.mark.django_db
def test_admin_can_select_window(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME), {'window': '90d'})
    assert response.data['window'] == '90d'


@pytest.mark.django_db
def test_invalid_window_is_rejected(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    response = api_client.get(reverse(URL_NAME), {'window': 'year'})
    assert response.status_code == status.HTTP_400_BAD_REQUEST
