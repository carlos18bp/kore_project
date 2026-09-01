# Post-Session Rating Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let both the customer and the trainer rate an attended session, award the customer a small credit for rating, and surface the feedback where each side already works.

**Architecture:** A `SessionRating` model with a `UniqueConstraint(booking, rater_role)` that makes rating idempotent and caps the credit at one per session. A single `POST /api/bookings/{id}/rate/` action derives the rater's role from the requesting user. The customer is prompted by a dashboard card; the trainer rates inline right where he marks attendance, and reads a summary on his dashboard.

**Tech Stack:** Django 6 + DRF (`@action` on `BookingViewSet`, `APIView` + `IsTrainerRole`), Next.js 16 App Router, Zustand 5, Playwright, pytest, Jest.

**Spec:** `docs/superpowers/specs/2026-07-14-session-rating-design.md`

## Global Constraints

- Branch: `feat/14072026-session-rating`. Never commit to `master`/`july-release`.
- **Do not run pytest / Jest / Playwright locally.** GitHub CI runs them on push. Local verification is limited to `python manage.py check` / `makemigrations --check` and `npx tsc --noEmit`. Tests are still written first, in the same commit as the code they cover.
- Run all git commands from the repo root: `git -C /home/cerrotico/work/kore_project ...` (the Bash tool's cwd persists across calls and repo-relative paths double up otherwise).
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do not put `max-w-*` on `(app)` page containers; the dashboard padding pattern is `px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5`.
- User-facing copy is in Spanish; code, comments and commits in English.
- **`rater_role` is derived from the requesting user and never read from the request body.**
- The trainer's rating is **optional**: confirming attendance without stars must keep working exactly as it does today.
- Do not edit existing migrations. The last one is `0067_enable_workout_captures`.

## File Structure

**Backend**
- `core_app/models/session_rating.py` *(new)* — the `SessionRating` model.
- `core_app/models/__init__.py` — export it.
- `core_app/migrations/0068_session_rating.py` *(new)* — create the table and add the `session_rated` choice.
- `core_app/models/credit.py` — one new `Action` member.
- `core_app/services/credit_engine.py` — `session_rated` in the three difficulty presets.
- `core_app/serializers/session_rating_serializers.py` *(new)* — `SessionRatingSerializer`.
- `core_app/views/booking_views.py` — `rate` and `pending_rating` actions on `BookingViewSet`.
- `core_app/views/session_rating_views.py` *(new)* — `TrainerRatingsSummaryView`.
- `core_app/urls/api_urls.py` — wire `trainer/ratings/summary/`.
- Tests: `core_app/tests/models/test_session_rating.py`, `core_app/tests/views/test_session_rating_views.py` *(both new)*.

**Frontend**
- `lib/stores/sessionRatingStore.ts` *(new)* — pending ratings, submit, trainer summary.
- `app/components/booking/SessionRatingCard.tsx` *(new)* — the customer's dashboard card.
- `app/(app)/dashboard/page.tsx` — render the card.
- `app/components/trainer/AttendanceActions.tsx` — inline stars after marking "Asistió".
- `app/components/trainer/RatingsSummaryCard.tsx` *(new)* — the trainer's dashboard tile.
- `app/(app)/trainer/dashboard/page.tsx` — render the tile.
- `app/(app)/trainer/clients/client/page.tsx` — the ratings that client left.
- `app/__tests__/stores/sessionRatingStore.test.ts` *(new)*.
- `e2e/customer/session-rating.spec.ts` *(new)*, `e2e/helpers/flow-tags.ts`, `e2e/flow-definitions.json`, `docs/USER_FLOW_MAP.md`.

**Docs**
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`.

---

### Task 1: The `SessionRating` model

**Files:**
- Create: `backend/core_app/models/session_rating.py`
- Modify: `backend/core_app/models/__init__.py`
- Modify: `backend/core_app/models/credit.py`
- Modify: `backend/core_app/services/credit_engine.py`
- Create: `backend/core_app/migrations/0068_session_rating.py`
- Test: `backend/core_app/tests/models/test_session_rating.py`

**Interfaces:**
- Consumes: `Booking`, `TimestampedModel`.
- Produces: `SessionRating` with `booking` (FK, `related_name='ratings'`), `rater_role` (`SessionRating.RaterRole.CUSTOMER | .TRAINER`), `score` (1–5), `comment`, and `UniqueConstraint(booking, rater_role, name='uniq_rating_per_booking_role')`. Also `CreditTransaction.Action.SESSION_RATED = 'session_rated'` and its preset values. Tasks 2–4 depend on these exact names.

- [ ] **Step 1: Write the failing tests**

Create `backend/core_app/tests/models/test_session_rating.py`:

```python
"""Tests for the SessionRating model and the session_rated credit value."""

from datetime import timedelta

import pytest
from django.core.exceptions import ValidationError
from django.db import IntegrityError
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
    with pytest.raises(IntegrityError):
        SessionRating.objects.create(
            booking=attended_booking, rater_role=SessionRating.RaterRole.CUSTOMER, score=3,
        )


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
    with pytest.raises(ValidationError):
        rating.full_clean()


@pytest.mark.django_db
def test_session_rated_has_a_credit_value_without_settings_migration(db):
    # value_for() falls back to the difficulty preset, so a new action needs no
    # CreditSettings migration.
    value = credit_engine.value_for(CreditTransaction.Action.SESSION_RATED)
    assert value > 0
```

- [ ] **Step 2: Write the model**

Create `backend/core_app/models/session_rating.py`:

```python
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class SessionRating(TimestampedModel):
    """A 1–5 rating left on an attended booking by one of its two parties.

    The unique constraint is load-bearing: it makes rating idempotent and is what
    stops a customer from farming the `session_rated` credit on one session.
    """

    class RaterRole(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        TRAINER = 'trainer', 'Trainer'

    booking = models.ForeignKey(
        'core_app.Booking', on_delete=models.CASCADE, related_name='ratings',
    )
    rater_role = models.CharField(max_length=10, choices=RaterRole.choices, db_index=True)
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'rater_role'], name='uniq_rating_per_booking_role',
            ),
        ]

    def __str__(self):
        return f'Booking {self.booking_id} — {self.rater_role}: {self.score}/5'
