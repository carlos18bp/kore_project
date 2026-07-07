import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import User
from core_app.models.session_grant import SessionGrant
from core_app.serializers.session_grant_serializers import SessionGrantSerializer


@pytest.mark.django_db
def test_session_grant_serializer_shape():
    u = User.objects.create_user(email='ss@example.com', password='x', first_name='S', last_name='T')
    g = SessionGrant.objects.create(customer=u, sessions_total=3, sessions_used=1, expires_at=timezone.now() + timedelta(days=5))
    data = SessionGrantSerializer(g).data
    assert data['sessions_remaining'] == 2
    assert data['sessions_total'] == 3
    assert 'expires_at' in data
