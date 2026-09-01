import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models.session_grant import SessionGrant


@pytest.mark.django_db
def test_lists_only_active_grants_for_caller(api_client, existing_user):
    other = existing_user.__class__.objects.create_user(email='o@example.com', password='x', first_name='O', last_name='X')
    SessionGrant.objects.create(customer=existing_user, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=5))
    SessionGrant.objects.create(customer=existing_user, sessions_total=2, sessions_used=2, expires_at=timezone.now() + timedelta(days=5))  # used up
    SessionGrant.objects.create(customer=existing_user, sessions_total=2, sessions_used=0, expires_at=timezone.now() - timedelta(days=1))  # expired
    SessionGrant.objects.create(customer=other, sessions_total=2, sessions_used=0, expires_at=timezone.now() + timedelta(days=5))  # other user
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/session-grants/')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) == 1
    assert data[0]['sessions_remaining'] == 2