```

- [ ] **Step 3: Export the model**

In `backend/core_app/models/__init__.py`, add the import next to the other model imports:

```python
from .session_rating import SessionRating
```

and add `'SessionRating',` to `__all__`.

- [ ] **Step 4: Add the credit action**

In `backend/core_app/models/credit.py`, inside `CreditTransaction.Action`, add after `SESSION_ATTENDED`:

```python
        SESSION_RATED = 'session_rated', 'Session rated'
```

- [ ] **Step 5: Add the preset values**

In `backend/core_app/services/credit_engine.py`, add a `session_rated` entry to the `actions` dict of each of the three difficulty presets, right after `session_attended`:

- `easy`: `'session_rated': 10,`
- `medium`: `'session_rated': 5,`
- `hard`: `'session_rated': 3,`

- [ ] **Step 6: Generate the migration**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations core_app --name session_rating`
Expected: creates `core_app/migrations/0068_session_rating.py` with `CreateModel` for `SessionRating`, its `AddConstraint`, and an `AlterField` on `credittransaction.action` (the choices changed).

- [ ] **Step 7: Verify**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations --check --dry-run && python manage.py check`
Expected: `No changes detected` and `System check identified no issues`.

- [ ] **Step 8: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/models/session_rating.py backend/core_app/models/__init__.py backend/core_app/models/credit.py backend/core_app/services/credit_engine.py backend/core_app/migrations/0068_session_rating.py backend/core_app/tests/models/test_session_rating.py
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): SessionRating model + session_rated credit action

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: `POST /api/bookings/{id}/rate/`

**Files:**
- Create: `backend/core_app/serializers/session_rating_serializers.py`
- Modify: `backend/core_app/views/booking_views.py`
- Test: `backend/core_app/tests/views/test_session_rating_views.py`

**Interfaces:**
- Consumes: `SessionRating`, `CreditTransaction.Action.SESSION_RATED`, `credit_engine.award`, `_is_trainer_owner(user, booking)` and `is_admin_user(user)` (both already in `booking_views.py`).
- Produces: `POST /api/bookings/{id}/rate/` (url name `booking-rate`), body `{"score": 1..5, "comment": "..."}`, returning the created rating. Task 5 consumes this.

- [ ] **Step 1: Write the failing tests**

Create `backend/core_app/tests/views/test_session_rating_views.py`:

```python
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
    assert tx.amount == credit_engine.value_for(CreditTransaction.Action.SESSION_RATED)


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
```

- [ ] **Step 2: Write the serializer**

Create `backend/core_app/serializers/session_rating_serializers.py`:

```python
from rest_framework import serializers

from core_app.models.session_rating import SessionRating


class SessionRatingSerializer(serializers.ModelSerializer):
    class Meta:
        model = SessionRating
        # rater_role is derived from the requesting user in the view, never accepted
        # from the client — otherwise anyone could forge a "trainer" rating.
        fields = ('id', 'booking', 'rater_role', 'score', 'comment', 'created_at')
        read_only_fields = ('id', 'booking', 'rater_role', 'created_at')

    def validate_score(self, value):
        if not 1 <= value <= 5:
            raise serializers.ValidationError('La calificación debe estar entre 1 y 5.')
        return value
