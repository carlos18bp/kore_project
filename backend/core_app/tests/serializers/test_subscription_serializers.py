"""Tests for subscription serializers."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from decimal import Decimal

import pytest

from core_app.models import Package, Subscription, User
from core_app.serializers.subscription_serializers import SubscriptionSerializer

FIXED_NOW = datetime(2025, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    """Create a customer user for subscription tests."""
    return User.objects.create_user(
        email='sub_ser_cust@example.com', password='p', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    """Create an active package."""
    return Package.objects.create(
        title='Plan Test', price=Decimal('150000'), sessions_count=8,
        validity_days=30, is_active=True,
    )


@pytest.fixture
def subscription(customer, package):
    """Create an active subscription with partial usage."""
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=8, sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
    )


@pytest.mark.django_db
class TestSubscriptionSerializer:
    """Validate SubscriptionSerializer field output and computed properties."""

    def test_serializes_expected_fields(self, subscription):
        """Output contains all declared fields including computed ones."""
        data = SubscriptionSerializer(subscription).data
        expected_fields = {
            'id', 'customer_email', 'package', 'sessions_total',
            'sessions_used', 'sessions_remaining', 'status',
            'starts_at', 'expires_at', 'next_billing_date',
            'is_recurring', 'billing_failed_at',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields

    def test_sessions_remaining_computed(self, subscription):
        """Compute sessions_remaining as sessions_total - sessions_used."""
        data = SubscriptionSerializer(subscription).data
        assert data['sessions_remaining'] == 5

    def test_sessions_remaining_zero_floor(self, customer, package):
        """Floor sessions_remaining at zero when sessions_used exceeds total."""
        sub = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=4, sessions_used=6,
            status=Subscription.Status.ACTIVE,
            starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
        )
        data = SubscriptionSerializer(sub).data
        assert data['sessions_remaining'] == 0

    def test_customer_email_nested(self, subscription, customer):
        """Resolve customer_email from the nested customer relation."""
        data = SubscriptionSerializer(subscription).data
        assert data['customer_email'] == customer.email

    def test_package_nested_serialization(self, subscription, package):
        """Include nested package data via PackageSerializer."""
        data = SubscriptionSerializer(subscription).data
        assert isinstance(data['package'], dict)
        assert data['package']['title'] == package.title
        assert data['package']['sessions_count'] == package.sessions_count

    def test_read_only_timestamps_ignored_on_input(self, subscription):
        """Ignore created_at and updated_at values provided in input payloads."""
        serializer = SubscriptionSerializer(
            subscription,
            data={'created_at': '2020-01-01T00:00:00Z', 'updated_at': '2020-01-01T00:00:00Z'},
            partial=True,
        )
        assert serializer.is_valid(), serializer.errors

    def test_status_values(self, customer, package):
        """Serialize different status values correctly."""
        for status_choice in Subscription.Status:
            sub = Subscription.objects.create(
                customer=customer, package=package,
                sessions_total=4, sessions_used=0,
                status=status_choice,
                starts_at=FIXED_NOW, expires_at=FIXED_NOW + timedelta(days=30),
            )
            data = SubscriptionSerializer(sub).data
            assert data['status'] == status_choice.value
