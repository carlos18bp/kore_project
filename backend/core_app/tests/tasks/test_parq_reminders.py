"""Tests for the send_parq_reminders Huey task."""

from datetime import datetime, timedelta
from datetime import timezone as dt_tz
from unittest.mock import patch

import pytest

from core_app.models import Notification, Package, Subscription, User
from core_app.models.parq_assessment import ParqAssessment
from core_app.tasks import send_parq_reminders

FIXED_NOW = datetime(2026, 3, 1, 10, 0, tzinfo=dt_tz.utc)


@pytest.fixture(autouse=True)
def freeze_now(monkeypatch):
    """Freeze timezone.now so time-based assertions are deterministic."""
    monkeypatch.setattr('django.utils.timezone.now', lambda: FIXED_NOW)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='parq@test.com', password='pass',
        first_name='Parq', last_name='User', role=User.Role.CUSTOMER,
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
        starts_at=FIXED_NOW - timedelta(days=5),
        expires_at=FIXED_NOW + timedelta(days=25),
    )


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_sends_reminder_when_no_parq_entry(mock_email, customer, active_subscription):
    """Send reminder when customer has never submitted PAR-Q."""
    result = send_parq_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 1
    mock_email.assert_called_once()
    assert mock_email.call_args.kwargs['template_name'] == 'parq_reminder'
    assert Notification.objects.filter(
        notification_type=Notification.Type.PARQ_REMINDER,
        status=Notification.Status.SENT,
    ).count() == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_sends_reminder_when_entry_is_old(mock_email, customer, active_subscription):
    """Send reminder when latest PAR-Q is older than 90 days."""
    parq = ParqAssessment.objects.create(
        customer=customer,
        q1_heart_condition=False, q2_chest_pain=False,
        q3_dizziness=False, q4_chronic_condition=False,
        q5_prescribed_medication=False, q6_bone_joint_problem=False,
        q7_medical_supervision=False,
    )
    ParqAssessment.objects.filter(pk=parq.pk).update(
        created_at=FIXED_NOW - timedelta(days=100),
    )

    result = send_parq_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_skips_customer_with_recent_entry(mock_email, customer, active_subscription):
    """Do not send reminder when PAR-Q is recent (within 90 days)."""
    ParqAssessment.objects.create(
        customer=customer,
        q1_heart_condition=False, q2_chest_pain=False,
        q3_dizziness=False, q4_chronic_condition=False,
        q5_prescribed_medication=False, q6_bone_joint_problem=False,
        q7_medical_supervision=False,
    )

    result = send_parq_reminders.call_local()

    assert result['processed'] == 0
    assert result['sent'] == 0
    mock_email.assert_not_called()


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=False)
def test_creates_failed_notification_on_email_failure(mock_email, customer, active_subscription):
    """Create a FAILED notification when email sending fails."""
    result = send_parq_reminders.call_local()

    assert result['processed'] == 1
    assert result['sent'] == 0
    assert Notification.objects.filter(
        notification_type=Notification.Type.PARQ_REMINDER,
        status=Notification.Status.FAILED,
    ).count() == 1


@pytest.mark.django_db
@patch('core_app.services.email_service.send_template_email', return_value=True)
def test_noop_when_no_active_subscriptions(mock_email, customer):
    """Do nothing when no active subscriptions exist."""
    result = send_parq_reminders.call_local()

    assert result['processed'] == 0
    assert result['sent'] == 0
    mock_email.assert_not_called()