```

- [ ] **Step 3: Add the `rate` action**

In `backend/core_app/views/booking_views.py`, add the import next to the other model imports:

```python
from core_app.models.session_rating import SessionRating
from core_app.serializers.session_rating_serializers import SessionRatingSerializer
```

and add this action to `BookingViewSet`, right after `confirm_attendance`:

```python
    @action(detail=True, methods=['post'], url_path='rate')
    def rate(self, request, pk=None):
        """Rate an attended session. The rater's role is derived from the user.

        Body: ``{"score": 1..5, "comment": "..."}``. The customer's rating awards
        `session_rated` credits once; the unique constraint on (booking, rater_role)
        is what caps it.
        """
        try:
            booking = Booking.objects.select_related('trainer', 'customer').get(pk=pk)
        except Booking.DoesNotExist:
            return Response({'detail': 'Sesión no encontrada.'}, status=status.HTTP_404_NOT_FOUND)

        if booking.customer_id == request.user.pk:
            rater_role = SessionRating.RaterRole.CUSTOMER
        elif _is_trainer_owner(request.user, booking) or is_admin_user(request.user):
            rater_role = SessionRating.RaterRole.TRAINER
        else:
            return Response({'detail': 'No autorizado.'}, status=status.HTTP_403_FORBIDDEN)

        if booking.attendance_status != Booking.AttendanceStatus.ATTENDED:
            return Response(
                {'detail': 'Solo se puede calificar una sesión a la que se asistió.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if SessionRating.objects.filter(booking=booking, rater_role=rater_role).exists():
            return Response(
                {'detail': 'Ya calificaste esta sesión.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        serializer = SessionRatingSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        rating = serializer.save(booking=booking, rater_role=rater_role)

        if rater_role == SessionRating.RaterRole.CUSTOMER:
            from core_app.services import credit_engine
            credit_engine.award(
                booking.customer,
                CreditTransaction.Action.SESSION_RATED,
                'booking',
                booking.pk,
                'Calificaste tu sesión',
            )

        return Response(SessionRatingSerializer(rating).data, status=status.HTTP_201_CREATED)
```

Add `from core_app.models.credit import CreditTransaction` to the imports if it is not already there.

- [ ] **Step 4: Verify**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/serializers/session_rating_serializers.py backend/core_app/views/booking_views.py backend/core_app/tests/views/test_session_rating_views.py
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): POST /bookings/{id}/rate/ with a derived rater role

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: The read endpoints

**Files:**
- Modify: `backend/core_app/views/booking_views.py`
- Create: `backend/core_app/views/session_rating_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_session_rating_views.py` (append)

**Interfaces:**
- Consumes: `SessionRating`, `Booking`, `IsTrainerRole`.
- Produces:
  - `GET /api/bookings/pending-rating/` (url name `booking-pending-rating`) → `{"count": n, "results": [{id, starts_at, trainer_name}]}`.
  - `GET /api/trainer/ratings/summary/` (url name `trainer-ratings-summary`), optional `?customer_id=` → `{"average": float|null, "count": int, "recent": [{score, comment, customer_name, created_at}]}`.

  Tasks 5–7 consume both shapes.

- [ ] **Step 1: Write the failing tests**

Append to `backend/core_app/tests/views/test_session_rating_views.py`:

```python
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
```

- [ ] **Step 2: Add the `pending_rating` action**

In `backend/core_app/views/booking_views.py`, add this action to `BookingViewSet` right after `rate`:

```python
    @action(detail=False, methods=['get'], url_path='pending-rating')
    def pending_rating(self, request):
        """Attended sessions of the requesting customer that they have not rated yet."""
        rated_ids = SessionRating.objects.filter(
            rater_role=SessionRating.RaterRole.CUSTOMER,
        ).values_list('booking_id', flat=True)
        bookings = (
            Booking.objects.filter(
                customer=request.user,
                attendance_status=Booking.AttendanceStatus.ATTENDED,
            )
            .exclude(pk__in=rated_ids)
            .select_related('trainer__user')
            .order_by('-starts_at')
        )
        results = [
            {
                'id': b.pk,
                'starts_at': b.starts_at,
                'trainer_name': (
                    f'{b.trainer.user.first_name} {b.trainer.user.last_name}'.strip()
                    if b.trainer_id else ''
                ),
            }
            for b in bookings
        ]
        return Response({'count': len(results), 'results': results})
```

- [ ] **Step 3: Write the trainer summary view**

Create `backend/core_app/views/session_rating_views.py`:

```python
"""The feedback a trainer received from customers on their attended sessions."""

from django.db.models import Avg
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.session_rating import SessionRating
from core_app.permissions import IsTrainerRole

RECENT_LIMIT = 5


class TrainerRatingsSummaryView(APIView):
    """GET /api/trainer/ratings/summary/?customer_id=<id>

    Only the ratings customers left on this trainer's bookings — never the ones
    the trainer gave. Optionally scoped to a single customer for the client detail.
    """

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request):
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        if trainer_profile is None:
            return Response({'average': None, 'count': 0, 'recent': []})

        qs = SessionRating.objects.filter(
            rater_role=SessionRating.RaterRole.CUSTOMER,
            booking__trainer=trainer_profile,
        ).select_related('booking__customer')

        customer_id = request.query_params.get('customer_id')
        if customer_id:
            qs = qs.filter(booking__customer_id=customer_id)

        aggregate = qs.aggregate(avg=Avg('score'))
        average = round(aggregate['avg'], 2) if aggregate['avg'] is not None else None
        recent = [
            {
                'score': r.score,
                'comment': r.comment,
                'customer_name': (
                    f'{r.booking.customer.first_name} {r.booking.customer.last_name}'.strip()
                ),
                'created_at': r.created_at,
            }
            for r in qs[:RECENT_LIMIT]
        ]
        return Response({'average': average, 'count': qs.count(), 'recent': recent})
```

- [ ] **Step 4: Wire the URL**

In `backend/core_app/urls/api_urls.py`, add the import next to the other view imports:

```python
from core_app.views.session_rating_views import TrainerRatingsSummaryView
```

and the path next to the other `trainer/` paths:

```python
    path('trainer/ratings/summary/', TrainerRatingsSummaryView.as_view(), name='trainer-ratings-summary'),
```

- [ ] **Step 5: Verify**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/views/booking_views.py backend/core_app/views/session_rating_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_session_rating_views.py
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): pending-rating list + trainer ratings summary

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `sessionRatingStore`

**Files:**
- Create: `frontend/lib/stores/sessionRatingStore.ts`
- Test: `frontend/app/__tests__/stores/sessionRatingStore.test.ts`

**Interfaces:**
- Consumes: the three endpoints from Tasks 2–3.
- Produces: `useSessionRatingStore` with `{ pending: PendingRating[], summary: RatingsSummary | null, loading, error, fetchPending(), submitRating(bookingId, score, comment?) => Promise<boolean>, fetchSummary(customerId?) }`. Tasks 5–7 consume these names.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/__tests__/stores/sessionRatingStore.test.ts`:

```ts
import { api } from '@/lib/services/http';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; post: jest.Mock };

const PENDING = {
  count: 1,
  results: [{ id: 7, starts_at: '2026-07-13T15:00:00Z', trainer_name: 'Tina Trainer' }],
};

beforeEach(() => {
  jest.clearAllMocks();
  useSessionRatingStore.setState({ pending: [], summary: null, loading: false, error: '' });
});

test('fetchPending stores the sessions awaiting a rating', async () => {
  mockApi.get.mockResolvedValue({ data: PENDING });

  await useSessionRatingStore.getState().fetchPending();

  expect(mockApi.get).toHaveBeenCalledWith('/bookings/pending-rating/', expect.anything());
  expect(useSessionRatingStore.getState().pending).toHaveLength(1);
  expect(useSessionRatingStore.getState().pending[0].trainer_name).toBe('Tina Trainer');
});

test('submitRating posts the score and drops the session from the pending list', async () => {
  useSessionRatingStore.setState({ pending: PENDING.results });
  mockApi.post.mockResolvedValue({ data: { id: 1, score: 5 } });

  const ok = await useSessionRatingStore.getState().submitRating(7, 5, 'Buena');

  expect(ok).toBe(true);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/bookings/7/rate/',
    { score: 5, comment: 'Buena' },
    expect.anything(),
  );
  expect(useSessionRatingStore.getState().pending).toHaveLength(0);
});

test('submitRating surfaces an error and keeps the session pending on failure', async () => {
  useSessionRatingStore.setState({ pending: PENDING.results });
  mockApi.post.mockRejectedValue(new Error('boom'));

  const ok = await useSessionRatingStore.getState().submitRating(7, 5);

  expect(ok).toBe(false);
  expect(useSessionRatingStore.getState().pending).toHaveLength(1);
  expect(useSessionRatingStore.getState().error).not.toBe('');
});

test('fetchSummary stores the trainer average', async () => {
  mockApi.get.mockResolvedValue({
    data: { average: 4.5, count: 2, recent: [{ score: 5, comment: 'Top', customer_name: 'Ana', created_at: '2026-07-13T15:00:00Z' }] },
  });

  await useSessionRatingStore.getState().fetchSummary();

  expect(mockApi.get).toHaveBeenCalledWith('/trainer/ratings/summary/', expect.anything());
  expect(useSessionRatingStore.getState().summary?.average).toBe(4.5);
});
```

- [ ] **Step 2: Write the store**

Create `frontend/lib/stores/sessionRatingStore.ts`:

```ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type PendingRating = {
  id: number;
  starts_at: string;
  trainer_name: string;
};

export type RatingComment = {
  score: number;
  comment: string;
  customer_name: string;
  created_at: string;
};

export type RatingsSummary = {
  average: number | null;
  count: number;
  recent: RatingComment[];
};

type SessionRatingState = {
  pending: PendingRating[];
  summary: RatingsSummary | null;
  loading: boolean;
  error: string;

  fetchPending: () => Promise<void>;
  submitRating: (bookingId: number, score: number, comment?: string) => Promise<boolean>;
  fetchSummary: (customerId?: number) => Promise<void>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useSessionRatingStore = create<SessionRatingState>((set) => ({
  pending: [],
  summary: null,
  loading: false,
  error: '',

  fetchPending: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/bookings/pending-rating/', { headers: authHeaders() });
      set({ pending: data.results ?? [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las sesiones por calificar.', loading: false });
    }
  },

  submitRating: async (bookingId, score, comment) => {
    set({ error: '' });
    try {
      await api.post(
        `/bookings/${bookingId}/rate/`,
        { score, comment: comment ?? '' },
        { headers: authHeaders() },
      );
      set((s) => ({ pending: s.pending.filter((p) => p.id !== bookingId) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo enviar la calificación.') });
      return false;
    }
  },

  fetchSummary: async (customerId) => {
    try {
      const { data } = await api.get('/trainer/ratings/summary/', {
        headers: authHeaders(),
        ...(customerId ? { params: { customer_id: customerId } } : {}),
      });
      set({ summary: data as RatingsSummary });
    } catch {
      set({ error: 'No se pudo cargar el resumen de calificaciones.' });
    }
  },
}));
```

Note: the test asserts `api.post` is called with `{ score, comment: 'Buena' }`; when no comment is passed the store sends `comment: ''`.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/lib/stores/sessionRatingStore.ts frontend/app/__tests__/stores/sessionRatingStore.test.ts
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): sessionRatingStore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: The customer's dashboard card

**Files:**
- Create: `frontend/app/components/booking/SessionRatingCard.tsx`
- Modify: `frontend/app/(app)/dashboard/page.tsx`

**Interfaces:**
- Consumes: `useSessionRatingStore` (Task 4).
- Produces: the testids Task 8 asserts on — `session-rating-card`, `rating-star-{1..5}`, `rating-submit`, `rating-skip`.

- [ ] **Step 1: Write the card**

Create `frontend/app/components/booking/SessionRatingCard.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

/**
 * Prompts the customer to rate their most recent attended session.
 * Skipping leaves the session unrated forever — by design, we do not nag.
 */
export default function SessionRatingCard() {
  const pending = useSessionRatingStore((s) => s.pending);
  const fetchPending = useSessionRatingStore((s) => s.fetchPending);
  const submitRating = useSessionRatingStore((s) => s.submitRating);

  const [score, setScore] = useState(0);
  const [comment, setComment] = useState('');
  const [skipped, setSkipped] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchPending();
  }, [fetchPending]);

  const session = pending[0];
  if (!session || skipped) return null;

  const handleSubmit = async () => {
    if (score < 1) return;
    setSaving(true);
    await submitRating(session.id, score, comment.trim());
    setSaving(false);
  };

  const sessionDate = new Date(session.starts_at).toLocaleDateString('es-CO', {
    day: 'numeric',
    month: 'long',
  });

  return (
    <div
      data-testid="session-rating-card"
      className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3"
    >
      <div>
        <h3 className="text-sm font-bold text-kore-gray-dark">Califica tu sesión</h3>
        <p className="text-xs text-kore-gray-dark/50">
          {sessionDate}
          {session.trainer_name ? ` · con ${session.trainer_name}` : ''}
        </p>
      </div>

      <div className="flex items-center gap-1.5">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            data-testid={`rating-star-${n}`}
            aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
            onClick={() => setScore(n)}
            className={`text-2xl leading-none transition-colors ${
              n <= score ? 'text-kore-red' : 'text-kore-gray-dark/20'
            }`}
          >
            ★
          </button>
        ))}
      </div>

      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="¿Algo que quieras contarle a tu entrenador? (opcional)"
        rows={2}
        className="w-full rounded-xl border border-kore-gray-light/60 p-3 text-sm text-kore-gray-dark/80 resize-none"
      />

      <div className="flex items-center gap-2">
        <button
          type="button"
          data-testid="rating-submit"
          onClick={handleSubmit}
          disabled={score < 1 || saving}
          className="bg-kore-red text-white rounded-xl px-4 py-2 text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
        >
          {saving ? 'Enviando…' : 'Enviar'}
        </button>
        <button
          type="button"
          data-testid="rating-skip"
          onClick={() => setSkipped(true)}
          className="text-sm text-kore-gray-dark/50 px-2 py-2"
        >
          Omitir
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Render it on the dashboard**

In `frontend/app/(app)/dashboard/page.tsx`, add the import next to the other booking-component imports:

```tsx
import SessionRatingCard from '@/app/components/booking/SessionRatingCard';
```

The dashboard's own content container is further down the file; find the element that renders `<UpcomingSessionReminder />` and `<SubscriptionExpiryReminder />` (around line 1337) and add the card immediately after them:

```tsx
      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />
      <SubscriptionDashboardToast />
```

becomes

```tsx
      <UpcomingSessionReminder />
      <SubscriptionExpiryReminder />
      <SubscriptionDashboardToast />

      <div className="px-5 xl:px-10 pt-20 xl:pt-8">
        <SessionRatingCard />
      </div>
```

The card renders `null` when there is nothing to rate, so this wrapper collapses to an empty padded div in the common case — acceptable, and it keeps the card out of the GSAP-animated hero below.

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/app/components/booking/SessionRatingCard.tsx "frontend/app/(app)/dashboard/page.tsx"
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): session rating card on the customer dashboard

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: The trainer's inline rating

**Files:**
- Modify: `frontend/app/components/trainer/AttendanceActions.tsx`

**Interfaces:**
- Consumes: `useSessionRatingStore.submitRating` (Task 4).
- Produces: after the trainer marks "Asistió", an inline star row (`data-testid="trainer-rating-{bookingId}"`) appears in place of the buttons. Rating is optional: the attendance call already succeeded, and dismissing the stars leaves the session unrated.

- [ ] **Step 1: Add the inline rating**

In `frontend/app/components/trainer/AttendanceActions.tsx`, import the store next to the existing store imports:

```tsx
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';
```

Add the state and the submit handler inside the component, after `const [localStatus, setLocalStatus] = useState(...)`:

```tsx
  const submitRating = useSessionRatingStore((s) => s.submitRating);
  // The rating is offered only right after the trainer marks attendance, and only
  // once: attendance already succeeded, so dismissing this leaves the session unrated.
  const [rating, setRating] = useState(false);
  const [rated, setRated] = useState(false);

  async function handleRate(score: number) {
    setRated(true);
    await submitRating(session.id, score);
  }
```

In `handle`, open the rating prompt after a successful "Asistió":

```tsx
  async function handle(attended: boolean) {
    setSubmitting(attended);
    const data = await confirmAttendance(session.id, attended);
    if (data) {
      const status = attended ? 'attended' : 'no_show';
      setLocalStatus(status);
      markSessionAttendance(session.id, status);
      if (attended) setRating(true);
    }
    setSubmitting(null);
  }
```

Finally, replace the `localStatus === 'attended'` early return so it offers the stars once:

```tsx
  if (localStatus === 'attended') {
    if (rating && !rated) {
      return (
        <div
          data-testid={`trainer-rating-${session.id}`}
          className="flex items-center gap-1 flex-shrink-0"
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={`${n} estrella${n > 1 ? 's' : ''}`}
              onClick={() => handleRate(n)}
              className="text-base leading-none text-kore-gray-dark/30 hover:text-kore-red transition-colors"
            >
              ★
            </button>
          ))}
          <button
            type="button"
            onClick={() => setRated(true)}
            className="font-body text-[10px] text-kore-gray-dark/40 px-1"
          >
            Omitir
          </button>
        </div>
      );
    }
    return (
      <span className="font-body text-[10px] font-bold px-2 py-0.5 rounded-full flex-shrink-0 bg-kore-sage/20 text-kore-sage-deep">
        Asistió
      </span>
    );
  }
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 3: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/app/components/trainer/AttendanceActions.tsx
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): trainer rates inline right after confirming attendance

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: The trainer's summary tile and the client-detail feedback

