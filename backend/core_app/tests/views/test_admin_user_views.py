"""Tests for AdminUserViewSet — admin-only user management endpoints."""

from datetime import datetime, timedelta
from unittest.mock import patch

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Subscription, SubscriptionGuest, User

FIXED_NOW = timezone.make_aware(datetime(2026, 5, 6, 10, 0, 0))


# ── Fixtures ───────────────────────────────────────────────────────────────

@pytest.fixture
def admin_user(db):
    return User.objects.create_user(
        email='admin-fixture@kore.com', password='p',
        first_name='Admin', last_name='Fixture', role=User.Role.ADMIN,
    )


@pytest.fixture
def customer_user(db):
    return User.objects.create_user(
        email='customer@example.com', password='p',
        first_name='Ana', last_name='Martínez', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def trainer_user(db):
    return User.objects.create_user(
        email='trainer@example.com', password='p',
        first_name='Carlos', last_name='Mendoza', role=User.Role.TRAINER,
    )


@pytest.fixture
def package_duo(db):
    return Package.objects.create(
        title='Plan Pareja', sessions_count=8, validity_days=60,
        price='240000', currency='COP', is_active=True,
        category='semi_personalizado',
    )


@pytest.fixture
def package_individual(db):
    return Package.objects.create(
        title='Plan Estándar', sessions_count=8, validity_days=30,
        price='320000', currency='COP', is_active=True,
        category='personalizado',
    )


# ── list — auth + filters ──────────────────────────────────────────────────

@pytest.mark.django_db
def test_list_requires_admin(api_client, customer_user):
    api_client.force_authenticate(user=customer_user)
    resp = api_client.get(reverse('admin-user-list'))
    assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_list_search_by_email_or_name(api_client, admin_user, customer_user, trainer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-list'), {'search': 'martínez'})
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data['results']
    emails = [u['email'] for u in results]
    assert customer_user.email in emails
    assert trainer_user.email not in emails


@pytest.mark.django_db
def test_list_filter_by_role(api_client, admin_user, customer_user, trainer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-list'), {'role': 'trainer'})
    assert resp.status_code == status.HTTP_200_OK
    results = resp.data['results']
    assert all(u['role'] == 'trainer' for u in results)


@pytest.mark.django_db
def test_list_excludes_soft_deleted(api_client, admin_user, customer_user):
    customer_user.is_deleted = True
    customer_user.save()
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-list'))
    ids = [u['id'] for u in resp.data['results']]
    assert customer_user.id not in ids


# ── create — generates temp password and emails ─────────────────────────────

@pytest.mark.django_db
def test_create_generates_temp_password_and_emails(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    payload = {
        'email': 'new@example.com',
        'first_name': 'Nueva',
        'last_name': 'Persona',
        'phone': '+57 300 0000000',
        'role': 'customer',
    }
    with patch('core_app.views.admin_user_views.send_admin_user_invitation') as mock_send:
        resp = api_client.post(reverse('admin-user-list'), payload, format='json')
    assert resp.status_code == status.HTTP_201_CREATED
    user = User.objects.get(email='new@example.com')
    assert user.must_change_password is True
    assert user.role == 'customer'
    assert mock_send.called
    args, _ = mock_send.call_args
    assert args[0].id == user.id
    temp_password = args[1]
    assert len(temp_password) >= 8
    # The temp password must NOT be in the API response
    body = resp.json()
    assert temp_password not in str(body)


@pytest.mark.django_db
def test_create_email_must_be_unique(api_client, admin_user, customer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.post(reverse('admin-user-list'), {
        'email': customer_user.email,
        'first_name': 'X', 'last_name': 'Y', 'role': 'customer',
    }, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert 'email' in resp.data


@pytest.mark.django_db
def test_create_role_admin_rejected(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.post(reverse('admin-user-list'), {
        'email': 'rogue@example.com',
        'first_name': 'Bad', 'last_name': 'Actor', 'role': 'admin',
    }, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST
    assert 'role' in resp.data


# ── retrieve — subscriptions with role field ────────────────────────────────

@pytest.mark.django_db
def test_retrieve_marks_host_for_semi_personalizado(api_client, admin_user, customer_user, package_duo):
    Subscription.objects.create(
        customer=customer_user, package=package_duo,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=60),
    )
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-detail', kwargs={'pk': customer_user.pk}))
    assert resp.status_code == status.HTTP_200_OK
    subs = resp.data['subscriptions']
    assert len(subs) == 1
    assert subs[0]['role'] == 'host'
    assert subs[0]['package']['category'] == 'semi_personalizado'


@pytest.mark.django_db
def test_retrieve_marks_individual_for_personalizado(api_client, admin_user, customer_user, package_individual):
    Subscription.objects.create(
        customer=customer_user, package=package_individual,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-detail', kwargs={'pk': customer_user.pk}))
    subs = resp.data['subscriptions']
    assert subs[0]['role'] == 'individual'


@pytest.mark.django_db
def test_retrieve_marks_guest_for_accepted_invite(
    api_client, admin_user, customer_user, package_duo,
):
    host = User.objects.create_user(
        email='host@example.com', password='p',
        first_name='Host', last_name='User', role=User.Role.CUSTOMER,
    )
    sub = Subscription.objects.create(
        customer=host, package=package_duo,
        sessions_total=8, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=60),
    )
    SubscriptionGuest.objects.create(
        subscription=sub, guest=customer_user,
        invited_email=customer_user.email,
        status=SubscriptionGuest.STATUS_ACCEPTED,
        accepted_at=FIXED_NOW, token='tok123',
    )
    api_client.force_authenticate(user=admin_user)
    resp = api_client.get(reverse('admin-user-detail', kwargs={'pk': customer_user.pk}))
    subs = resp.data['subscriptions']
    assert any(s['role'] == 'guest' for s in subs)


# ── update — permitted fields ───────────────────────────────────────────────

@pytest.mark.django_db
def test_partial_update_changes_fields(api_client, admin_user, customer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.patch(
        reverse('admin-user-detail', kwargs={'pk': customer_user.pk}),
        {'first_name': 'Updated', 'is_active': False},
        format='json',
    )
    assert resp.status_code == status.HTTP_200_OK
    customer_user.refresh_from_db()
    assert customer_user.first_name == 'Updated'
    assert customer_user.is_active is False


@pytest.mark.django_db
def test_partial_update_cannot_promote_to_admin(api_client, admin_user, customer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.patch(
        reverse('admin-user-detail', kwargs={'pk': customer_user.pk}),
        {'role': 'admin'}, format='json',
    )
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


# ── reset-password action ───────────────────────────────────────────────────

@pytest.mark.django_db
def test_reset_password_regenerates_and_emails(api_client, admin_user, customer_user):
    customer_user.must_change_password = False
    customer_user.save()
    api_client.force_authenticate(user=admin_user)
    with patch('core_app.views.admin_user_views.send_admin_user_invitation') as mock_send:
        resp = api_client.post(
            reverse('admin-user-reset-password', kwargs={'pk': customer_user.pk}),
        )
    assert resp.status_code == status.HTTP_200_OK
    customer_user.refresh_from_db()
    assert customer_user.must_change_password is True
    assert mock_send.called


# ── toggle-active action ────────────────────────────────────────────────────

@pytest.mark.django_db
def test_toggle_active_action(api_client, admin_user, customer_user):
    api_client.force_authenticate(user=admin_user)
    assert customer_user.is_active is True
    resp = api_client.post(reverse('admin-user-toggle-active', kwargs={'pk': customer_user.pk}))
    assert resp.status_code == status.HTTP_200_OK
    customer_user.refresh_from_db()
    assert customer_user.is_active is False


# ── soft delete ─────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_destroy_soft_deletes(api_client, admin_user, customer_user):
    api_client.force_authenticate(user=admin_user)
    resp = api_client.delete(reverse('admin-user-detail', kwargs={'pk': customer_user.pk}))
    assert resp.status_code == status.HTTP_204_NO_CONTENT
    customer_user.refresh_from_db()
    assert customer_user.is_deleted is True
    assert customer_user.is_active is False


# ── change-password endpoint clears must_change_password flag ──────────────

@pytest.mark.django_db
def test_change_password_clears_must_change_password_flag(api_client, customer_user):
    customer_user.set_password('OldPwd1234')
    customer_user.must_change_password = True
    customer_user.save()
    api_client.force_authenticate(user=customer_user)
    resp = api_client.post(reverse('change-password'), {
        'current_password': 'OldPwd1234',
        'new_password': 'NewerPassword123',
        'new_password_confirm': 'NewerPassword123',
    }, format='json')
    assert resp.status_code == status.HTTP_200_OK
    customer_user.refresh_from_db()
    assert customer_user.must_change_password is False
