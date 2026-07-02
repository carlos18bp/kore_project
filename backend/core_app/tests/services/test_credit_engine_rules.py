from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package, User
from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.fixture
def package(db):
    return Package.objects.create(title='P')


@pytest.fixture
def booking(existing_user, package):
    now = timezone.now()
    return Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now - timedelta(hours=2), ends_at=now - timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_confirm_pending_transaction_applies_balance(existing_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Registraste tu almuerzo', status=CreditTransaction.Status.PENDING,
    )
    assert credit_engine.confirm_transaction(tx) is True
    tx.refresh_from_db()
    assert tx.status == 'confirmed'
    assert credit_engine.get_wallet(existing_user).balance == 5
    # Confirming twice must not double-apply
    assert credit_engine.confirm_transaction(tx) is False
    assert credit_engine.get_wallet(existing_user).balance == 5


@pytest.mark.django_db
def test_reject_pending_transaction(existing_user, admin_user):
    tx = credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 2,
        'Registraste tu cena', status=CreditTransaction.Status.PENDING,
    )
    assert credit_engine.reject_transaction(tx, admin_user, 'Foto no válida') is True
    tx.refresh_from_db()
    assert tx.status == 'rejected'
    assert tx.reviewed_by == admin_user
    assert 'Foto no válida' in tx.description
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_record_attendance_attended_awards_credits(booking, existing_user):
    credit_engine.record_attendance(booking, attended=True)
    booking.refresh_from_db()
    assert booking.attendance_status == Booking.AttendanceStatus.ATTENDED
    assert booking.attendance_confirmed_at is not None
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_late_attendance_confirmation_reverses_penalty(booking, existing_user):
    credit_engine.record_attendance(booking, attended=False)
    assert credit_engine.get_wallet(existing_user).balance == -40
    credit_engine.record_attendance(booking, attended=True)
    # -40 (penalty) +40 (reversal) +50 (attended)
    assert credit_engine.get_wallet(existing_user).balance == 50


@pytest.mark.django_db
def test_late_reschedule_penalizes_customer(existing_user, package):
    now = timezone.now()
    old = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(hours=5), ends_at=now + timedelta(hours=6),
        status=Booking.Status.CANCELED,
    )
    new = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now + timedelta(days=3), ends_at=now + timedelta(days=3, hours=1),
    )
    credit_engine.on_reschedule(old, new, acting_user=existing_user)
    assert credit_engine.get_wallet(existing_user).balance == -20
    # Trainer/admin-initiated reschedule must NOT penalize
    tx_count = CreditTransaction.objects.count()
    admin = User.objects.create_user(
        email='a2@example.com', password='x', role=User.Role.ADMIN,
    )
    credit_engine.on_reschedule(old, new, acting_user=admin)
    assert CreditTransaction.objects.count() == tx_count