**Files:**
- Create: `frontend/app/components/trainer/RatingsSummaryCard.tsx`
- Modify: `frontend/app/(app)/trainer/dashboard/page.tsx`
- Modify: `frontend/app/(app)/trainer/clients/client/page.tsx`

**Interfaces:**
- Consumes: `useSessionRatingStore.fetchSummary(customerId?)` and `summary` (Task 4).
- Produces: `data-testid="ratings-summary"` on the dashboard tile and `data-testid="client-ratings"` on the client-detail block.

- [ ] **Step 1: Write the summary card**

Create `frontend/app/components/trainer/RatingsSummaryCard.tsx`:

```tsx
'use client';

import { useEffect } from 'react';
import { useSessionRatingStore } from '@/lib/stores/sessionRatingStore';

/** The feedback customers left on this trainer's sessions. */
export default function RatingsSummaryCard({ customerId }: { customerId?: number }) {
  const summary = useSessionRatingStore((s) => s.summary);
  const fetchSummary = useSessionRatingStore((s) => s.fetchSummary);

  useEffect(() => {
    fetchSummary(customerId);
  }, [fetchSummary, customerId]);

  return (
    <div
      data-testid={customerId ? 'client-ratings' : 'ratings-summary'}
      className="bg-white/70 backdrop-blur-sm rounded-2xl p-5 border border-white/60 shadow-sm space-y-3"
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-bold text-kore-gray-dark">Calificaciones</h3>
        <span className="text-xs text-kore-gray-dark/40">
          {summary?.count ?? 0} sesión(es)
        </span>
      </div>

      {summary?.average != null ? (
        <p className="text-4xl font-black tracking-tight text-kore-red">
          {summary.average.toFixed(1)}
          <span className="text-base font-semibold text-kore-gray-dark/40"> / 5</span>
        </p>
      ) : (
        <p className="text-sm text-kore-gray-dark/50">Todavía no hay calificaciones.</p>
      )}

      {!!summary?.recent.length && (
        <ul className="space-y-2">
          {summary.recent
            .filter((r) => r.comment)
            .map((r, i) => (
              <li key={i} className="text-xs text-kore-gray-dark/80 leading-relaxed">
                <span className="font-semibold text-kore-gray-dark">{r.score}★</span>{' '}
                {r.comment}
                <span className="text-kore-gray-dark/40"> — {r.customer_name}</span>
              </li>
            ))}
        </ul>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Render it on the trainer dashboard**

In `frontend/app/(app)/trainer/dashboard/page.tsx`, add the import next to the other trainer-component imports:

```tsx
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';
```

and add it to the second grid row, so it sits beside the expired evaluations:

```tsx
        <div className="grid xl:grid-cols-[3fr_2fr] gap-5">
          <HoyAlertsPreview alerts={flatAlerts} />
          <EvalsVencidas evals={comparativeMetrics?.expired_evaluations ?? []} />
        </div>

        <RatingsSummaryCard />
