"""Additional tests for duo_invite_views — covering the missing branches.

Missing lines targeted:
  - line 26: empty/missing token → 400
  - line 42: authenticated user whose email does NOT match invitation → 400
  - lines 79-89: pending_invitation view (unauthenticated, no pending, has pending)
"""

import pytest
from django.urls import reverse
from django.utils import timezone
from datetime import timedelta
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Package, Subscription, SubscriptionGuest, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def host(db):
    return User.objects.create_user(
        email='di-host@test.com', password='p',
        first_name='Host', last_name='Di', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def guest_user(db):
    return User.objects.create_user(
        email='di-guest@test.com', password='p',
        first_name='Guest', last_name='Di', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def other_user(db):
    return User.objects.create_user(
        email='di-other@test.com', password='p',
        first_name='Other', last_name='Di', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def duo_package(db):
    return Package.objects.create(
        title='Pareja DI', category='semi_personalizado',
        sessions_count=8, validity_days=30, is_active=True,
    )


@pytest.fixture
def active_sub(host, duo_package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=host, package=duo_package,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


# ---------------------------------------------------------------------------
# accept_invite — missing branches
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_accept_invite_missing_token_returns_400(api_client):
    """POST without token body field returns 400."""
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert 'token' in resp.data['detail'].lower()


@pytest.mark.django_db
def test_accept_invite_empty_token_returns_400(api_client):
    """POST with empty string token returns 400."""
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': '   '}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_accept_invite_authenticated_wrong_email_returns_400(
    api_client, other_user, active_sub
):
    """Authenticated user whose email does NOT match the invitation gets 400."""
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_sub,
        invited_email='di-guest@test.com',  # different from other_user's email
        token=token,
        status=SubscriptionGuest.STATUS_PENDING,
    )
    api_client.force_authenticate(user=other_user)  # other_user@test.com != di-guest@test.com
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': token}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert 'no corresponde' in resp.data['detail']


# ---------------------------------------------------------------------------
# pending_invitation — all branches
# ---------------------------------------------------------------------------

@pytest.mark.django_db
def test_pending_invitation_unauthenticated_returns_401(api_client):
    """Unauthenticated request to pending_invitation returns 401."""
    url = reverse('subscription-pending-invitation')
    resp = api_client.get(url)
    assert resp.status_code == status.HTTP_401_UNAUTHORIZED


@pytest.mark.django_db
def test_pending_invitation_no_pending_returns_204(api_client, guest_user):
    """Authenticated user with no pending invitation returns 204."""
    api_client.force_authenticate(user=guest_user)
    url = reverse('subscription-pending-invitation')
    resp = api_client.get(url)
    assert resp.status_code == status.HTTP_204_NO_CONTENT


@pytest.mark.django_db
def test_pending_invitation_returns_200_with_data(
    api_client, guest_user, active_sub, host
):
    """Authenticated user with a pending invitation gets 200 with invitation data."""
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_sub,
        invited_email=guest_user.email,
        token=token,
        status=SubscriptionGuest.STATUS_PENDING,
    )
    api_client.force_authenticate(user=guest_user)
    url = reverse('subscription-pending-invitation')
    resp = api_client.get(url)
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['token'] == token
    assert resp.data['invited_email'] == guest_user.email
    assert 'host_name' in resp.data
    assert 'package_title' in resp.data
