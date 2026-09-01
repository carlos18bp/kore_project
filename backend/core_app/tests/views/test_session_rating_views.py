"""Tests for POST /bookings/{id}/rate/ and the rating read endpoints."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.models.credit import CreditTransaction
from core_app.models.session_rating import SessionRating
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='trainer-rating@kore.com', password='p',
        first_name='Tina', last_name='Trainer', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=user)
    return user


@pytest.fixture
def attended_booking(db, existing_user, trainer_user):
    package = Package.objects.create(title='Plan', sessions_count=4)
    start = timezone.now() - timedelta(hours=2)
    return Booking.objects.create(
        customer=existing_user, package=package, trainer=trainer_user.trainer_profile,
        starts_at=start, ends_at=start + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
        attendance_status=Booking.AttendanceStatus.ATTENDED,
    )


def rate_url(booking):
    return reverse('booking-rate', args=[booking.pk])


@pytest.mark.django_db
def test_customer_rating_creates_it_and_awards_credits(api_client, existing_user, attended_booking):
    api_client.force_authenticate(user=existing_user)

    response = api_client.post(rate_url(attended_booking), {'score': 5, 'comment': 'Buena'}, format='json')

    assert response.status_code == status.HTTP_201_CREATED
    rating = SessionRating.objects.get(booking=attended_booking)
    assert rating.rater_role == SessionRating.RaterRole.CUSTOMER
    assert rating.score == 5
    tx = CreditTransaction.objects.get(
        customer=existing_user, action=CreditTransaction.Action.SESSION_RATED,
    )
    expected = credit_engine.action_value(
        credit_engine.get_settings(), CreditTransaction.Action.SESSION_RATED,
    )
    assert tx.amount == expected


@pytest.mark.django_db
def test_rating_twice_is_rejected_and_does_not_award_twice(api_client, existing_user, attended_booking):
    api_client.force_authenticate(user=existing_user)
    api_client.post(rate_url(attended_booking), {'score': 5}, format='json')

    response = api_client.post(rate_url(attended_booking), {'score': 1}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert CreditTransaction.objects.filter(
        action=CreditTransaction.Action.SESSION_RATED,
    ).count() == 1


@pytest.mark.django_db
def test_rater_role_is_derived_and_a_body_supplied_role_is_ignored(api_client, trainer_user, attended_booking):
    api_client.force_authenticate(user=trainer_user)

    response = api_client.post(
        rate_url(attended_booking), {'score': 4, 'rater_role': 'customer'}, format='json',
    )

    assert response.status_code == status.HTTP_201_CREATED
    rating = SessionRating.objects.get(booking=attended_booking)
    assert rating.rater_role == SessionRating.RaterRole.TRAINER


@pytest.mark.django_db
def test_trainer_rating_awards_no_credits(api_client, trainer_user, attended_booking):
    api_client.force_authenticate(user=trainer_user)

    api_client.post(rate_url(attended_booking), {'score': 4}, format='json')

    assert not CreditTransaction.objects.filter(
        action=CreditTransaction.Action.SESSION_RATED,
    ).exists()


@pytest.mark.django_db
def test_a_stranger_cannot_rate_the_booking(api_client, attended_booking, db):
    stranger = User.objects.create_user(
        email='stranger@kore.com', password='p', first_name='S', last_name='T',
        role=User.Role.CUSTOMER,
    )
    api_client.force_authenticate(user=stranger)

    response = api_client.post(rate_url(attended_booking), {'score': 5}, format='json')

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_an_unattended_booking_cannot_be_rated(api_client, existing_user, attended_booking):
    attended_booking.attendance_status = Booking.AttendanceStatus.UNSET
    attended_booking.save(update_fields=['attendance_status'])
    api_client.force_authenticate(user=existing_user)

    response = api_client.post(rate_url(attended_booking), {'score': 5}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_a_score_outside_one_to_five_is_rejected(api_client, existing_user, attended_booking):
    api_client.force_authenticate(user=existing_user)

    response = api_client.post(rate_url(attended_booking), {'score': 9}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST


# ── Read endpoints ─────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_pending_rating_lists_attended_unrated_sessions(api_client, existing_user, attended_booking):
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse('booking-pending-rating'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['count'] == 1
    assert response.data['results'][0]['id'] == attended_booking.pk


@pytest.mark.django_db
def test_pending_rating_drops_a_session_once_rated(api_client, existing_user, attended_booking):
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=5,
    )
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse('booking-pending-rating'))

    assert response.data['count'] == 0


@pytest.mark.django_db
def test_pending_rating_ignores_a_trainer_only_rating(api_client, existing_user, attended_booking):
    # The trainer rated, the customer did not — the customer is still owed a prompt.
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.TRAINER, score=4,
    )
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse('booking-pending-rating'))

    assert response.data['count'] == 1


@pytest.mark.django_db
def test_trainer_summary_averages_the_customer_ratings(api_client, trainer_user, attended_booking):
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER,
        score=4, comment='Muy bien',
    )
    api_client.force_authenticate(user=trainer_user)

    response = api_client.get(reverse('trainer-ratings-summary'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['count'] == 1
    assert response.data['average'] == 4.0
    assert response.data['recent'][0]['comment'] == 'Muy bien'


@pytest.mark.django_db
def test_trainer_summary_excludes_the_trainers_own_ratings(api_client, trainer_user, attended_booking):
    # The summary is the feedback the trainer RECEIVED, not what he gave.
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.TRAINER, score=1,
    )
    api_client.force_authenticate(user=trainer_user)

    response = api_client.get(reverse('trainer-ratings-summary'))

    assert response.data['count'] == 0
    assert response.data['average'] is None


@pytest.mark.django_db
def test_trainer_summary_can_be_scoped_to_one_customer(api_client, trainer_user, attended_booking, existing_user):
    SessionRating.objects.create(
        booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=5,
    )
    api_client.force_authenticate(user=trainer_user)

    hit = api_client.get(reverse('trainer-ratings-summary'), {'customer_id': existing_user.pk})
    miss = api_client.get(reverse('trainer-ratings-summary'), {'customer_id': 999999})

    assert hit.data['count'] == 1
    assert miss.data['count'] == 0
