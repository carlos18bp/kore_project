"""Model tests for subscription fields, relations, and computed helpers."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.db.models import ProtectedError

from core_app.models import Package, Subscription, User

FIXED_NOW = datetime(2026, 1, 15, 10, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    """Create a default customer user used by subscription model tests."""
    return User.objects.create_user(email='sub_cust@example.com', password='p')


@pytest.fixture
def package(db):
    """Create a package fixture used to instantiate subscriptions."""
    return Package.objects.create(title='Gold', sessions_count=12, validity_days=30, is_active=True)


@pytest.fixture
def subscription(customer, package):
    """Create an active subscription with partial session usage."""
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=12,
        sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW,
        expires_at=FIXED_NOW + timedelta(days=30),
    )


@pytest.mark.django_db
class TestSubscriptionModel:
    """Subscription model behavior for defaults, helpers, and protections."""

    def test_create_subscription(self, subscription):
        """Persist subscription records with expected status and session values."""
        assert subscription.pk is not None
        assert subscription.status == 'active'
        assert subscription.sessions_total == 12
        assert subscription.sessions_used == 3

    def test_sessions_remaining_property(self, subscription):
        """Compute remaining sessions from total sessions minus used sessions."""
        remaining = subscription.sessions_remaining
        assert remaining == 9
        assert remaining == subscription.sessions_total - subscription.sessions_used

    def test_sessions_remaining_floors_at_zero(self, customer, package):
        """Clamp remaining sessions at zero when consumed sessions exceed total."""
        sub = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=5,
            sessions_used=10,
            starts_at=FIXED_NOW,
            expires_at=FIXED_NOW + timedelta(days=30),
        )
        assert sub.sessions_remaining == 0

    def test_str_representation(self, subscription):
        """Render subscription string representation with customer and package info."""
        s = str(subscription)
        assert 'sub_cust@example.com' in s
        assert 'Gold' in s

    def test_status_choices(self):
        """Expose expected status enum values for active, expired, and canceled records."""
        assert Subscription.Status.ACTIVE == 'active'
        assert Subscription.Status.EXPIRED == 'expired'
        assert Subscription.Status.CANCELED == 'canceled'

    def test_protect_on_customer_delete(self, subscription):
        """Protect customer deletion while linked subscriptions still exist."""
        with pytest.raises(ProtectedError):
            subscription.customer.delete()
        assert User.objects.filter(pk=subscription.customer_id).exists()

    def test_protect_on_package_delete(self, subscription):
        """Protect package deletion while linked subscriptions still exist."""
        with pytest.raises(ProtectedError):
            subscription.package.delete()
        assert Package.objects.filter(pk=subscription.package_id).exists()

    def test_ordering_by_created_at_desc(self, customer, package):
        """Orders subscriptions by most recently created record first."""
        s1 = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=1,
            starts_at=FIXED_NOW,
            expires_at=FIXED_NOW + timedelta(days=1),
        )
        s2 = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=1,
            starts_at=FIXED_NOW,
            expires_at=FIXED_NOW + timedelta(days=1),
        )
        ids = list(Subscription.objects.values_list('id', flat=True))
        assert ids == [s2.id, s1.id]