```

- [ ] **Step 3: Render the client's feedback on the client detail**

In `frontend/app/(app)/trainer/clients/client/page.tsx`, add the import next to the other component imports:

```tsx
import RatingsSummaryCard from '@/app/components/trainer/RatingsSummaryCard';
```

and render it — scoped to this client — right after the pending-tasks strip block (the `{clientTaskCount > 0 && (...)}` JSX added in the trainer task hub). The page already derives the customer's numeric id at line 89 as `const clientId = Number(searchParams.get('id'));`, so reuse that:

```tsx
      {!!clientId && <RatingsSummaryCard customerId={clientId} />}
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/app/components/trainer/RatingsSummaryCard.tsx "frontend/app/(app)/trainer/dashboard/page.tsx" "frontend/app/(app)/trainer/clients/client/page.tsx"
git -C /home/cerrotico/work/kore_project commit -m "feat(rating): trainer ratings summary on dashboard + client detail

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 8: E2E spec and the flow triplet

**Files:**
- Create: `frontend/e2e/customer/session-rating.spec.ts`
- Modify: `frontend/e2e/helpers/flow-tags.ts`
- Modify: `frontend/e2e/flow-definitions.json`
- Modify: `docs/USER_FLOW_MAP.md`

**Interfaces:**
- Consumes: the testids from Task 5, `injectAuthCookies` / `setupDefaultApiMocks` from `e2e/fixtures.ts`.
- Produces: the `customer-session-rating` flow, registered in all three files.

