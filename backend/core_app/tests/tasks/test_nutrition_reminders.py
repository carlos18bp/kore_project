"""Tests for the send_nutrition_reminders Huey task."""

from datetime import timedelta
from unittest.mock import patch

import pytest
from django.utils import timezone

from core_app.models import Notification, Package, Subscription, User
from core_app.models.nutrition_habit import NutritionHabit
from core_app.tasks import send_nutrition_reminders


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nutrition@test.com', password='pass',
        first_name='Nutrition', last_name='User', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def active_subscription(customer, db):
    package = Package.objects.create(
        title='Active Pkg', sessions_count=4, validity_days=30, price='100000.00',
    )
    return Subscription.objects.create(
        customer=customer, package=package,
        sessions_total=4, sessions_used=0,
        status=Subscription.Status.ACTIVE,
        starts_at=timezone.now() - timedelta(days=5),
        expires_at=timezone.now() + timedelta(days=25),
    )


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_sends_reminder_when_no_nutrition_entry(mock_email, customer, active_subscription):
    """Send reminder when customer has never submitted nutrition habits."""
    result = send_nutrition_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 1
    mock_email.assert_called_once()
    assert mock_email.call_args.kwargs['template_name'] == 'nutrition_reminder'
    assert Notification.objects.filter(
        notification_type=Notification.Type.NUTRITION_REMINDER,
        status=Notification.Status.SENT,
    ).count() == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_sends_reminder_when_entry_is_old(mock_email, customer, active_subscription):
    """Send reminder when latest nutrition entry is older than 7 days."""
    habit = NutritionHabit.objects.create(
        customer=customer, meals_per_day=3, water_liters=2.0,
        fruit_weekly=5, vegetable_weekly=5, protein_frequency=3,
        ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
    )
    NutritionHabit.objects.filter(pk=habit.pk).update(
        created_at=timezone.now() - timedelta(days=10),
    )

    result = send_nutrition_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_skips_customer_with_recent_entry(mock_email, customer, active_subscription):
    """Do not send reminder when nutrition entry is recent (within 7 days)."""
    NutritionHabit.objects.create(
        customer=customer, meals_per_day=3, water_liters=2.0,
        fruit_weekly=5, vegetable_weekly=5, protein_frequency=3,
        ultraprocessed_weekly=2, sugary_drinks_weekly=1, eats_breakfast=True,
    )

    result = send_nutrition_reminders.call_local()

    assert result['processed'] == 0
    assert result['sent'] == 0
    mock_email.assert_not_called()


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=False)
def test_creates_failed_notification_on_email_failure(mock_email, customer, active_subscription):
    """Create a FAILED notification when email sending fails."""
    result = send_nutrition_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 0
    assert Notification.objects.filter(
        notification_type=Notification.Type.NUTRITION_REMINDER,
        status=Notification.Status.FAILED,
    ).count() == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_noop_when_no_active_subscriptions(mock_email, customer):
    """Do nothing when no active subscriptions exist."""
    result = send_nutrition_reminders.call_local()

    assert result['processed'] == 0
    assert result['sent'] == 0
    mock_email.assert_not_called()
