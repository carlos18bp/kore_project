"""Tests for custom admin form logic and ModelAdmin methods in core_app.admin."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone
from unittest.mock import MagicMock

import pytest
from django.contrib.admin import AdminSite
from django.test import RequestFactory, TestCase

from core_app.admin import SubscriptionAdmin, SubscriptionAdminForm
from core_app.models import Package, Payment, Subscription, User

FIXED_NOW = datetime(2025, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


def _build_subscription_form_data(customer_pk, package_pk='', sessions_total=0, **overrides):
    """Build a default form_data dict for SubscriptionAdminForm."""
    data = {
        'customer': customer_pk,
        'package': package_pk,
        'sessions_total': sessions_total,
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
    data.update(overrides)
    return data


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
        form_data = _build_subscription_form_data(customer.pk, package_pk=package.pk)
        form = SubscriptionAdminForm(data=form_data)
        assert form.is_valid(), form.errors
        cleaned = form.cleaned_data
        assert cleaned['sessions_total'] == package.sessions_count
        assert form.instance.sessions_total == package.sessions_count

    def test_clean_without_package_does_not_set_sessions_total(self, customer):
        """Form clean() skips sessions_total override when no package is selected."""
        form_data = _build_subscription_form_data(customer.pk, sessions_total=5)
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


@pytest.mark.django_db
class TestSubscriptionAdminRenewLink:
    """Cover renew_link() both branches — admin.py lines 192-199."""

    def _make_admin(self):
        return SubscriptionAdmin(Subscription, AdminSite())

    def test_renew_link_returns_dash_when_subscription_is_active_and_not_expired(self, subscription):
        """renew_link returns '-' for an active subscription that hasn't expired yet."""
        from django.utils import timezone
        subscription.status = Subscription.Status.ACTIVE
        subscription.expires_at = timezone.now() + timedelta(days=30)
        subscription.save(update_fields=['status', 'expires_at'])
        result = self._make_admin().renew_link(subscription)
        assert result == '-'

    def test_renew_link_returns_button_html_when_subscription_is_expired(self, subscription):
        """renew_link returns the renovation button HTML for an expired subscription."""
        subscription.status = Subscription.Status.EXPIRED
        subscription.save(update_fields=['status'])
        result = str(self._make_admin().renew_link(subscription))
        assert 'href=' in result
        assert 'Renovar' in result


@pytest.mark.django_db
class TestSubscriptionAdminRenewView(TestCase):
    """Cover renew_subscription_view() GET and POST paths — admin.py lines 217-268."""

    def setUp(self):
        self.staff = User.objects.create_user(
            email='staff@kore.com', password='staffpass',
            role=User.Role.ADMIN, is_staff=True, is_superuser=True,
        )
        self.customer = User.objects.create_user(
            email='renew-cust@kore.com', password='p', role=User.Role.CUSTOMER,
        )
        self.package = Package.objects.create(
            title='Renew Pkg', sessions_count=8, price='80000',
            currency='COP', validity_days=30, is_active=True,
        )
        from django.utils import timezone
        now = timezone.now()
        self.subscription = Subscription.objects.create(
            customer=self.customer,
            package=self.package,
            sessions_total=8,
            starts_at=now - timedelta(days=31),
            expires_at=now - timedelta(days=1),
            status=Subscription.Status.ACTIVE,
        )
        self.client.force_login(self.staff)
        self.url = f'/admin/core_app/subscription/{self.subscription.pk}/renew/'

    def test_get_shows_confirmation_page(self):
        """GET /renew/ renders the confirmation template with subscription context."""
        response = self.client.get(self.url)
        self.assertEqual(response.status_code, 200)
        self.assertIn('subscription', response.context)

    def test_post_creates_new_subscription_and_payment(self):
        """POST /renew/ creates a new active subscription and a cash payment record."""
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 302)
        self.assertEqual(Subscription.objects.filter(customer=self.customer).count(), 2)
        new_sub = Subscription.objects.filter(
            customer=self.customer, status=Subscription.Status.ACTIVE,
        ).exclude(pk=self.subscription.pk).first()
        self.assertIsNotNone(new_sub)
        self.assertTrue(Payment.objects.filter(subscription=new_sub).exists())

    def test_post_marks_old_active_subscription_as_expired(self):
        """POST /renew/ transitions the old active subscription to EXPIRED status."""
        self.client.post(self.url)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, Subscription.Status.EXPIRED)

    def test_post_does_not_double_mark_already_expired_subscription(self):
        """POST /renew/ skips the status update when old subscription is already EXPIRED."""
        self.subscription.status = Subscription.Status.EXPIRED
        self.subscription.save(update_fields=['status'])
        response = self.client.post(self.url)
        self.assertEqual(response.status_code, 302)
        self.subscription.refresh_from_db()
        self.assertEqual(self.subscription.status, Subscription.Status.EXPIRED)
