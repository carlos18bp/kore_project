# Trainer ↔ Client Assignment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an explicit `User.assigned_trainer` link, admin UI to manage it (assign/reassign/clear, a per-trainer client list, and a quick coverage chart), expose it on the auth profile, and gate `/book-session` so a customer can only book once a trainer has been assigned — booking with that assigned trainer only.

**Architecture:** New nullable FK `User.assigned_trainer → TrainerProfile` (one trainer per client) backfilled from each customer's most-recent booking. The admin user API accepts `assigned_trainer_id` on PATCH and returns `assigned_trainer` (customers) / `assigned_clients` (trainers); a new `GET /api/admin/trainers/assignment-summary/` powers the chart. `BookingSerializer` rejects bookings from customers with no assigned trainer (code `no_trainer_assigned`) and forces `booking.trainer = customer.assigned_trainer`. `TrainerClientListView` switches its client source from booking-derived to `assigned_trainer`. Frontend: the auth profile carries `assigned_trainer`; `bookingStore` uses it instead of `trainers[0]`; `/book-session` shows an empty-state when it's null; the admin user store/pages get assign controls + the summary card.

**Tech Stack:** Django 6 + DRF (backend, app `core_app`, project module `core_project`), pytest. Next.js 16 + React 19 + TypeScript + Zustand (frontend), Jest + Playwright. MySQL prod / SQLite dev.

**Hard constraint:** Do NOT touch `core_app/services/slot_schedule.py`, `WEEKLY_SCHEDULE`, the daily slot-maintenance task, the 30-day rolling window, or `AvailabilitySlot.Meta.constraints`. Do not edit existing migrations. Do not edit files under `backend/templates/` (generated).

**Conventions observed in this repo (do not "fix"):**
- `User.Role` values are lowercase: `'customer'`, `'trainer'`, `'admin'`. `Booking.Status` / `Subscription.Status` values are lowercase too.
- The frontend has `next-intl` installed but **app code uses hardcoded Spanish strings** — follow that; do not introduce translation files.
- Backend views are a mix of FBV/CBV/ViewSet/APIView — match the file you touch.
- Run only the smallest test slice. Never the full suite. Max 20 tests/batch, 3 test commands/cycle.

---

## File Structure

**Backend — create:**
- `core_app/migrations/0039_user_assigned_trainer.py` — schema + data migration (backfill)
- `core_app/views/trainer_assignment_views.py` — `TrainerAssignmentSummaryView` (admin-only)
- `core_app/tests/test_trainer_client_assignment.py` — all backend tests for this feature

**Backend — modify:**
- `core_app/models/user.py` — add `assigned_trainer` FK
- `core_app/serializers/admin_user_serializers.py` — expose/accept assignment fields
- `core_app/views/admin_user_views.py` — pass `assigned_trainer_id` through PATCH
- `core_app/serializers/profile_serializers.py` — add `assigned_trainer` to `ProfileResponseSerializer`
- `core_app/serializers/booking_serializers.py` — booking gate + force trainer
- `core_app/views/trainer_client_views.py` — `TrainerClientListView` client source
- `core_app/urls/api_urls.py` — register the summary endpoint

**Frontend — modify:**
- `lib/stores/authStore.ts` — carry `assigned_trainer` on the user
- `lib/stores/bookingStore.ts` — use the assigned trainer; stop defaulting to `trainers[0]`
- `lib/stores/adminUserStore.ts` — types + `assignTrainer` action + `fetchAssignmentSummary`
- `app/(app)/book-session/page.tsx` — gate empty-state
- `app/admin/users/UsersListClient.tsx` — trainers coverage card + per-trainer count
- `app/admin/users/[id]/UserDetailClient.tsx` — customer "assigned trainer" select + trainer "assigned clients" section

**Frontend — create:**
- `app/__tests__/...` — Jest tests for the gate and the assign control (paths under existing `app/__tests__/`)
- `e2e/app/book-session-gate.spec.ts` — E2E for the no-trainer gate (optional, if E2E infra is available)

---

## Task 1: Backend model field `User.assigned_trainer` + migration

**Files:**
- Modify: `core_app/models/user.py`
- Create: `core_app/migrations/0039_user_assigned_trainer.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

- [ ] **Step 1: Write the failing test**

Create `core_app/tests/test_trainer_client_assignment.py`:

```python
import pytest
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot, Booking, Package, Subscription, TrainerProfile, User,
)


@pytest.fixture
def trainer_a(db):
    u = User.objects.create_user(email='ta@kore.com', password='x', role=User.Role.TRAINER,
                                 first_name='Tra', last_name='A')
    return TrainerProfile.objects.create(user=u, specialty='Func')


@pytest.fixture
def trainer_b(db):
    u = User.objects.create_user(email='tb@kore.com', password='x', role=User.Role.TRAINER,
                                 first_name='Tra', last_name='B')
    return TrainerProfile.objects.create(user=u, specialty='Func')


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='c1@kore.com', password='x', role=User.Role.CUSTOMER,
                                    first_name='Cli', last_name='One')


@pytest.mark.django_db
def test_user_has_nullable_assigned_trainer(customer, trainer_a):
    assert customer.assigned_trainer is None
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_a.id
    assert list(trainer_a.assigned_clients.all()) == [customer]


@pytest.mark.django_db
def test_deleting_trainer_profile_unassigns_clients(customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    trainer_a.delete()
    customer.refresh_from_db()
    assert customer.assigned_trainer is None
```

- [ ] **Step 2: Run it and confirm it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -v`
Expected: errors / `AttributeError` — `assigned_trainer` does not exist yet.

- [ ] **Step 3: Add the field to `User`**

In `core_app/models/user.py`, inside `class User(...)`, after the `role` field, add:

```python
    assigned_trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='assigned_clients',
        help_text='Trainer who owns this customer. Only meaningful for role=customer.',
    )
```

- [ ] **Step 4: Generate the schema migration**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations core_app`
Expected: creates `core_app/migrations/0039_user_assigned_trainer.py` adding the field.

- [ ] **Step 5: Add the data-migration step (backfill) to the same file**

Open the generated `0039_user_assigned_trainer.py`. Add a `RunPython` operation **after** the `AddField`:

```python
from django.db import migrations, models
import django.db.models.deletion


def backfill_assigned_trainer(apps, schema_editor):
    User = apps.get_model('core_app', 'User')
    Booking = apps.get_model('core_app', 'Booking')
    for user in User.objects.filter(role='customer', assigned_trainer__isnull=True):
        last_booking = (
            Booking.objects.filter(customer=user, trainer__isnull=False)
            .order_by('-created_at')
            .first()
        )
        if last_booking is not None:
            user.assigned_trainer_id = last_booking.trainer_id
            user.save(update_fields=['assigned_trainer'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0038_add_transfer_payment_provider'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='assigned_trainer',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_clients',
                to='core_app.trainerprofile',
                help_text='Trainer who owns this customer. Only meaningful for role=customer.',
            ),
        ),
        migrations.RunPython(backfill_assigned_trainer, noop_reverse),
    ]
```

(Keep whatever `dependencies` value `makemigrations` produced if it differs — but it should be `0038_add_transfer_payment_provider`.)

- [ ] **Step 6: Apply migrations + run the tests**

Run: `cd backend && source venv/bin/activate && python manage.py migrate && pytest core_app/tests/test_trainer_client_assignment.py -v`
Expected: PASS (both tests).

- [ ] **Step 7: Commit**

```bash
git add backend/core_app/models/user.py backend/core_app/migrations/0039_user_assigned_trainer.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): add User.assigned_trainer FK with backfill migration"
```

---

## Task 2: Admin user serializers — expose & accept assignment

**Files:**
- Modify: `core_app/serializers/admin_user_serializers.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

