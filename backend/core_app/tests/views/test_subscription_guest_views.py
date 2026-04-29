"""Tests for SubscriptionGuest invite/revoke/accept endpoints."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import Package, Subscription, SubscriptionGuest, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def host(db):
    return User.objects.create_user(
        email='host@example.com', password='p',
        first_name='Ana', last_name='Host', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def guest_user(db):
    return User.objects.create_user(
        email='guest@example.com', password='p',
        first_name='Bob', last_name='Guest', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def duo_package(db):
    return Package.objects.create(
        title='Pareja FLW', category='semi_personalizado',
        sessions_count=8, validity_days=30, is_active=True,
    )


@pytest.fixture
def active_duo_sub(host, duo_package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=host, package=duo_package,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )


# ---- invite-guest ----

@pytest.mark.django_db
@patch('core_app.services.email_service.send_duo_invitation', return_value=True)
def test_invite_guest_creates_guest_link(mock_send, api_client, host, active_duo_sub):
    api_client.force_authenticate(user=host)
    url = reverse('subscription-invite-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url, {'email': 'invited@example.com'}, format='json')
    assert resp.status_code == status.HTTP_201_CREATED
    assert resp.data['status'] == 'pending'
    assert SubscriptionGuest.objects.filter(subscription=active_duo_sub).exists()
    mock_send.assert_called_once()


@pytest.mark.django_db
def test_invite_guest_rejects_non_host(api_client, guest_user, active_duo_sub):
    # Non-host can't even see the subscription in their queryset → 404
    api_client.force_authenticate(user=guest_user)
    url = reverse('subscription-invite-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url, {'email': 'someone@example.com'}, format='json')
    assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
def test_invite_guest_rejects_self_invite(api_client, host, active_duo_sub):
    api_client.force_authenticate(user=host)
    url = reverse('subscription-invite-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url, {'email': host.email}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_invite_guest_rejects_non_duo_plan(api_client, host, db):
    package = Package.objects.create(
        title='Personal', category='personalizado',
        sessions_count=8, validity_days=30, is_active=True,
    )
    now = timezone.now()
    sub = Subscription.objects.create(
        customer=host, package=package,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=now, expires_at=now + timedelta(days=30),
    )
    api_client.force_authenticate(user=host)
    url = reverse('subscription-invite-guest', kwargs={'pk': sub.pk})
    resp = api_client.post(url, {'email': 'someone@example.com'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_invite_guest_rejects_if_already_accepted(api_client, host, guest_user, active_duo_sub):
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        guest=guest_user,
        invited_email=guest_user.email,
        token=SubscriptionGuest.generate_token(),
        status=SubscriptionGuest.STATUS_ACCEPTED,
    )
    api_client.force_authenticate(user=host)
    url = reverse('subscription-invite-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url, {'email': 'new@example.com'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ---- revoke-guest ----

@pytest.mark.django_db
def test_revoke_guest_sets_status_revoked(api_client, host, active_duo_sub):
    gl = SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email='invited@example.com',
        token=SubscriptionGuest.generate_token(),
        status=SubscriptionGuest.STATUS_PENDING,
    )
    api_client.force_authenticate(user=host)
    url = reverse('subscription-revoke-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url)
    assert resp.status_code == status.HTTP_200_OK
    gl.refresh_from_db()
    assert gl.status == SubscriptionGuest.STATUS_REVOKED
    assert gl.guest is None


@pytest.mark.django_db
def test_revoke_guest_rejects_non_host(api_client, guest_user, active_duo_sub):
    # Pending guest link — guest_user can't see the subscription → 404
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email='invited@example.com',
        token=SubscriptionGuest.generate_token(),
        status=SubscriptionGuest.STATUS_PENDING,
    )
    api_client.force_authenticate(user=guest_user)
    url = reverse('subscription-revoke-guest', kwargs={'pk': active_duo_sub.pk})
    resp = api_client.post(url)
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---- accept-invite ----

@pytest.mark.django_db
def test_accept_invite_authenticated_matching_user(api_client, guest_user, active_duo_sub):
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email=guest_user.email,
        token=token,
        status=SubscriptionGuest.STATUS_PENDING,
    )
    api_client.force_authenticate(user=guest_user)
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': token}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['accepted'] is True
    assert resp.data['subscription_id'] == active_duo_sub.pk


@pytest.mark.django_db
def test_accept_invite_requires_login_for_existing_user(api_client, guest_user, active_duo_sub):
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email=guest_user.email,
        token=token,
        status=SubscriptionGuest.STATUS_PENDING,
    )
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': token}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data.get('requires_login') is True


@pytest.mark.django_db
def test_accept_invite_requires_registration_for_new_email(api_client, active_duo_sub):
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email='brand_new@example.com',
        token=token,
        status=SubscriptionGuest.STATUS_PENDING,
    )
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': token}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data.get('requires_registration') is True


@pytest.mark.django_db
def test_accept_invite_revoked_token_returns_400(api_client, active_duo_sub):
    token = SubscriptionGuest.generate_token()
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        invited_email='revoked@example.com',
        token=token,
        status=SubscriptionGuest.STATUS_REVOKED,
    )
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': token}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_accept_invite_invalid_token_returns_404(api_client):
    url = reverse('subscription-accept-invite')
    resp = api_client.post(url, {'token': 'nonexistent_token'}, format='json')
    assert resp.status_code == status.HTTP_404_NOT_FOUND


# ---- guest_info in serializer ----

@pytest.mark.django_db
def test_subscription_list_includes_guest_info_for_host(api_client, host, guest_user, active_duo_sub):
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        guest=guest_user,
        invited_email=guest_user.email,
        token=SubscriptionGuest.generate_token(),
        status=SubscriptionGuest.STATUS_ACCEPTED,
    )
    api_client.force_authenticate(user=host)
    resp = api_client.get(reverse('subscription-list'))
    assert resp.status_code == status.HTTP_200_OK
    sub_data = next(s for s in resp.data['results'] if s['id'] == active_duo_sub.pk)
    assert sub_data['is_guest'] is False
    assert sub_data['guest_info']['status'] == 'accepted'


@pytest.mark.django_db
def test_subscription_list_guest_sees_subscription_as_guest(
    api_client, host, guest_user, active_duo_sub
):
    SubscriptionGuest.objects.create(
        subscription=active_duo_sub,
        guest=guest_user,
        invited_email=guest_user.email,
        token=SubscriptionGuest.generate_token(),
        status=SubscriptionGuest.STATUS_ACCEPTED,
    )
    api_client.force_authenticate(user=guest_user)
    resp = api_client.get(reverse('subscription-list'))
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data.get('results', resp.data)
    assert any(s['is_guest'] is True for s in results)
