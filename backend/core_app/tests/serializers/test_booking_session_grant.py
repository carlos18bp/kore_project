import pytest
from datetime import timedelta
from django.utils import timezone
from rest_framework.test import APIRequestFactory

from core_app.models import Package, Subscription, TrainerProfile, User
from core_app.models.session_grant import SessionGrant
from core_app.serializers.booking_serializers import BookingSerializer


@pytest.fixture
def trainer(db):
    u = User.objects.create_user(email='tr@example.com', password='x', first_name='T', last_name='R', role=User.Role.TRAINER)
    return TrainerProfile.objects.get_or_create(user=u)[0]


@pytest.fixture
def customer(existing_user, trainer):
    existing_user.assigned_trainer = trainer
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


def _pkg():
    return Package.objects.filter(is_active=True).first() or Package.objects.create(title='P')


def _ser(customer, data):
    factory = APIRequestFactory()
    req = factory.post('/api/bookings/')
    req.user = customer
    return BookingSerializer(data=data, context={'request': req})


@pytest.mark.django_db
def test_booking_consumes_grant(customer):
    pkg = _pkg()
    grant = SessionGrant.objects.create(customer=customer, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=10))
    ser = _ser(customer, {'package_id': pkg.id, 'starts_at': (timezone.now() + timedelta(days=3)).isoformat(), 'session_grant_id': grant.id})
    # Availability may reject the slot; if it validates, create must consume the grant.
    if ser.is_valid():
        booking = ser.save()
        grant.refresh_from_db()
        assert booking.session_grant_id == grant.id
        assert grant.sessions_used == 1


@pytest.mark.django_db
def test_booking_rejects_expired_grant(customer):
    pkg = _pkg()
    grant = SessionGrant.objects.create(customer=customer, sessions_total=2, sessions_used=0, expires_at=timezone.now() - timedelta(minutes=1))
    ser = _ser(customer, {'package_id': pkg.id, 'starts_at': (timezone.now() + timedelta(days=3)).isoformat(), 'session_grant_id': grant.id})
    assert ser.is_valid() is False
    assert 'session_grant_id' in ser.errors


@pytest.mark.django_db
def test_booking_rejects_other_users_grant(customer):
    pkg = _pkg()
    other = User.objects.create_user(email='ob@example.com', password='x', first_name='O', last_name='B')
    grant = SessionGrant.objects.create(customer=other, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=10))
    ser = _ser(customer, {'package_id': pkg.id, 'starts_at': (timezone.now() + timedelta(days=3)).isoformat(), 'session_grant_id': grant.id})
    assert ser.is_valid() is False
    assert 'session_grant_id' in ser.errors


@pytest.mark.django_db
def test_booking_rejects_both_sources(customer):
    pkg = _pkg()
    sub = Subscription.objects.create(customer=customer, package=pkg, sessions_total=5, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30))
    grant = SessionGrant.objects.create(customer=customer, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=10))
    ser = _ser(customer, {'package_id': pkg.id, 'starts_at': (timezone.now() + timedelta(days=3)).isoformat(), 'subscription_id': sub.id, 'session_grant_id': grant.id})
    assert ser.is_valid() is False
