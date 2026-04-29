"""Tests for create_fake_duo_invitations management command."""

from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import Package, Subscription, SubscriptionGuest, User


@pytest.fixture
def semi_package():
    return Package.objects.create(
        title='Programa Inicial',
        category=Package.Category.SEMI_PERSONALIZADO,
        sessions_count=4,
        session_duration_minutes=60,
        price=240000,
        currency='COP',
        validity_days=30,
        is_active=True,
        order=1,
    )


@pytest.mark.django_db
class TestCreateFakeDuoInvitations:
    """Validates the duo host/guest seeding command outcomes."""

    def test_creates_host_guest_subscription_and_accepted_link(self, semi_package):
        """Command creates host, guest, an active subscription, and an accepted guest link."""
        out = StringIO()
        call_command('create_fake_duo_invitations', stdout=out)

        host = User.objects.get(email='host@kore.com')
        guest = User.objects.get(email='guest@kore.com')

        subscription = Subscription.objects.get(customer=host, package=semi_package)
        assert subscription.status == Subscription.Status.ACTIVE

        link = SubscriptionGuest.objects.get(subscription=subscription)
        assert link.status == SubscriptionGuest.STATUS_ACCEPTED
        assert link.guest_id == guest.id
        assert link.invited_email == 'guest@kore.com'
        assert link.accepted_at is not None

    def test_idempotent(self, semi_package):
        """Repeated command runs do not duplicate users, subscriptions, or links."""
        out = StringIO()
        call_command('create_fake_duo_invitations', stdout=out)
        call_command('create_fake_duo_invitations', stdout=out)

        assert User.objects.filter(email__in=['host@kore.com', 'guest@kore.com']).count() == 2
        assert Subscription.objects.filter(customer__email='host@kore.com').count() == 1
        assert SubscriptionGuest.objects.count() == 1

    def test_warns_when_no_semi_package_exists(self):
        """Command emits a warning instead of crashing when no semi_personalizado package exists."""
        out = StringIO()
        call_command('create_fake_duo_invitations', stdout=out)

        assert 'No active semi_personalizado package found' in out.getvalue()
        assert not User.objects.filter(email='host@kore.com').exists()
