"""Additional tests for progress_views — covering the missing branches.

Missing lines targeted:
  - WeeklySummaryView line 20->25, 22-23: week out-of-range (0, 5), week=abc
  - WeeklySummaryView line 28: service returns data (not None) → 200 with body
  - ProjectionView line 40: service returns data → 200 with body
  - MonthlySummaryView line 54: service returns data → 200 with body;
                                 program=abc (non-digit) treated as None

The existing tests cover the None-return path and the week=7 (out-of-range) case.
These tests cover the remaining branches using mocked service functions.
"""

from unittest.mock import patch

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='pve-customer@test.com', password='p',
        first_name='PVE', last_name='Customer', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestWeeklySummaryViewExtra:
    """Missing branches: out-of-range weeks and service returning real data."""

    def test_week_zero_returns_400(self, api_client, customer):
        """week=0 is out of range (1–4) and should return 400."""
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-weekly-summary'), {'week': '0'})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_week_five_returns_400(self, api_client, customer):
        """week=5 is out of range (1–4) and should return 400."""
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-weekly-summary'), {'week': '5'})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_week_abc_returns_400(self, api_client, customer):
        """week=abc triggers the ValueError branch and returns 400."""
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-weekly-summary'), {'week': 'abc'})
        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    @patch('core_app.views.progress_views.get_weekly_summary')
    def test_valid_week_returns_200_with_data(self, mock_summary, api_client, customer):
        """When service returns data for a valid week, view returns 200 with body."""
        mock_summary.return_value = {
            'week': 2,
            'adherence_pct': 85.0,
            'completed': 6,
            'total': 7,
        }
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-weekly-summary'), {'week': '2'})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['week'] == 2
        mock_summary.assert_called_once_with(customer, 2)


@pytest.mark.django_db
class TestProjectionViewExtra:
    """Missing branch: service returns real data (not None) → 200 with body."""

    @patch('core_app.views.progress_views.get_projection')
    def test_projection_returns_200_with_data(self, mock_proj, api_client, customer):
        """ProjectionView returns 200 with body when service returns data."""
        mock_proj.return_value = {
            'projected_completion_pct': 72.0,
            'on_track': True,
        }
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-projection'))
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['on_track'] is True
        mock_proj.assert_called_once_with(customer)


@pytest.mark.django_db
class TestMonthlySummaryViewExtra:
    """Missing branches: non-digit program param and service returning data."""

    @patch('core_app.views.progress_views.get_monthly_summary')
    def test_program_abc_treated_as_none(self, mock_summary, api_client, customer):
        """Non-digit program param (abc) is coerced to None and passed to service."""
        mock_summary.return_value = None
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-monthly-summary'), {'program': 'abc'})
        # Non-digit → pid=None, service returns None → 200 null
        assert resp.status_code == status.HTTP_200_OK
        mock_summary.assert_called_once_with(customer, None)

    @patch('core_app.views.progress_views.get_monthly_summary')
    def test_valid_program_returns_200_with_data(self, mock_summary, api_client, customer):
        """MonthlySummaryView returns 200 with body when service returns data."""
        mock_summary.return_value = {
            'adherence_pct': 78.5,
            'total_days': 28,
            'completed_days': 22,
        }
        api_client.force_authenticate(user=customer)
        resp = api_client.get(reverse('my-program-monthly-summary'), {'program': '42'})
        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['adherence_pct'] == 78.5
        mock_summary.assert_called_once_with(customer, 42)
