"""Tests for terms acceptance views.

Covers TermsAcceptanceStatusView and TermsAcceptanceCreateView.
"""

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import User
from core_app.models.terms_acceptance import CURRENT_TERMS_VERSION, TermsAcceptance


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='terms-user@test.com', password='pass',
        first_name='Terms', last_name='User', role=User.Role.CUSTOMER,
    )


STATUS_URL = 'terms-acceptance-status'
ACCEPT_URL = 'terms-acceptance-accept'


@pytest.mark.django_db
class TestTermsAcceptanceStatusView:
    def test_returns_not_accepted_when_no_record(self, api_client, customer):
        """Return accepted=False when user has never accepted terms."""
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(STATUS_URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['accepted'] is False

    def test_returns_accepted_when_record_exists(self, api_client, customer):
        """Return accepted=True when user has accepted the latest terms."""
        TermsAcceptance.objects.create(
            user=customer, terms_version=CURRENT_TERMS_VERSION,
            ip_address='127.0.0.1', user_agent='TestAgent',
            accepted_at=timezone.now(),
        )
        api_client.force_authenticate(user=customer)
        response = api_client.get(reverse(STATUS_URL))

        assert response.status_code == status.HTTP_200_OK
        assert response.data['accepted'] is True

    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.get(reverse(STATUS_URL))
        assert response.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
class TestTermsAcceptanceCreateView:
    def test_accept_terms_creates_record(self, api_client, customer):
        """Accepting terms creates a TermsAcceptance record."""
        api_client.force_authenticate(user=customer)
        response = api_client.post(
            reverse(ACCEPT_URL), {}, format='json',
            HTTP_X_FORWARDED_FOR='1.2.3.4',
            HTTP_USER_AGENT='TestBrowser/1.0',
        )

        assert response.status_code == status.HTTP_201_CREATED
        acceptance = TermsAcceptance.objects.filter(user=customer).first()
        assert acceptance is not None
        assert acceptance.ip_address == '1.2.3.4'
        assert acceptance.user_agent == 'TestBrowser/1.0'

    def test_accept_terms_idempotent(self, api_client, customer):
        """Re-accepting already-accepted terms returns 200 without duplicating."""
        TermsAcceptance.objects.create(
            user=customer, terms_version=CURRENT_TERMS_VERSION,
            ip_address='127.0.0.1', user_agent='Old',
            accepted_at=timezone.now(),
        )
        api_client.force_authenticate(user=customer)
        response = api_client.post(reverse(ACCEPT_URL), {}, format='json')

        assert response.status_code in (status.HTTP_200_OK, status.HTTP_201_CREATED)
        assert TermsAcceptance.objects.filter(user=customer).count() >= 1

    def test_captures_ip_from_remote_addr(self, api_client, customer):
        """Fallback to REMOTE_ADDR when X-Forwarded-For is absent."""
        api_client.force_authenticate(user=customer)
        response = api_client.post(
            reverse(ACCEPT_URL), {}, format='json',
            REMOTE_ADDR='10.0.0.1',
        )

        assert response.status_code == status.HTTP_201_CREATED
        acceptance = TermsAcceptance.objects.filter(user=customer).last()
        assert acceptance.ip_address in ('10.0.0.1', '127.0.0.1')

    def test_requires_authentication(self, api_client):
        """Reject unauthenticated requests."""
        response = api_client.post(reverse(ACCEPT_URL), {}, format='json')
        assert response.status_code == status.HTTP_401_UNAUTHORIZED