The three triplet files must always change together and both versions get bumped — CI's `e2e-flow-definitions-sync` job checks it.

- [ ] **Step 1: Add the flow tag**

In `frontend/e2e/helpers/flow-tags.ts`, add next to the other customer flows:

```ts
  CUSTOMER_SESSION_RATING: ['@flow:customer-session-rating', '@module:booking', '@priority:P2'],
```

- [ ] **Step 2: Register the flow definition**

In `frontend/e2e/flow-definitions.json`, bump `"version"` to `"1.8.0"` and `"lastUpdated"` to `"2026-07-14"`, then add to the `"flows"` object:

```json
  "customer-session-rating": {
    "name": "Post-Session Rating",
    "module": "booking",
    "priority": "P2",
    "roles": ["customer"],
    "description": "After a trainer confirms attendance, the customer rates the session from a dashboard card (1-5 stars + optional comment), earning session_rated credits. Skipping leaves it unrated.",
    "coverage": "covered"
  },
```

- [ ] **Step 3: Document the flow**

In `docs/USER_FLOW_MAP.md`, bump `Version` to `2.1` and `Last Updated` to `2026-07-14`, then add this section to the customer/booking flows, matching the file's existing bullet style:

```markdown
### customer-session-rating: Post-Session Rating
- Module: booking
- Priority: P2
- Route: /dashboard
- Roles: customer
- Coverage: **Covered** (`e2e/customer/session-rating.spec.ts`)
- Description: The customer rates an attended session; the trainer rates the same session inline when confirming attendance.

**Steps**
1. The trainer marks the session as attended (`POST /api/bookings/{id}/confirm-attendance/`), which is what makes it rateable.
2. On the customer's dashboard, a "Califica tu sesión" card appears, fed by `GET /api/bookings/pending-rating/`.
3. The customer picks 1–5 stars, optionally writes a comment, and sends: `POST /api/bookings/{id}/rate/`. This awards `session_rated` credits, once per session.
4. The card disappears. The trainer reads the feedback on his dashboard (`GET /api/trainer/ratings/summary/`) and on the client detail.

**Branches / Variations**
- *Omitir* dismisses the card and leaves the session unrated — there is no second prompt.
- Rating twice is rejected (400); the unique constraint `(booking, rater_role)` caps the credit at one per session.
- A session that was not attended cannot be rated (400).
- The trainer's own rating awards no credits.
```