- [ ] **Step 1: Write the failing test**

Append to `core_app/tests/test_trainer_client_assignment.py`:

```python
from rest_framework.test import APIClient


@pytest.fixture
def admin_user(db):
    return User.objects.create_user(email='admin@kore.com', password='x', role=User.Role.ADMIN,
                                    is_staff=True, is_superuser=True)


@pytest.fixture
def admin_client(admin_user):
    c = APIClient()
    c.force_authenticate(user=admin_user)
    return c


@pytest.mark.django_db
def test_admin_detail_customer_includes_assigned_trainer(admin_client, customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    resp = admin_client.get(f'/api/admin/users/{customer.id}/')
    assert resp.status_code == 200
    assert resp.data['assigned_trainer'] == {
        'id': trainer_a.id,
        'first_name': 'Tra',
        'last_name': 'A',
    }


@pytest.mark.django_db
def test_admin_detail_customer_assigned_trainer_null_when_unassigned(admin_client, customer):
    resp = admin_client.get(f'/api/admin/users/{customer.id}/')
    assert resp.status_code == 200
    assert resp.data['assigned_trainer'] is None


@pytest.mark.django_db
def test_admin_detail_trainer_includes_assigned_clients(admin_client, customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    resp = admin_client.get(f'/api/admin/users/{trainer_a.user_id}/')
    assert resp.status_code == 200
    clients = resp.data['assigned_clients']
    assert [c['id'] for c in clients] == [customer.id]
    assert clients[0]['email'] == 'c1@kore.com'
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k admin_detail -v`
Expected: FAIL — `KeyError`/`assigned_trainer` not in response.

- [ ] **Step 3: Update `admin_user_serializers.py`**

Add to `AdminUserDetailSerializer` (which subclasses `AdminUserListSerializer`):

```python
class AdminUserDetailSerializer(AdminUserListSerializer):
    """Detail representation: subscriptions + trainer assignment."""

    subscriptions = serializers.SerializerMethodField()
    assigned_trainer = serializers.SerializerMethodField()
    assigned_clients = serializers.SerializerMethodField()

    class Meta(AdminUserListSerializer.Meta):
        fields = AdminUserListSerializer.Meta.fields + (
            'subscriptions', 'assigned_trainer', 'assigned_clients',
        )

    def get_subscriptions(self, user):
        subs = list(_subscriptions_for_user(user))
        return [_serialize_subscription_for_user(sub, user) for sub in subs]

    def get_assigned_trainer(self, user):
        if user.role != User.Role.CUSTOMER:
            return None
        tp = user.assigned_trainer
        if tp is None:
            return None
        return {'id': tp.id, 'first_name': tp.user.first_name, 'last_name': tp.user.last_name}

    def get_assigned_clients(self, user):
        if user.role != User.Role.TRAINER:
            return None
        tp = getattr(user, 'trainer_profile', None)
        if tp is None:
            return []
        clients = (
            User.objects.filter(assigned_trainer=tp, role=User.Role.CUSTOMER)
            .order_by('first_name', 'last_name')
        )
        out = []
        for c in clients:
            active_sub = Subscription.objects.filter(
                customer=c, status=Subscription.Status.ACTIVE,
            ).select_related('package').first()
            out.append({
                'id': c.id,
                'first_name': c.first_name,
                'last_name': c.last_name,
                'email': c.email,
                'is_active': c.is_active,
                'active_package': active_sub.package.title if active_sub else None,
            })
        return out
```

Then extend the write serializer — add to `AdminUserUpdateSerializer`:

```python
class AdminUserUpdateSerializer(serializers.Serializer):
    """Payload for ``PATCH /api/admin/users/{id}/``."""

    first_name = serializers.CharField(max_length=150, required=False)
    last_name = serializers.CharField(max_length=150, required=False)
    phone = serializers.CharField(max_length=50, required=False, allow_blank=True)
    role = serializers.ChoiceField(
        choices=[(User.Role.CUSTOMER, 'Customer'), (User.Role.TRAINER, 'Trainer')],
        required=False,
    )
    is_active = serializers.BooleanField(required=False)
    assigned_trainer_id = serializers.PrimaryKeyRelatedField(
        queryset=TrainerProfile.objects.all(),
        source='assigned_trainer',
        required=False,
        allow_null=True,
    )
```

Add `TrainerProfile` to the imports at the top:

```python
from core_app.models import Subscription, SubscriptionGuest, TrainerProfile, User
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k admin_detail -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/serializers/admin_user_serializers.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): admin user serializers expose assigned_trainer / assigned_clients"
```

---

## Task 3: Admin PATCH applies `assigned_trainer_id`; validate target is a customer

**Files:**
- Modify: `core_app/views/admin_user_views.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

Note: `partial_update` already does `for field, value in serializer.validated_data.items(): setattr(user, field, value)` — with `source='assigned_trainer'`, the validated key is `assigned_trainer` (a `TrainerProfile` instance or `None`), so `setattr` already works. We only need to (a) reject assignment on a non-customer, (b) make sure `null` clears it.

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.django_db
def test_admin_patch_assigns_trainer_to_customer(admin_client, customer, trainer_a):
    resp = admin_client.patch(f'/api/admin/users/{customer.id}/',
                              {'assigned_trainer_id': trainer_a.id}, format='json')
    assert resp.status_code == 200
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_a.id
    assert resp.data['assigned_trainer']['id'] == trainer_a.id


@pytest.mark.django_db
def test_admin_patch_reassigns_then_clears(admin_client, customer, trainer_a, trainer_b):
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': trainer_a.id}, format='json')
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': trainer_b.id}, format='json')
    customer.refresh_from_db()
    assert customer.assigned_trainer_id == trainer_b.id
    admin_client.patch(f'/api/admin/users/{customer.id}/',
                       {'assigned_trainer_id': None}, format='json')
    customer.refresh_from_db()
    assert customer.assigned_trainer_id is None


@pytest.mark.django_db
def test_admin_patch_assigning_trainer_to_a_trainer_is_rejected(admin_client, trainer_a, trainer_b):
    resp = admin_client.patch(f'/api/admin/users/{trainer_a.user_id}/',
                              {'assigned_trainer_id': trainer_b.id}, format='json')
    assert resp.status_code == 400
    assert 'assigned_trainer_id' in resp.data
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k admin_patch -v`
Expected: the "rejected" test FAILS (assignment to a trainer currently succeeds / 200). The others may pass already — that's fine.

- [ ] **Step 3: Guard in `partial_update`**

In `core_app/views/admin_user_views.py`, in `partial_update`, after `serializer.is_valid(raise_exception=True)` and before applying fields, add:

```python
        if 'assigned_trainer' in serializer.validated_data and user.role != User.Role.CUSTOMER:
            return Response(
                {'assigned_trainer_id': ['Solo los clientes pueden tener un entrenador asignado.']},
                status=status.HTTP_400_BAD_REQUEST,
            )
```

(`User` is already imported in this file.)

