"""Golden-value tests for the trainer engagement aggregation service (Parte 11b)."""

from datetime import datetime, timedelta, timezone as dt_tz

import pytest

from core_app.models import (
    Booking, CreditTransaction, CreditWallet, MoodEntry, Package, SessionRating,
    TrainerProfile, User,
)
from core_app.services import trainer_engagement_service as svc

NOW = datetime(2026, 7, 15, 14, 0, tzinfo=dt_tz.utc)


@pytest.fixture
def trainer(db):
    u = User.objects.create_user(
        email='tr@test.com', password='p', first_name='Ana', last_name='G',
        role=User.Role.TRAINER,
    )
    return TrainerProfile.objects.create(user=u, location='Gym')


@pytest.fixture
def package(db):
    return Package.objects.create(title='Plan', sessions_count=8)


def _client(email, first='C', last='L'):
    return User.objects.create_user(
        email=email, password='p', first_name=first, last_name=last,
        role=User.Role.CUSTOMER,
    )


def _booking(trainer, customer, package, when, attendance=Booking.AttendanceStatus.UNSET):
    return Booking.objects.create(
        customer=customer, trainer=trainer, package=package,
        starts_at=when, ends_at=when + timedelta(hours=1),
        status=Booking.Status.CONFIRMED, attendance_status=attendance,
    )


# ── summary ─────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_summary_counts_streaks_checkins_credits_attendance(trainer, package):
    c1, c2 = _client('c1@t.com'), _client('c2@t.com')
    _booking(trainer, c1, package, NOW - timedelta(days=1), Booking.AttendanceStatus.ATTENDED)
    _booking(trainer, c2, package, NOW - timedelta(days=2), Booking.AttendanceStatus.NO_SHOW)
    CreditWallet.objects.create(customer=c1, current_streak=5)
    CreditWallet.objects.create(customer=c2, current_streak=0)
    MoodEntry.objects.create(user=c1, score=8, date=NOW.date())
    CreditTransaction.objects.create(customer=c1, action=CreditTransaction.Action.WORKOUT_DAY, amount=30, status=CreditTransaction.Status.CONFIRMED, description='e')
    CreditTransaction.objects.create(customer=c1, action=CreditTransaction.Action.REDEMPTION, amount=-10, status=CreditTransaction.Status.CONFIRMED, description='s')

    ids = svc._customer_ids(trainer)
    result = svc._summary(ids, trainer, NOW)

    assert result['clients_total'] == 2
    assert result['active_streaks'] == 1
    assert result['checked_in_today'] == 1
    assert result['checked_in_today_pct'] == 50.0
    assert (result['credits_earned_30d'], result['credits_spent_30d']) == (30, 10)
    assert result['attendance_rate_30d'] == 50.0


@pytest.mark.django_db
def test_summary_attendance_none_when_no_sessions(trainer, package):
    c1 = _client('c1@t.com')
    _booking(trainer, c1, package, NOW - timedelta(days=1))  # UNSET → not counted
    ids = svc._customer_ids(trainer)
    result = svc._summary(ids, trainer, NOW)
    assert result['attendance_rate_30d'] is None


@pytest.mark.django_db
def test_summary_pct_zero_when_no_clients(trainer):
    result = svc._summary([], trainer, NOW)
    assert result['checked_in_today_pct'] == 0.0
    assert result['clients_total'] == 0


# ── roster ──────────────────────────────────────────────────────────────────

@pytest.mark.django_db
def test_roster_fields_and_ordering(trainer, package):
    c1, c2 = _client('ana@t.com', 'Ana', 'Gomez'), _client('beto@t.com', 'Beto', 'Ruiz')
    b1 = _booking(trainer, c1, package, NOW - timedelta(days=1), Booking.AttendanceStatus.ATTENDED)
    _booking(trainer, c2, package, NOW - timedelta(days=3), Booking.AttendanceStatus.NO_SHOW)
    CreditWallet.objects.create(customer=c1, current_streak=7)
    CreditWallet.objects.create(customer=c2, current_streak=2)
    MoodEntry.objects.create(user=c1, score=9, date=NOW.date())
    SessionRating.objects.create(booking=b1, rater_role=SessionRating.RaterRole.CUSTOMER, score=5)

    ids = svc._customer_ids(trainer)
    roster = svc._roster(ids, trainer, NOW)

    assert [r['current_streak'] for r in roster] == [7, 2]  # streak desc
    ana = roster[0]
    assert ana['name'] == 'Ana Gomez'
    assert ana['last_checkin'] == NOW.date().isoformat()
    assert ana['attendance_rate_30d'] == 100.0
    assert ana['average_rating'] == 5.0
    beto = roster[1]
    assert beto['last_checkin'] is None
    assert beto['attendance_rate_30d'] == 0.0  # 0 attended / 1 no_show
    assert beto['average_rating'] is None


@pytest.mark.django_db
def test_roster_excludes_non_clients(trainer, package):
    mine = _client('mine@t.com')
    stranger = _client('stranger@t.com')  # no booking with this trainer
    _booking(trainer, mine, package, NOW - timedelta(days=1))
    CreditWallet.objects.create(customer=stranger, current_streak=99)

    ids = svc._customer_ids(trainer)
    roster = svc._roster(ids, trainer, NOW)

    assert [r['customer_id'] for r in roster] == [mine.id]


@pytest.mark.django_db
def test_build_engagement_shape(trainer):
    result = svc.build_engagement(trainer, NOW)
    assert set(result) == {'summary', 'roster'}
    assert result['roster'] == []