- [ ] **Step 4: Write the E2E spec**

Create `frontend/e2e/customer/session-rating.spec.ts`:

```ts
import { test, expect, injectAuthCookies, setupDefaultApiMocks } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:customer-session-rating
 * The customer rates an attended session from the dashboard card.
 */

const PENDING = {
  count: 1,
  results: [{ id: 7, starts_at: '2026-07-13T15:00:00Z', trainer_name: 'Tina Trainer' }],
};

test.describe(
  'Customer — session rating',
  { tag: [...FlowTags.CUSTOMER_SESSION_RATING, RoleTags.USER] },
  () => {
    test.use({ viewport: { width: 1440, height: 900 } });

    test.beforeEach(async ({ page }) => {
      await injectAuthCookies(page);
      await setupDefaultApiMocks(page);
    });

    test('rates an attended session and the card disappears', async ({ page }) => {
      let posted: Record<string, unknown> | null = null;
      await page.route('**/api/bookings/pending-rating/', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }),
      );
      await page.route('**/api/bookings/7/rate/', (r) => {
        posted = r.request().postDataJSON();
        return r.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ id: 1, score: 5, comment: '' }),
        });
      });

      await page.goto('/dashboard');
      await expect(page.getByTestId('session-rating-card')).toBeVisible({ timeout: 15_000 });
      await expect(page.getByText('Tina Trainer')).toBeVisible();

      await page.getByTestId('rating-star-5').click();
      await page.getByTestId('rating-submit').click();

      await expect(page.getByTestId('session-rating-card')).not.toBeVisible();
      expect(posted).toMatchObject({ score: 5 });
    });

    test('skipping dismisses the card without rating', async ({ page }) => {
      let rateCalled = false;
      await page.route('**/api/bookings/pending-rating/', (r) =>
        r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }),
      );
      await page.route('**/api/bookings/7/rate/', (r) => {
        rateCalled = true;
        return r.fulfill({ status: 201, contentType: 'application/json', body: '{}' });
      });

      await page.goto('/dashboard');
      await expect(page.getByTestId('session-rating-card')).toBeVisible({ timeout: 15_000 });

      await page.getByTestId('rating-skip').click();

      await expect(page.getByTestId('session-rating-card')).not.toBeVisible();
      expect(rateCalled).toBe(false);
    });
  },
);
```

