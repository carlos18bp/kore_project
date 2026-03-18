"""Tests for custom admin form logic and ModelAdmin methods in core_app.admin."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import MagicMock

import pytest

from core_app.admin import SubscriptionAdmin, SubscriptionAdminForm
from core_app.models import Package, Subscription, User

FIXED_NOW = datetime(2025, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='admtest-cust@kore.com',
        password='testpass123',
        role=User.Role.CUSTOMER,
    )


@pytest.fixture
def package(db):
    return Package.objects.create(
        title='Test Package',
        sessions_count=10,
        price='100000',
        currency='COP',
        validity_days=30,
    )


@pytest.fixture
def subscription(customer, package):
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=package.sessions_count,
        starts_at=FIXED_NOW,
        expires_at=FIXED_NOW + timedelta(days=30),
    )


@pytest.mark.django_db
class TestSubscriptionAdminForm:
    """Covers SubscriptionAdminForm.clean() — admin.py lines 28-36."""

    def test_clean_sets_sessions_total_from_package(self, customer, package):
        """Form clean() auto-fills sessions_total from selected package."""
        form_data = {
            'customer': customer.pk,
            'package': package.pk,
            'sessions_total': 0,
            'sessions_used': 0,
            'status': Subscription.Status.ACTIVE,
            'starts_at': FIXED_NOW,
            'expires_at': FIXED_NOW + timedelta(days=30),
            'payment_source_id': '',
            'payment_method_type': '',
            'is_recurring': True,
            'wompi_transaction_id': '',
            'next_billing_date': None,
            'expiry_email_sent_at': None,
            'expiry_ui_sent_at': None,
        }
        form = SubscriptionAdminForm(data=form_data)
        assert form.is_valid(), form.errors
        cleaned = form.cleaned_data
        assert cleaned['sessions_total'] == package.sessions_count
        assert form.instance.sessions_total == package.sessions_count

    def test_clean_without_package_does_not_set_sessions_total(self, customer):
        """Form clean() skips sessions_total override when no package is selected."""
        form_data = {
            'customer': customer.pk,
            'package': '',
            'sessions_total': 5,
            'sessions_used': 0,
            'status': Subscription.Status.ACTIVE,
            'starts_at': FIXED_NOW,
            'expires_at': FIXED_NOW + timedelta(days=30),
            'payment_source_id': '',
            'payment_method_type': '',
            'is_recurring': True,
            'wompi_transaction_id': '',
            'next_billing_date': None,
            'expiry_email_sent_at': None,
            'expiry_ui_sent_at': None,
        }
        form = SubscriptionAdminForm(data=form_data)
        # package is required, so the form may not be valid, but clean() still runs
        form.is_valid()
        # sessions_total should NOT have been overwritten to package.sessions_count
        assert form.instance.sessions_total != 10


@pytest.mark.django_db
class TestSubscriptionAdminMethods:
    """Covers SubscriptionAdmin.package_program() and save_model() — admin.py lines 172-179."""

    def test_package_program_returns_category_display(self, subscription):
        """package_program() returns the human-readable category label."""
        model_admin = SubscriptionAdmin(Subscription, None)
        result = model_admin.package_program(subscription)
        assert result == subscription.package.get_category_display()

    def test_save_model_sets_sessions_total_from_package(self, subscription):
        """save_model() syncs sessions_total from the related package."""
        model_admin = SubscriptionAdmin(Subscription, None)
        subscription.package.sessions_count = 20
        subscription.package.save()
        subscription.sessions_total = 0

        # quality: disable unverified_mock (pass-through stubs, not behavioral mocks)
        mock_request = MagicMock()
        mock_form = MagicMock()
        model_admin.save_model(mock_request, subscription, mock_form, change=True)

        subscription.refresh_from_db()
        assert subscription.sessions_total == 20