- [ ] **Step 4: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k admin_patch -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/admin_user_views.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): admin PATCH applies assigned_trainer_id, rejects non-customers"
```

---

## Task 4: `GET /api/admin/trainers/assignment-summary/`

**Files:**
- Create: `core_app/views/trainer_assignment_views.py`
- Modify: `core_app/urls/api_urls.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.fixture
def package(db):
    return Package.objects.create(
        title='P', short_description='s', category='personalizado',
        sessions_count=10, session_duration_minutes=60, price=1, currency='COP',
        validity_days=30, is_active=True, order=1,
    )


def _active_sub(customer, package):
    return Subscription.objects.create(
        customer=customer, package=package, status=Subscription.Status.ACTIVE,
        starts_at=timezone.now(), expires_at=timezone.now() + timezone.timedelta(days=30),
        sessions_used=0, sessions_total=10,
    )


@pytest.mark.django_db
def test_assignment_summary_counts(admin_client, trainer_a, trainer_b, package):
    c_assigned = User.objects.create_user(email='ca@kore.com', password='x', role=User.Role.CUSTOMER)
    c_unassigned = User.objects.create_user(email='cu@kore.com', password='x', role=User.Role.CUSTOMER)
    c_no_sub = User.objects.create_user(email='cn@kore.com', password='x', role=User.Role.CUSTOMER)
    _active_sub(c_assigned, package)
    _active_sub(c_unassigned, package)
    c_assigned.assigned_trainer = trainer_a
    c_assigned.save(update_fields=['assigned_trainer'])

    resp = admin_client.get('/api/admin/trainers/assignment-summary/')
    assert resp.status_code == 200
    assert resp.data['active_customers'] == 2   # c_assigned + c_unassigned
    assert resp.data['assigned'] == 1
    assert resp.data['unassigned'] == 1
    per = {row['trainer_id']: row['client_count'] for row in resp.data['per_trainer']}
    assert per[trainer_a.id] == 1
    assert per[trainer_b.id] == 0


@pytest.mark.django_db
def test_assignment_summary_requires_admin(customer):
    c = APIClient()
    c.force_authenticate(user=customer)
    assert c.get('/api/admin/trainers/assignment-summary/').status_code in (403, 401)
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k assignment_summary -v`
Expected: FAIL — 404 (route not registered).

- [ ] **Step 3: Create the view**

`core_app/views/trainer_assignment_views.py`:

```python
"""Admin-only summary of trainer ↔ client assignment coverage."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription, TrainerProfile, User
from core_app.permissions import IsAdminRole


class TrainerAssignmentSummaryView(APIView):
    """GET /api/admin/trainers/assignment-summary/

    Returns coverage stats for the admin trainers view:
      - active_customers: customers (role=customer) with >=1 active subscription
      - assigned / unassigned: of those, how many have / lack an assigned trainer
      - per_trainer: [{trainer_id, first_name, last_name, client_count}]
        where client_count counts ALL assigned customers (not only active-sub ones)
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        active_customer_ids = set(
            Subscription.objects.filter(status=Subscription.Status.ACTIVE)
            .values_list('customer_id', flat=True)
        )
        active_customers = (
            User.objects.filter(id__in=active_customer_ids, role=User.Role.CUSTOMER)
        )
        active_count = active_customers.count()
        assigned_count = active_customers.filter(assigned_trainer__isnull=False).count()

        per_trainer = []
        for tp in TrainerProfile.objects.select_related('user').order_by('user__first_name'):
            per_trainer.append({
                'trainer_id': tp.id,
                'first_name': tp.user.first_name,
                'last_name': tp.user.last_name,
                'client_count': User.objects.filter(
                    assigned_trainer=tp, role=User.Role.CUSTOMER,
                ).count(),
            })

        return Response({
            'active_customers': active_count,
            'assigned': assigned_count,
            'unassigned': active_count - assigned_count,
            'per_trainer': per_trainer,
        })
```

- [ ] **Step 4: Register the route**

In `core_app/urls/api_urls.py`: add the import near the other view imports:

```python
from core_app.views.trainer_assignment_views import TrainerAssignmentSummaryView
```

and add a `path(...)` to `urlpatterns` (next to `trainer/my-clients/` — make sure it is **before** `path('', include(router.urls))` or among the explicit paths; it already is, since explicit paths sit alongside the router include):

```python
    path('admin/trainers/assignment-summary/', TrainerAssignmentSummaryView.as_view(), name='admin-trainer-assignment-summary'),