- [ ] **Step 5: Validate the JSON**

Run: `cd frontend && python3 -c "import json; d=json.load(open('e2e/flow-definitions.json')); print(d['version'], 'customer-session-rating' in d['flows'])"`
Expected: `1.8.0 True`

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/e2e/customer/session-rating.spec.ts frontend/e2e/helpers/flow-tags.ts frontend/e2e/flow-definitions.json docs/USER_FLOW_MAP.md
git -C /home/cerrotico/work/kore_project commit -m "test(rating): E2E + flow triplet for post-session rating

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 9: Release guides

**Files:**
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md`
- Modify: `docs/release-july/GUIA_QA_STAGING.md`

**Interfaces:**
- Consumes: the behavior shipped in Tasks 1–8.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the validation-guide entry**

In `docs/release-july/GUIA_DE_VALIDACION.md`, add a `## Parte 9 — Calificar la sesión` section before the `## Próximas secciones` block, with a `### Funcionalidad 14 (cliente y entrenador): Calificar la sesión` block in the same five-heading voice as its neighbours (¿Qué es y para qué sirve? / Antes de empezar / Paso a paso / Cómo sabes que funcionó / Si algo no sale como esperabas). State: the card appears on the customer's dashboard once the trainer confirms attendance; rating awards credits **once**; *Omitir* leaves it unrated with no second prompt; the trainer rates with the stars that appear right after "✓ Asistió" and reads the average on his dashboard.

Also update the trailing "Próximas secciones" line to drop the session-rating mention, leaving `configuración de dificultad · analítica y KPIs`.

- [ ] **Step 2: Add the QA-staging entry**

In `docs/release-july/GUIA_QA_STAGING.md`, add a `### 3.13 Cliente y entrenador — Calificar la sesión (Parte 9)` subsection after `3.12`, listing: the card only appears for `attendance_status='attended'`; rating creates one `SessionRating` and one `session_rated` `CreditTransaction`; a second attempt returns 400 and does **not** award again; the trainer's stars after "✓ Asistió" create a rating with `rater_role='trainer'` and **no** credits; and confirming attendance without rating still works.

- [ ] **Step 3: Commit**

```bash
git -C /home/cerrotico/work/kore_project add docs/release-july/GUIA_DE_VALIDACION.md docs/release-july/GUIA_QA_STAGING.md
git -C /home/cerrotico/work/kore_project commit -m "docs(release): post-session rating in validation + QA guides

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Finishing

After all tasks are committed:

1. Run the `e2e-user-flows-check` skill (a frontend user flow changed: a new dashboard card plus the trainer's inline rating).
2. Use `superpowers:finishing-a-development-branch` to push and open the PR against **`july-release`** (not `master`).
3. Report the PR URL.
