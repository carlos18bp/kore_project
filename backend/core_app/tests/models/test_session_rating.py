"""Tests for the SessionRating model and the session_rated credit value."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError, transaction
from django.utils import timezone

from core_app.models import Booking, Package
from core_app.models.credit import CreditTransaction
from core_app.models.session_rating import SessionRating
from core_app.services import credit_engine


@pytest.fixture
def attended_booking(db, existing_user):
    package = Package.objects.create(title='Plan', sessions_count=4)
    start = timezone.now() - timedelta(hours=2)
    return Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=start, ends_at=start + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
        attendance_status=Booking.AttendanceStatus.ATTENDED,
    )


@pytest.mark.django_db
def test_one_rating_per_booking_and_role(attended_booking):
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=5,
    )
    # The same role cannot rate the same booking twice — this is what caps the credit.
    # atomic() keeps the failed INSERT from poisoning the outer test transaction.
    with pytest.raises(IntegrityError), transaction.atomic():
        SessionRating.objects.create(
            booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=3,
        )

    assert attended_booking.ratings.count() == 1


@pytest.mark.django_db
def test_both_roles_can_rate_the_same_booking(attended_booking):
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=5,
    )
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.TRAINER, score=4,
    )
    assert attended_booking.ratings.count() == 2


@pytest.mark.django_db
def test_score_outside_one_to_five_is_rejected(attended_booking):
    rating = SessionRating(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=6,
    )
    with pytest.raises(ValidationError) as exc:
        rating.full_clean()

    assert 'score' in exc.value.message_dict


@pytest.mark.django_db
def test_session_rated_has_a_credit_value_without_settings_migration(db):
    # action_value() falls back to the difficulty preset, so a new action needs no
    # CreditSettings migration.
    settings_obj = credit_engine.get_settings()
    value = credit_engine.action_value(settings_obj, CreditTransaction.Action.SESSION_RATED)
    assert value > 0