```

- [ ] **Step 5: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k assignment_summary -v`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/trainer_assignment_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): add GET /api/admin/trainers/assignment-summary/"
```

---

## Task 5: Auth profile carries `assigned_trainer`

**Files:**
- Modify: `core_app/serializers/profile_serializers.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.django_db
def test_profile_includes_assigned_trainer(customer, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.get('/api/auth/profile/')
    assert resp.status_code == 200
    at = resp.data['user']['assigned_trainer']
    assert at['id'] == trainer_a.id
    assert at['session_duration_minutes'] == 60
    assert 'location' in at


@pytest.mark.django_db
def test_profile_assigned_trainer_null_when_unassigned(customer):
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.get('/api/auth/profile/')
    assert resp.status_code == 200
    assert resp.data['user']['assigned_trainer'] is None
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k profile_includes_assigned -v`
Expected: FAIL — `KeyError: 'assigned_trainer'`.

- [ ] **Step 3: Add the field to `ProfileResponseSerializer`**

In `core_app/serializers/profile_serializers.py`, add a method field to `ProfileResponseSerializer`:

```python
class ProfileResponseSerializer(serializers.Serializer):
    """Read-only serializer for the full profile GET response."""

    id = serializers.IntegerField(source='pk')
    email = serializers.EmailField()
    first_name = serializers.CharField()
    last_name = serializers.CharField()
    phone = serializers.CharField()
    role = serializers.CharField()
    customer_profile = CustomerProfileSerializer(read_only=True)
    today_mood = serializers.SerializerMethodField()
    assigned_trainer = serializers.SerializerMethodField()

    def get_today_mood(self, user):
        today = timezone.localdate()
        entry = MoodEntry.objects.filter(user=user, date=today).first()
        if entry:
            return {'score': entry.score, 'notes': entry.notes, 'date': str(entry.date)}
        return None

    def get_assigned_trainer(self, user):
        tp = getattr(user, 'assigned_trainer', None)
        if tp is None:
            return None
        return {
            'id': tp.id,
            'first_name': tp.user.first_name,
            'last_name': tp.user.last_name,
            'location': tp.location,
            'session_duration_minutes': tp.session_duration_minutes,
        }
```

- [ ] **Step 4: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k profile -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/serializers/profile_serializers.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): include assigned_trainer in /api/auth/profile/"
```

---

## Task 6: Booking gate — block customers with no assigned trainer; force trainer

**Files:**
- Modify: `core_app/serializers/booking_serializers.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

Behavior:
- In `BookingSerializer.validate(attrs)`: if the request user is a customer with `assigned_trainer is None` → raise `ValidationError({'detail': 'Aún no puedes agendar...', 'code': 'no_trainer_assigned'})`.
- If they have an assigned trainer: set `attrs['trainer'] = customer.assigned_trainer`, and if the chosen slot has a `trainer_id` that isn't that trainer → `ValidationError({'slot_id': 'Ese horario no es de tu entrenador.'})`.
- This runs before the existing `_validate_slot_available` / overlap / buffer checks (or right after computing `slot` — order it so the `no_trainer_assigned` check is first).

Note on guests: a `SubscriptionGuest`-accepted user is blocked from `/api/bookings/` POST anyway (`BookingViewSet.create` returns 403 before the serializer runs), and `_maybe_create_guest_booking` creates the guest's row server-side without going through `validate()` — so the gate naturally applies only to the host. No special handling needed.

- [ ] **Step 1: Write the failing test**

Append:

```python
from datetime import timedelta


@pytest.fixture
def future_slot(db, trainer_a):
    now = timezone.now()
    starts = now + timedelta(hours=20)
    return AvailabilitySlot.objects.create(
        trainer=trainer_a, starts_at=starts, ends_at=starts + timedelta(hours=1),
        is_active=True, is_blocked=False,
    )


@pytest.fixture
def future_slot_other(db, trainer_b):
    now = timezone.now()
    starts = now + timedelta(hours=21)
    return AvailabilitySlot.objects.create(
        trainer=trainer_b, starts_at=starts, ends_at=starts + timedelta(hours=1),
        is_active=True, is_blocked=False,
    )


@pytest.mark.django_db
def test_booking_blocked_without_assigned_trainer(customer, package, future_slot):
    sub = _active_sub(customer, package)
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.post('/api/bookings/', {
        'package_id': package.id, 'slot_id': future_slot.id, 'subscription_id': sub.id,
    }, format='json')
    assert resp.status_code == 400
    assert resp.data.get('code') == 'no_trainer_assigned'


@pytest.mark.django_db
def test_booking_succeeds_with_assigned_trainer_and_forces_trainer(customer, package, future_slot, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    sub = _active_sub(customer, package)
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.post('/api/bookings/', {
        'package_id': package.id, 'slot_id': future_slot.id, 'subscription_id': sub.id,
    }, format='json')
    assert resp.status_code == 201, resp.data
    assert Booking.objects.get(id=resp.data['id']).trainer_id == trainer_a.id


@pytest.mark.django_db
def test_booking_rejected_for_slot_of_another_trainer(customer, package, future_slot_other, trainer_a):
    customer.assigned_trainer = trainer_a
    customer.save(update_fields=['assigned_trainer'])
    sub = _active_sub(customer, package)
    c = APIClient()
    c.force_authenticate(user=customer)
    resp = c.post('/api/bookings/', {
        'package_id': package.id, 'slot_id': future_slot_other.id, 'subscription_id': sub.id,
    }, format='json')
    assert resp.status_code == 400
    assert 'slot_id' in resp.data
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k booking -v`
Expected: FAIL — currently no gate; first test gets 201.

- [ ] **Step 3: Add the gate to `BookingSerializer.validate`**

In `core_app/serializers/booking_serializers.py`, at the **top** of `validate(self, attrs)` (before `slot = attrs.get('slot')`), add:

```python
        request = self.context.get('request')
        customer = getattr(request, 'user', None) if request else None
        if customer is not None and getattr(customer, 'is_authenticated', False):
            if getattr(customer, 'role', None) == 'customer':
                assigned = getattr(customer, 'assigned_trainer', None)
                if assigned is None:
                    raise serializers.ValidationError({
                        'detail': 'Aún no puedes agendar. Espera a que te asignen un entrenador.',
                        'code': 'no_trainer_assigned',
                    })
                attrs['trainer'] = assigned
```

Then, immediately after the existing `slot = attrs.get('slot')` line, add the slot/trainer consistency check:

```python
        if slot is not None and slot.trainer_id is not None:
            assigned = attrs.get('trainer')
            if assigned is not None and slot.trainer_id != assigned.id:
                raise serializers.ValidationError({'slot_id': 'Ese horario no es de tu entrenador.'})
```

Notes:
- The existing `validate` already recomputes `customer = getattr(request, 'user', ...)` further down — that line is now redundant but harmless; leave it or fold it in, your call (don't churn unrelated code).
- The existing `create()` reads `trainer = validated_data.get('trainer')` — since `validate()` now sets `attrs['trainer']`, `create()` gets the right trainer automatically. Don't change `create()`.

- [ ] **Step 4: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k booking -v`
Expected: PASS.

- [ ] **Step 5: Sanity-run the existing booking tests for regressions**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/ -k booking -q` (if this exceeds 20 tests, narrow to the specific booking test file, e.g. `pytest core_app/tests/test_booking*.py -q`).
Expected: PASS — except any pre-existing tests that create bookings for a customer without an assigned trainer; if such tests exist, update those fixtures to set `assigned_trainer` (this is expected fallout of the new rule, and is part of this task).

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/serializers/booking_serializers.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): block bookings without an assigned trainer; force booking.trainer"
```

---

## Task 7: `TrainerClientListView` — clients = assigned clients

**Files:**
- Modify: `core_app/views/trainer_client_views.py`
- Test: `core_app/tests/test_trainer_client_assignment.py`

- [ ] **Step 1: Write the failing test**

Append:

```python
@pytest.mark.django_db
def test_trainer_my_clients_returns_assigned_not_booking_derived(future_slot, package, trainer_a, trainer_b):
    # c_booking has a booking with trainer_a but is NOT assigned to them
    c_booking = User.objects.create_user(email='cb@kore.com', password='x', role=User.Role.CUSTOMER,
                                         first_name='Booked', last_name='Only')
    Booking.objects.create(customer=c_booking, package=package, slot=future_slot,
                           trainer=trainer_a, status=Booking.Status.PENDING)
    # c_assigned is assigned to trainer_a but has no booking
    c_assigned = User.objects.create_user(email='cas@kore.com', password='x', role=User.Role.CUSTOMER,
                                          first_name='Assigned', last_name='User')
    c_assigned.assigned_trainer = trainer_a
    c_assigned.save(update_fields=['assigned_trainer'])

    c = APIClient()
    c.force_authenticate(user=trainer_a.user)
    resp = c.get('/api/trainer/my-clients/')
    assert resp.status_code == 200
    ids = [row['id'] for row in resp.data]
    assert c_assigned.id in ids
    assert c_booking.id not in ids
```

- [ ] **Step 2: Run and confirm failure**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k my_clients -v`
Expected: FAIL — `c_booking` shows up, `c_assigned` doesn't.

- [ ] **Step 3: Change the client source in `TrainerClientListView.get`**

In `core_app/views/trainer_client_views.py`, replace the `customer_ids = (...)` block with:

```python
        customers = (
            User.objects.filter(assigned_trainer=trainer_profile, role=User.Role.CUSTOMER)
            .select_related('customer_profile')
            .annotate(
                total_sessions=Count(
                    'bookings',
                    filter=Q(bookings__trainer=trainer_profile),
                ),
                completed_sessions=Count(
                    'bookings',
                    filter=Q(
                        bookings__trainer=trainer_profile,
                        bookings__status=Booking.Status.CONFIRMED,
                    ),
                ),
                last_session_date=Max(
                    'bookings__slot__starts_at',
                    filter=Q(
                        bookings__trainer=trainer_profile,
                        bookings__status__in=[
                            Booking.Status.CONFIRMED,
                            Booking.Status.PENDING,
                        ],
                    ),
                ),
            )
            .order_by('first_name', 'last_name')
        )
```

i.e. drop the intermediate `customer_ids` query and filter `User.objects.filter(assigned_trainer=trainer_profile, role=User.Role.CUSTOMER)` directly. The rest of the method (the `for c in customers:` loop building `results`) is unchanged.

- [ ] **Step 4: Run the tests**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -k my_clients -v`
Expected: PASS.

- [ ] **Step 5: Sanity-check `TrainerClientDetailView` / sessions still work**

The detail/sessions views (`TrainerClientDetailView`, `TrainerClientSessionsView`) gate access by "is this customer one of mine?". If they check booking-derived ownership, they'll now reject assigned-but-never-booked clients. Grep: `cd backend && grep -n "trainer" core_app/views/trainer_client_views.py | grep -i "filter\|exists\|404"`. If a detail view checks `Booking.objects.filter(customer=..., trainer=trainer_profile).exists()`, change it to also accept `customer.assigned_trainer_id == trainer_profile.id`. Run any existing trainer-client tests: `pytest core_app/tests/ -k trainer_client -q` (narrow if >20). Expected: PASS. (If there is no ownership check there, skip — no change needed.)

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/trainer_client_views.py backend/core_app/tests/test_trainer_client_assignment.py
git commit -m "feat(backend): trainer my-clients now lists assigned clients"
```

---

## Task 8: Frontend — authStore carries `assigned_trainer`

**Files:**
- Modify: `lib/stores/authStore.ts`
- Test: `app/__tests__/lib/stores/authStore.assignedTrainer.test.ts` (new; place under the existing `app/__tests__/` tree mirroring other store tests — check `ls app/__tests__` for the convention and match it)

- [ ] **Step 1: Add the type + mapping (no separate failing test first — this is a pure type/shape change; the gate test in Task 9 covers behavior)**

In `lib/stores/authStore.ts`:

1. Extend the `User` type:

```ts
export type AssignedTrainer = {
  id: number;
  first_name: string;
  last_name: string;
  location: string;
  session_duration_minutes: number;
};

export type User = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  role: string;
  name: string;
  profile_completed: boolean;
  avatar_url: string | null;
  must_change_password: boolean;
  assigned_trainer: AssignedTrainer | null;
};
```

2. Extend `ProfileResponse['user']` with `assigned_trainer?: AssignedTrainer | null;`.

3. In `mapUser`, accept and set it:

```ts
function mapUser(
  raw: LoginResponse['user'],
  extra?: { profile_completed?: boolean; avatar_url?: string | null; assigned_trainer?: AssignedTrainer | null },
): User {
  const first = raw.first_name || '';
  const last = raw.last_name || '';
  return {
    id: String(raw.id),
    email: raw.email,
    first_name: first,
    last_name: last,
    phone: raw.phone || '',
    role: raw.role,
    name: [first, last].filter(Boolean).join(' ') || raw.email,
    profile_completed: extra?.profile_completed ?? false,
    avatar_url: extra?.avatar_url ?? null,
    must_change_password: raw.must_change_password ?? false,
    assigned_trainer: extra?.assigned_trainer ?? null,
  };
}
```

4. In `hydrate()`'s `.then(({ data }) => { ... })`, pass it through:

```ts
        const cp = data.user.customer_profile;
        const user = mapUser(data.user, {
          profile_completed: cp?.profile_completed ?? false,
          avatar_url: cp?.avatar_url ?? null,
          assigned_trainer: data.user.assigned_trainer ?? null,
        });
```

Note: `login()`/`register()` responses (`/auth/login/`, `/auth/register/`) don't include `assigned_trainer` — so right after login it's `null` until `hydrate()` runs. That's acceptable: the `(app)` layout calls `hydrate()` on mount, which re-fetches `/auth/profile/`. (If you want it immediately on login, also add `assigned_trainer` to the login response serializer — out of scope unless trivial.)

- [ ] **Step 2: Write a small Jest test**

`app/__tests__/lib/stores/authStore.assignedTrainer.test.ts` (adjust path to match the repo's test layout):

```ts
import { mapUser } from '@/lib/stores/authStore';
// If mapUser isn't exported, export it from authStore.ts (named export) — it's a pure helper.

describe('authStore mapUser assigned_trainer', () => {
  const raw = { id: 1, email: 'c@kore.com', first_name: 'C', last_name: 'One', phone: '', role: 'customer' };

  it('defaults assigned_trainer to null', () => {
    expect(mapUser(raw).assigned_trainer).toBeNull();
  });

  it('passes assigned_trainer through from extra', () => {
    const at = { id: 3, first_name: 'T', last_name: 'A', location: 'Studio', session_duration_minutes: 60 };
    expect(mapUser(raw, { assigned_trainer: at }).assigned_trainer).toEqual(at);
  });
});
```

If `mapUser` is currently not exported, add `export` to its declaration in `authStore.ts`.

- [ ] **Step 3: Run the test**

Run: `cd frontend && npm test -- app/__tests__/lib/stores/authStore.assignedTrainer.test.ts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/stores/authStore.ts frontend/app/__tests__/lib/stores/authStore.assignedTrainer.test.ts
git commit -m "feat(frontend): carry assigned_trainer on the auth user"
```

---

## Task 9: Frontend — `bookingStore` uses the assigned trainer; `/book-session` gate

**Files:**
- Modify: `lib/stores/bookingStore.ts`, `app/(app)/book-session/page.tsx`
- Test: `app/__tests__/...book-session...` (new), optionally `e2e/app/book-session-gate.spec.ts`

- [ ] **Step 1: bookingStore — stop defaulting to `trainers[0]`; add a setter**

In `lib/stores/bookingStore.ts`:

1. In `fetchTrainers`, change the `set` so it no longer auto-picks `trainers[0]` — keep populating `trainers`, but leave `trainer` alone:

```ts
  fetchTrainers: async () => {
    set({ loading: true, error: null });
    try {
      const { data } = await api.get<PaginatedResponse<Trainer>>('/trainers/', {
        headers: authHeaders(),
      });
      const trainers = data.results ?? data;
      set({ trainers: Array.isArray(trainers) ? trainers : [] });
    } catch {
      set({ error: 'No se pudieron cargar los entrenadores.' });
    } finally {
      set({ loading: false });
    }
  },
```

2. Add an action `setTrainerFromAssigned` to the store (declare in `BookingState` and implement):

```ts
  // in BookingState:
  setTrainerFromAssigned: (t: { id: number; first_name: string; last_name: string; location: string; session_duration_minutes: number } | null) => void;

  // implementation:
  setTrainerFromAssigned: (t) => {
    if (!t) { set({ trainer: null }); return; }
    set({
      trainer: {
        id: t.id, user_id: 0, first_name: t.first_name, last_name: t.last_name,
        email: '', specialty: '', bio: '', location: t.location,
        session_duration_minutes: t.session_duration_minutes,
      },
    });
  },
```

(Reuse the existing `Trainer` type shape — the unused fields can be empty; the booking flow only reads `id`, `session_duration_minutes`, and the name/location for display.)

- [ ] **Step 2: book-session page — gate empty-state + use assigned trainer**

In `app/(app)/book-session/page.tsx`:

1. Read the auth user: `const user = useAuthStore((s) => s.user);` (it already uses `useAuthStore` — there's a `if (!user) { ...loading... }` near line 507).
2. On mount (in the existing "Load trainers and subscriptions on mount" effect around line 210), after subscriptions/trainers load, call `useBookingStore.getState().setTrainerFromAssigned(user?.assigned_trainer ?? null)`. If `user.assigned_trainer` changes, re-run. Simplest: add a dedicated effect:

```tsx
  const assignedTrainer = user?.assigned_trainer ?? null;
  useEffect(() => {
    useBookingStore.getState().setTrainerFromAssigned(assignedTrainer);
  }, [assignedTrainer]);
```

3. After the `if (!user) { ...spinner... }` block and before rendering the calendar UI, add the gate:

```tsx
  if (user.role === 'customer' && !user.assigned_trainer && !isReschedule) {
    return (
      <section className="min-h-screen bg-kore-cream flex items-center justify-center px-6">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 mx-auto mb-5 rounded-full bg-kore-red/10 flex items-center justify-center">
            <Calendar className="w-7 h-7 text-kore-red" strokeWidth={1.5} />
          </div>
          <h1 className="font-heading text-2xl font-semibold text-kore-gray-dark mb-3">
            Aún no puedes agendar
          </h1>
          <p className="text-sm text-kore-gray-dark/60 leading-relaxed mb-6">
            Estamos asignándote un entrenador. En cuanto te asignen uno podrás reservar tus sesiones desde aquí.
          </p>
          <Link
            href="/dashboard"
            className="inline-flex items-center gap-2 bg-kore-red hover:bg-kore-red-dark text-white font-medium px-7 py-3 rounded-xl transition-colors text-sm"
          >
            Volver al inicio
          </Link>
        </div>
      </section>
    );
  }
```

(Match the existing imports already present in this file: `Calendar` from `lucide-react`, `Link` from `next/link`. The classes mirror the "no subscription" empty-state already in `dashboard/page.tsx`.)

4. Defensive backstop in `handleConfirm`: the page already calls `createBooking(...)`. If `createBooking` surfaces the backend error, map `code === 'no_trainer_assigned'` to the same message. Check `bookingStore.createBooking` — it likely sets `bookingResult`/`error` from the response. If there's an `error` string, in the catch path also set something like `setSlotResolutionError('Aún no puedes agendar. Espera a que te asignen un entrenador.')` when the response body has `code === 'no_trainer_assigned'`. (If `createBooking` already swallows and stores errors, just ensure the page renders `store.error`. Keep this minimal — the empty-state in step 3 is the primary guard.)

- [ ] **Step 3: Jest test for the gate**

`app/__tests__/app/book-session/gate.test.tsx` (match the repo's test-path convention):

```tsx
import { render, screen } from '@testing-library/react';
import BookSessionPage from '@/app/(app)/book-session/page';
import { useAuthStore } from '@/lib/stores/authStore';

// Mock the booking store hooks the page uses so it doesn't try to hit the network.
jest.mock('@/lib/stores/bookingStore', () => ({
  useBookingStore: Object.assign(
    (sel: (s: unknown) => unknown) => sel({
      trainers: [], trainer: null, subscriptions: [], bookings: [], step: 1,
      selectedDate: null, selectedSlot: null, dayBookedSlots: [], dayAvailabilityLoading: false,
      loading: false, error: null,
    }),
    { getState: () => ({ setTrainerFromAssigned: jest.fn(), fetchTrainers: jest.fn(), fetchSubscriptions: jest.fn() }) },
  ),
}));

describe('BookSessionPage trainer gate', () => {
  it('shows the "aún no puedes agendar" empty-state when the customer has no assigned trainer', () => {
    useAuthStore.setState({
      user: {
        id: '1', email: 'c@kore.com', first_name: 'C', last_name: 'One', phone: '', role: 'customer',
        name: 'C One', profile_completed: true, avatar_url: null, must_change_password: false,
        assigned_trainer: null,
      },
      isAuthenticated: true, hydrated: true, accessToken: 't',
    });
    render(<BookSessionPage />);
    expect(screen.getByText('Aún no puedes agendar')).toBeInTheDocument();
  });
});
```

(If the page's imports make a unit render impractical — heavy child components — fall back to an E2E test instead; see step 4. Don't fight jsdom for an hour. The behavior is verified either way.)

- [ ] **Step 4: (Optional) E2E test**

`e2e/app/book-session-gate.spec.ts`: log in as a customer with no assigned trainer (seed via the dev DB or a fixture user), navigate to `/book-session`, assert `getByRole('heading', { name: 'Aún no puedes agendar' })` is visible. Run: `cd frontend && npx playwright test e2e/app/book-session-gate.spec.ts`. Skip if E2E infra/seed isn't readily available — note it in the PR.

- [ ] **Step 5: Run tests**

Run: `cd frontend && npm test -- app/__tests__/app/book-session/gate.test.tsx`
Expected: PASS (or, if you went the E2E route, the Playwright spec passes).

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/stores/bookingStore.ts "frontend/app/(app)/book-session/page.tsx" frontend/app/__tests__/app/book-session/gate.test.tsx
git commit -m "feat(frontend): /book-session uses assigned trainer, gates when none assigned"
```

---

## Task 10: Frontend — adminUserStore types + assign action + summary fetch

**Files:**
- Modify: `lib/stores/adminUserStore.ts`
- Test: `app/__tests__/lib/stores/adminUserStore.assign.test.ts` (new; match repo convention)

- [ ] **Step 1: Extend types**

In `lib/stores/adminUserStore.ts`:

```ts
export type AssignedTrainerRef = { id: number; first_name: string; last_name: string };

export type AssignedClientRow = {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  is_active: boolean;
  active_package: string | null;
};

export type AdminUserDetail = AdminUser & {
  subscriptions: AdminUserSubscriptionEntry[];
  assigned_trainer: AssignedTrainerRef | null;   // present when role==='customer'
  assigned_clients: AssignedClientRow[] | null;  // present when role==='trainer'
};

export type UpdateUserPayload = {
  first_name?: string;
  last_name?: string;
  phone?: string;
  role?: 'customer' | 'trainer';
  is_active?: boolean;
  assigned_trainer_id?: number | null;
};

export type AssignmentSummary = {
  active_customers: number;
  assigned: number;
  unassigned: number;
  per_trainer: { trainer_id: number; first_name: string; last_name: string; client_count: number }[];
};
```

Add to `AdminUserState`:

```ts
  assignmentSummary: AssignmentSummary | null;
  fetchAssignmentSummary: () => Promise<void>;
  assignTrainer: (customerId: number, trainerId: number | null) => Promise<{ ok: true } | { ok: false; errors: Record<string, string[]> }>;
```

- [ ] **Step 2: Implement the actions**

```ts
  assignmentSummary: null,

  fetchAssignmentSummary: async () => {
    try {
      const { data } = await api.get('/admin/trainers/assignment-summary/', { headers: authHeaders() });
      set({ assignmentSummary: data as AssignmentSummary });
    } catch {
      set({ assignmentSummary: null });
    }
  },

  assignTrainer: async (customerId, trainerId) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch(
        `/admin/users/${customerId}/`,
        { assigned_trainer_id: trainerId },
        { headers: authHeaders() },
      );
      set((state) => ({
        // keep `selected` fresh if we're editing this very user
        selected: state.selected && state.selected.id === customerId ? data : state.selected,
        actionLoading: false,
      }));
      return { ok: true };
    } catch (err: unknown) {
      const errResp = (err as { response?: { data?: Record<string, string[]> } }).response;
      set({ actionLoading: false });
      return { ok: false, errors: errResp?.data ?? {} };
    }
  },
```

Also add `assignmentSummary: null` to the `reset()` payload.

- [ ] **Step 3: Jest test (mock `api`)**

`app/__tests__/lib/stores/adminUserStore.assign.test.ts`:

```ts
import { api } from '@/lib/services/http';
import { useAdminUserStore } from '@/lib/stores/adminUserStore';

jest.mock('@/lib/services/http', () => ({ api: { get: jest.fn(), patch: jest.fn() } }));

describe('adminUserStore.assignTrainer', () => {
  it('PATCHes assigned_trainer_id and returns ok', async () => {
    (api.patch as jest.Mock).mockResolvedValue({ data: { id: 5, role: 'customer', assigned_trainer: { id: 3, first_name: 'T', last_name: 'A' } } });
    const res = await useAdminUserStore.getState().assignTrainer(5, 3);
    expect(api.patch).toHaveBeenCalledWith('/admin/users/5/', { assigned_trainer_id: 3 }, expect.anything());
    expect(res).toEqual({ ok: true });
  });

  it('fetchAssignmentSummary stores the payload', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { active_customers: 2, assigned: 1, unassigned: 1, per_trainer: [] } });
    await useAdminUserStore.getState().fetchAssignmentSummary();
    expect(useAdminUserStore.getState().assignmentSummary?.active_customers).toBe(2);
  });
});
```

- [ ] **Step 4: Run the test**

Run: `cd frontend && npm test -- app/__tests__/lib/stores/adminUserStore.assign.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/adminUserStore.ts frontend/app/__tests__/lib/stores/adminUserStore.assign.test.ts
git commit -m "feat(frontend): adminUserStore assignTrainer + assignment summary"
```

---

## Task 11: Frontend — admin/users list: trainers coverage card + per-trainer count

**Files:**
- Modify: `app/admin/users/UsersListClient.tsx`
- Test: covered by the store test in Task 10 + a light render check (optional)

- [ ] **Step 1: Fetch the summary when the "Entrenadores" filter is active**

In `app/admin/users/UsersListClient.tsx`:

- Pull `assignmentSummary` and `fetchAssignmentSummary` from `useAdminUserStore()`.
- Add an effect:

```tsx
  useEffect(() => {
    if (filters.role === 'trainer') fetchAssignmentSummary();
  }, [filters.role, fetchAssignmentSummary]);
```

- [ ] **Step 2: Render the coverage card above the list when `filters.role === 'trainer'`**

Right above the users list/table, conditionally render (use the page's existing card/stat primitives — there are `Card`, stat-style divs already in this file; mirror their classes):

```tsx
  {filters.role === 'trainer' && assignmentSummary && (
    <div className="mb-5 rounded-2xl bg-white/70 backdrop-blur-sm border border-white/60 shadow-sm p-5">
      <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55 mb-1">
        Cobertura de entrenadores
      </div>
      <div className="flex items-end gap-6 flex-wrap">
        <div>
          <div className="text-3xl font-black tracking-tight text-kore-burgundy tabular-nums">
            {assignmentSummary.active_customers}
          </div>
          <div className="text-[11px] text-kore-burgundy/55">clientes activos</div>
        </div>
        <div>
          <div className="text-2xl font-bold text-kore-sage tabular-nums">{assignmentSummary.assigned}</div>
          <div className="text-[11px] text-kore-burgundy/55">con entrenador</div>
        </div>
        <div>
          <div className={`text-2xl font-bold tabular-nums ${assignmentSummary.unassigned > 0 ? 'text-amber-500' : 'text-kore-burgundy/40'}`}>
            {assignmentSummary.unassigned}
          </div>
          <div className="text-[11px] text-kore-burgundy/55">sin entrenador</div>
        </div>
        <div className="flex-1 min-w-[140px]">
          <div className="h-2 rounded-full bg-kore-burgundy/8 overflow-hidden flex">
            <div className="h-full bg-kore-sage" style={{ width: `${assignmentSummary.active_customers ? (assignmentSummary.assigned / assignmentSummary.active_customers) * 100 : 0}%` }} />
            <div className="h-full bg-amber-400" style={{ width: `${assignmentSummary.active_customers ? (assignmentSummary.unassigned / assignmentSummary.active_customers) * 100 : 0}%` }} />
          </div>
        </div>
      </div>
      {assignmentSummary.unassigned > 0 && (
        <div className="mt-3 text-[11px] font-semibold text-amber-600">
          ⚠ {assignmentSummary.unassigned} cliente(s) activo(s) sin entrenador asignado.
        </div>
      )}
    </div>
  )}
```

(If `Card` is the project's standard wrapper, use `<Card className="p-5 mb-5">…</Card>` instead of the raw div — match the surrounding code.)

- [ ] **Step 3: Per-trainer client-count badge in each trainer row**

In the row rendering for users, when `u.role === 'trainer'`, look up `assignmentSummary?.per_trainer.find(p => p.trainer_id === ???)`. **Caveat:** the users list rows are `User` objects with `id` = user id, not TrainerProfile id. `per_trainer` is keyed by `trainer_id` (TrainerProfile id). To match them you need a TrainerProfile id per row. Two options:
- (a) Don't try to match per-row; show counts only inside the coverage card as a small list (`per_trainer.map(...)` → "Carlos M. · 4", etc.) under the card. **Recommended — simplest, no schema/serializer change.**
- (b) Add `trainer_profile_id` to `AdminUserListSerializer` (a `SerializerMethodField` returning `getattr(user, 'trainer_profile', None) and user.trainer_profile.id`) and match on that. Only do this if the per-row badge is wanted.

Go with (a): append a small trainer list inside the coverage card:

```tsx
      {assignmentSummary.per_trainer.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {assignmentSummary.per_trainer.map((p) => (
            <span key={p.trainer_id} className="rounded-full px-3 py-1 text-[11px] font-semibold bg-kore-burgundy/6 text-kore-burgundy">
              {p.first_name} {p.last_name} · {p.client_count}
            </span>
          ))}
        </div>
      )}
```

- [ ] **Step 4: Manual check**

Run: `cd frontend && npm run build` is too heavy; instead just run the dev server (`npm run dev`) and visit `/admin/users`, switch the filter to "Entrenadores", confirm the coverage card renders with the numbers and the per-trainer chips. (No new unit test required for this presentational change; the data path is covered by Task 10's store test.)

- [ ] **Step 5: Commit**

```bash
git add frontend/app/admin/users/UsersListClient.tsx
git commit -m "feat(frontend): admin users — trainer coverage card with assignment summary"
```

---

## Task 12: Frontend — admin/users/[id]: customer "assigned trainer" select + trainer "assigned clients" section

**Files:**
- Modify: `app/admin/users/[id]/UserDetailClient.tsx`
- Needs: a list of trainers to populate the `<select>`. Reuse `useBookingStore().trainers` + `fetchTrainers()` (already provides `{id, first_name, last_name, ...}`), or `useAdminUserStore` filtered by role — `bookingStore.fetchTrainers()` is the lightest. Add `import { useBookingStore } from '@/lib/stores/bookingStore';`.

- [ ] **Step 1: Customer detail — "Entrenador asignado" field**

In `UserDetailClient.tsx`, when `selected.role === 'customer'`, add a card (or a field inside the existing "Editar / Metadatos" card) with a `<select>`:

- Pull `assignTrainer` from `useAdminUserStore()`.
- On mount, if `selected.role === 'customer'`, ensure `useBookingStore.getState().fetchTrainers()` has run; read `const trainers = useBookingStore((s) => s.trainers);`.
- Local state: `const [assigning, setAssigning] = useState(false);`
- Render:

```tsx
{selected.role === 'customer' && (
  <Card className="p-7 mt-5">
    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
      Asignación
    </div>
    <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
      Entrenador asignado
    </div>
    <Field label="Entrenador" error={errors.assigned_trainer_id}>
      <select
        className="w-full rounded-xl border border-kore-burgundy/12 bg-white px-3.5 py-2.5 text-sm text-kore-burgundy"
        value={selected.assigned_trainer?.id ?? ''}
        disabled={assigning || actionLoading}
        onChange={async (e) => {
          const val = e.target.value === '' ? null : Number(e.target.value);
          setAssigning(true);
          const res = await assignTrainer(selected.id, val);
          setAssigning(false);
          if (!res.ok) {
            setErrors((p) => ({ ...p, assigned_trainer_id: Object.values(res.errors)[0]?.[0] ?? 'No se pudo asignar.' }));
          } else {
            setErrors((p) => { const n = { ...p }; delete n.assigned_trainer_id; return n; });
          }
        }}
      >
        <option value="">— Sin asignar —</option>
        {trainers.map((t) => (
          <option key={t.id} value={t.id}>{t.first_name} {t.last_name}</option>
        ))}
      </select>
    </Field>
    {!selected.assigned_trainer && (
      <div className="mt-2 text-[11px] font-semibold text-amber-600">
        Este cliente no puede agendar sesiones hasta que le asignes un entrenador.
      </div>
    )}
  </Card>
)}
```

Note: `assignTrainer` updates `selected` in the store on success (Task 10), so the `<select>` reflects the new value after re-render. The `errors` state and `setErrors` already exist in this component.

- [ ] **Step 2: Trainer detail — "Clientes asignados" section**

When `selected.role === 'trainer'`, render a card listing `selected.assigned_clients`:

```tsx
{selected.role === 'trainer' && (
  <Card className="p-7 mt-5">
    <div className="text-[10px] font-bold uppercase tracking-[0.22em] text-kore-burgundy/55">
      Clientes
    </div>
    <div className="font-heading text-lg font-semibold text-kore-burgundy mt-1 mb-4">
      Clientes asignados ({selected.assigned_clients?.length ?? 0})
    </div>
    {(selected.assigned_clients?.length ?? 0) === 0 ? (
      <div className="p-7 text-center rounded-xl bg-kore-burgundy/4 border border-dashed border-kore-burgundy/15 text-[13px] text-kore-burgundy/60">
        Este entrenador no tiene clientes asignados todavía.
      </div>
    ) : (
      <div className="flex flex-col gap-2">
        {selected.assigned_clients!.map((c) => (
          <div key={c.id} className="flex items-center justify-between rounded-xl bg-white border border-kore-burgundy/8 px-4 py-3">
            <div className="min-w-0">
              <Link href={`/admin/users/${c.id}`} className="text-sm font-semibold text-kore-burgundy hover:underline">
                {[c.first_name, c.last_name].filter(Boolean).join(' ') || c.email}
              </Link>
              <div className="text-[11px] text-kore-burgundy/55 truncate">{c.email}{c.active_package ? ` · ${c.active_package}` : ''}</div>
            </div>
            <Btn variant="ghost" size="sm" disabled={actionLoading} onClick={async () => {
              await assignTrainer(c.id, null);
              await fetchById(id);  // refresh assigned_clients
            }}>
              Quitar
            </Btn>
          </div>
        ))}
      </div>
    )}
  </Card>
)}
```

(Optional "Asignar cliente" picker on the trainer page is deferrable — the primary assignment path is the customer detail `<select>`. If the user wants it, it's a Modal with a search input that calls `assignTrainer(pickedId, thisTrainerProfileId)` then `fetchById(id)`. **Caveat:** `id` here is the trainer *user* id, not TrainerProfile id — to assign FROM the trainer page you need the TrainerProfile id. The simplest source: `selected.assigned_clients` doesn't carry it, so add `trainer_profile_id` to `AdminUserDetailSerializer` for trainers, or just rely on the customer-side `<select>`. Recommend: rely on the customer-side `<select>` and skip the trainer-page picker for now.)

- [ ] **Step 3: Manual check**

Run the dev server, open `/admin/users/<a customer id>` → confirm the "Entrenador asignado" `<select>` lists trainers, changing it persists (reload to confirm), and the amber warning shows when "Sin asignar". Open `/admin/users/<a trainer id>` → confirm "Clientes asignados" lists the right people and "Quitar" works.

- [ ] **Step 4: Commit**

```bash
git add "frontend/app/admin/users/[id]/UserDetailClient.tsx"
git commit -m "feat(frontend): admin user detail — assign trainer (customer) + assigned clients (trainer)"
```

---

## Task 13: Final regression sweep (smallest slices) + wrap-up

- [ ] **Step 1: Backend — run this feature's tests once more**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/test_trainer_client_assignment.py -q`
Expected: all PASS.

- [ ] **Step 2: Backend — booking + admin-user regression slices**

Run (one at a time, ≤3 commands): 
- `pytest core_app/tests/ -k booking -q` (narrow to the booking test file if >20 tests)
- `pytest core_app/tests/ -k "admin_user or admin-user" -q` (narrow similarly)
- `pytest core_app/tests/ -k trainer_client -q`
Expected: PASS. Fix any fixture that now needs `assigned_trainer` set (expected fallout of Task 6).

- [ ] **Step 3: Frontend — run the new unit tests**

Run: `cd frontend && npm test -- app/__tests__/lib/stores/authStore.assignedTrainer.test.ts app/__tests__/lib/stores/adminUserStore.assign.test.ts app/__tests__/app/book-session/gate.test.tsx`
Expected: PASS. (If the gate test had to become an E2E, run that spec instead.)

- [ ] **Step 4: Manual smoke (dev servers already runnable per CLAUDE.md)**

- Customer with no assigned trainer → `/book-session` shows "Aún no puedes agendar".
- Admin assigns that customer a trainer (whose schedule has weekday slots) → customer reloads → `/book-session` shows the calendar; picking a weekday slot and confirming creates the booking (201) — this also confirms the original "El horario ya no está disponible" bug is gone.
- `/admin/users` filtered by "Entrenadores" → coverage card + per-trainer chips render.
- Trainer's `/trainer/dashboard` (or `/trainer/clients`) shows the assigned client even before any booking exists.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin HEAD
# then: gh pr create --title "Trainer ↔ client assignment" --body "..."  (summarize: new User.assigned_trainer + backfill, admin assign UI + coverage chart, /book-session gate, my-clients now assignment-based. Out of scope: slot generator/schedules untouched. Test plan: pytest core_app/tests/test_trainer_client_assignment.py; frontend store + gate tests; manual smoke.)"
```

---

## Self-Review notes (for the implementer)

- **Spec coverage:** model FK + backfill (T1); admin expose/accept (T2,T3); summary endpoint/chart (T4,T10,T11); profile field (T5); booking gate + force trainer + slot/trainer consistency (T6); my-clients = assigned (T7); frontend gate + assigned-trainer wiring (T8,T9); admin assign UI both directions (T12). All spec sections map to a task.
- **Out-of-scope respected:** no task touches `slot_schedule.py`, `WEEKLY_SCHEDULE`, the maintenance task, or `AvailabilitySlot` constraints.
- **Known caveats called out inline:** (a) per-row trainer badge needs `trainer_profile_id` on the list serializer — avoided by putting counts in the coverage card; (b) trainer-page "assign client" picker needs the TrainerProfile id — deferred, customer-side `<select>` is the canonical path; (c) `login()` response doesn't carry `assigned_trainer` — `hydrate()` fills it; (d) existing booking tests may need `assigned_trainer` fixtures — handled in T6/T13.
- **Type consistency:** `assigned_trainer` shape on the auth user = `{id, first_name, last_name, location, session_duration_minutes}` (T5 backend ↔ T8 frontend). `AssignedTrainerRef` (admin, `{id, first_name, last_name}`) is intentionally lighter than the profile one. `assigned_trainer_id` is the write key everywhere (PATCH).
