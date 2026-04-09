"""Tests for TermsAcceptance model."""

from datetime import datetime, timedelta
from datetime import timezone as dt_timezone

import pytest
from django.db import IntegrityError, transaction

from core_app.models import User
from core_app.models.terms_acceptance import CURRENT_TERMS_VERSION, TermsAcceptance

FIXED_NOW = datetime(2026, 6, 15, 12, 0, 0, tzinfo=dt_timezone.utc)


@pytest.fixture
def user(db):
    return User.objects.create_user(
        email='terms-user@test.com', password='p',
        first_name='Terms', last_name='User', role=User.Role.CUSTOMER,
    )


@pytest.mark.django_db
class TestTermsAcceptanceModel:
    """Validates TermsAcceptance creation, defaults, and constraints."""

    def test_creates_acceptance_with_required_fields(self, user):
        """A terms acceptance stores user, IP, user-agent and timestamp."""
        acceptance = TermsAcceptance.objects.create(
            user=user,
            ip_address='192.168.1.10',
            user_agent='Mozilla/5.0 Test',
            accepted_at=FIXED_NOW,
        )
        assert acceptance.user == user
        assert acceptance.ip_address == '192.168.1.10'
        assert acceptance.user_agent == 'Mozilla/5.0 Test'
        assert acceptance.accepted_at == FIXED_NOW

    def test_default_terms_version_is_current(self, user):
        """terms_version defaults to CURRENT_TERMS_VERSION when not provided."""
        acceptance = TermsAcceptance.objects.create(
            user=user,
            ip_address='10.0.0.1',
            accepted_at=FIXED_NOW,
        )
        assert acceptance.terms_version == CURRENT_TERMS_VERSION

    def test_default_user_agent_is_empty_string(self, user):
        """user_agent defaults to an empty string when not provided."""
        acceptance = TermsAcceptance.objects.create(
            user=user,
            ip_address='10.0.0.1',
            accepted_at=FIXED_NOW,
        )
        assert acceptance.user_agent == ''

    def test_unique_user_terms_version_constraint(self, user):
        """Same user cannot accept the same terms version twice."""
        TermsAcceptance.objects.create(
            user=user, terms_version='v1.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        with pytest.raises(IntegrityError), transaction.atomic():
            TermsAcceptance.objects.create(
                user=user, terms_version='v1.0',
                ip_address='10.0.0.2', accepted_at=FIXED_NOW,
            )
        assert TermsAcceptance.objects.filter(user=user, terms_version='v1.0').count() == 1

    def test_user_can_accept_different_versions(self, user):
        """Same user can accept multiple terms versions independently."""
        TermsAcceptance.objects.create(
            user=user, terms_version='v1.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        TermsAcceptance.objects.create(
            user=user, terms_version='v2.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        assert TermsAcceptance.objects.filter(user=user).count() == 2

    def test_different_users_can_accept_same_version(self, user):
        """Two different users can each accept the same terms version."""
        other = User.objects.create_user(
            email='terms-other@test.com', password='p', role=User.Role.CUSTOMER,
        )
        TermsAcceptance.objects.create(
            user=user, terms_version='v1.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        TermsAcceptance.objects.create(
            user=other, terms_version='v1.0',
            ip_address='10.0.0.2', accepted_at=FIXED_NOW,
        )
        assert TermsAcceptance.objects.filter(terms_version='v1.0').count() == 2

    def test_ordering_by_accepted_at_descending(self, user):
        """Default queryset orders acceptances by most recent accepted_at first."""
        TermsAcceptance.objects.create(
            user=user, terms_version='v1.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW - timedelta(days=2),
        )
        TermsAcceptance.objects.create(
            user=user, terms_version='v2.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        TermsAcceptance.objects.create(
            user=user, terms_version='v3.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW - timedelta(days=1),
        )

        versions = list(TermsAcceptance.objects.values_list('terms_version', flat=True))
        assert versions == ['v2.0', 'v3.0', 'v1.0']

    def test_str_representation_includes_email_and_version(self, user):
        """String representation contains pk, email and terms version."""
        acceptance = TermsAcceptance.objects.create(
            user=user, terms_version='v1.0',
            ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        assert str(acceptance) == f'TermsAcceptance #{acceptance.pk} — terms-user@test.com (v1.0)'

    def test_cascade_delete_with_user(self, user):
        """Terms acceptances are deleted when their owning user is deleted."""
        TermsAcceptance.objects.create(
            user=user, ip_address='10.0.0.1', accepted_at=FIXED_NOW,
        )
        user.delete()
        assert TermsAcceptance.objects.count() == 0

    def test_ipv6_address_stored(self, user):
        """GenericIPAddressField accepts IPv6 strings without rejection."""
        ipv6 = '2001:0db8:85a3:0000:0000:8a2e:0370:7334'
        acceptance = TermsAcceptance.objects.create(
            user=user,
            ip_address=ipv6,
            accepted_at=FIXED_NOW,
        )
        assert acceptance.ip_address == ipv6
