import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import User
from core_app.models.session_grant import SessionGrant


@pytest.mark.django_db
def test_sessions_remaining_floors_at_zero():
    u = User.objects.create_user(email='g@example.com', password='x', first_name='G', last_name='R')
    g = SessionGrant.objects.create(customer=u, sessions_total=2, sessions_used=3, expires_at=timezone.now() + timedelta(days=1))
    assert g.sessions_remaining == 0


@pytest.mark.django_db
def test_is_active_true_when_remaining_and_not_expired():
    u = User.objects.create_user(email='g2@example.com', password='x', first_name='G', last_name='R')
    g = SessionGrant.objects.create(customer=u, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=1))
    assert g.is_active() is True


@pytest.mark.django_db
def test_is_active_false_when_expired_or_used_up():
    u = User.objects.create_user(email='g3@example.com', password='x', first_name='G', last_name='R')
    expired = SessionGrant.objects.create(customer=u, sessions_total=2, sessions_used=0, expires_at=timezone.now() - timedelta(minutes=1))
    used_up = SessionGrant.objects.create(customer=u, sessions_total=2, sessions_used=2, expires_at=timezone.now() + timedelta(days=1))
    assert expired.is_active() is False
    assert used_up.is_active() is False
