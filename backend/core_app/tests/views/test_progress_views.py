"""Contract tests: WeeklySummaryView / ProjectionView / MonthlySummaryView
return 200 + null when the customer has no active program (previously 404).
"""
import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='prog-cust@test.com', password='p',
        first_name='Pat', last_name='Pr', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestWeeklySummaryView:
    def test_returns_200_null_when_no_program(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-weekly-summary'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None

    def test_still_rejects_invalid_week_param_with_400(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-weekly-summary'), {'week': '7'})

        assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestProjectionView:
    def test_returns_200_null_when_no_program(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-projection'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None


@pytest.mark.django_db
class TestMonthlySummaryView:
    def test_returns_200_null_when_no_program(self, api_client, customer):
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse('my-program-monthly-summary'))

        assert response.status_code == status.HTTP_200_OK
        assert response.data is None
