# Phase 2 Part 4 — Internal Credit Store Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let clients spend approved credits on a catalog of items (immediate atomic redemption, floor-at-0), and let trainers manage the catalog and fulfill/reject redemptions with automatic refunds.

**Architecture:** Additive backend — `StoreItem`/`RedemptionRequest` models, `spend`/`apply_penalty`/`refund_redemption` in `credit_engine`, and store views moulded on `PhysicalTestViewSet` + the credit review flow. Frontend — a `storeStore`, a client `/tienda` page, the `/mis-creditos` balance split, and a trainer `/trainer/tienda` management page.

**Tech Stack:** Django 6 + DRF, PIL (image), Next.js 16 App Router + React 19 + TS, Zustand 5, Tailwind 4, Jest, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-03-phase4-credit-store-design.md`

## Global Constraints

- Branch: `feat/03072026-phase4-credit-store` (off `july-release`). Commit after every task.
- Spend uses **confirmed balance only**; pending never counts. Balance **floors at 0** (spends require funds; penalties clamp to the balance, recording the clamped amount so the ledger and wallet stay consistent).
- Items are **unlimited** — no stock field.
- Trainer role = **fulfillment**: mark `fulfilled` or `rejected` (reject → automatic refund). Both notify the client via `TrainerMessage`.
- Spanish user-facing copy; backend additive only, never edit old migrations. Deterministic tests (`frozen_now` backend; `jest.useFakeTimers({now, doNotFake:[...]})` frontend).
- Test policy: backend pytest + Jest store/util locally one file at a time; jsdom component + Playwright verified by CI (run Playwright locally serialized `./node_modules/.bin/playwright test <file> --workers=1` when useful). Dev servers up (backend :8001, frontend :3000).

## File map

- Create `backend/core_app/models/store.py` — `StoreItem`, `RedemptionRequest`.
- Modify `backend/core_app/models/__init__.py`, `models/credit.py` (2 Action choices).
- Modify `backend/core_app/services/credit_engine.py` — `spend`, `apply_penalty`, `refund_redemption`; switch penalty call sites.
- Create `backend/core_app/serializers/store_serializers.py`.
- Create `backend/core_app/views/store_views.py`.
- Modify `backend/core_app/urls/api_urls.py`, `backend/core_app/admin.py`.
- Frontend: `lib/stores/storeStore.ts`, `app/(app)/tienda/page.tsx`, `app/(app)/mis-creditos/page.tsx`, `app/(app)/trainer/tienda/page.tsx`, nav files.

---

### Task 1: Models — `StoreItem` + `RedemptionRequest` + ledger actions

**Files:**
- Create: `backend/core_app/models/store.py`
- Modify: `backend/core_app/models/credit.py` (add two `Action` choices)
- Modify: `backend/core_app/models/__init__.py`
- Test: `backend/core_app/tests/models/test_store_models.py`

**Interfaces:**
- Produces: `StoreItem` (`name`, `description`, `image`, `price_credits`, `item_type` in `ItemType.SERVICIO|PRODUCTO|SESION|DESCUENTO`, `is_active`); `RedemptionRequest` (`customer`, `item`, `credits_spent`, `status` in `Status.PENDING|FULFILLED|REJECTED`, `trainer_note`, `resolved_by`, `resolved_at`); `CreditTransaction.Action.REDEMPTION='redemption'`, `REDEMPTION_REFUND='redemption_refund'`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/models/test_store_models.py
import pytest

from core_app.models.store import StoreItem, RedemptionRequest


@pytest.mark.django_db
def test_store_item_defaults():
    item = StoreItem.objects.create(name='Camiseta KÓRE', price_credits=120, item_type='producto')
    assert item.is_active is True
    assert item.price_credits == 120


@pytest.mark.django_db
def test_redemption_request_defaults(existing_user):
    item = StoreItem.objects.create(name='Sesión extra', price_credits=200, item_type='sesion_adicional')
    r = RedemptionRequest.objects.create(customer=existing_user, item=item, credits_spent=200)
    assert r.status == RedemptionRequest.Status.PENDING
    assert r.resolved_at is None


@pytest.mark.django_db
def test_redemption_ledger_actions_exist():
    from core_app.models.credit import CreditTransaction
    assert CreditTransaction.Action.REDEMPTION == 'redemption'
    assert CreditTransaction.Action.REDEMPTION_REFUND == 'redemption_refund'
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/models/test_store_models.py --no-cov -q`
Expected: FAIL — `No module named 'core_app.models.store'`

- [ ] **Step 3: Implement the models**

```python
# backend/core_app/models/store.py
from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class StoreItem(TimestampedModel):
    """A redeemable catalog item. Unlimited (no stock)."""

    class ItemType(models.TextChoices):
        SERVICIO = 'servicio', 'Servicio'
        PRODUCTO = 'producto', 'Producto físico'
        SESION = 'sesion_adicional', 'Sesión adicional'
        DESCUENTO = 'descuento', 'Descuento'

    name = models.CharField(max_length=120)
    description = models.TextField(blank=True)
    image = models.ImageField(upload_to='store_items/', null=True, blank=True)
    price_credits = models.PositiveIntegerField()
    item_type = models.CharField(max_length=20, choices=ItemType.choices, default=ItemType.SERVICIO)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('-is_active', 'price_credits', 'name')

    def __str__(self):
        return f'{self.name} ({self.price_credits} cr)'


class RedemptionRequest(TimestampedModel):
    """A client's redemption of a StoreItem. Credits are spent immediately;
    the trainer fulfills or rejects (reject → refund)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pendiente'
        FULFILLED = 'fulfilled', 'Entregado'
        REJECTED = 'rejected', 'Rechazado'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='redemptions',
    )
    item = models.ForeignKey(StoreItem, on_delete=models.PROTECT, related_name='redemptions')
    credits_spent = models.PositiveIntegerField()
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    trainer_note = models.TextField(blank=True)
    resolved_by = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.SET_NULL, null=True, blank=True, related_name='+',
    )
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.customer} → {self.item.name} ({self.status})'
```

Add to `CreditTransaction.Action` in `backend/core_app/models/credit.py` (after `ADJUSTMENT`):

```python
        REDEMPTION = 'redemption', 'Store redemption'
        REDEMPTION_REFUND = 'redemption_refund', 'Redemption refund'
```

Update `backend/core_app/models/__init__.py`:

```python
from .store import StoreItem, RedemptionRequest
```

and add `'StoreItem', 'RedemptionRequest',` to `__all__`.

- [ ] **Step 4: Migrate + run test**

Run: `python manage.py makemigrations core_app && pytest core_app/tests/models/test_store_models.py --no-cov -q`
Expected: migration `0060_*` created; 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/models/ backend/core_app/migrations/ backend/core_app/tests/models/test_store_models.py
git commit -m "feat(store): StoreItem + RedemptionRequest models + redemption ledger actions"
```

---

### Task 2: Engine — `spend` (funds check, floor-at-0)

**Files:**
- Modify: `backend/core_app/services/credit_engine.py` (append)
- Test: `backend/core_app/tests/services/test_credit_spend.py`

**Interfaces:**
- Consumes: `get_wallet`, `CreditTransaction`.
- Produces: `spend(customer, amount, reference_type, reference_id, description) -> CreditTransaction | None` — returns None if `amount <= 0`, insufficient funds, or duplicate reference; otherwise a confirmed negative ledger entry, balance never below 0.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_spend.py
import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_spend_deducts_when_funds_suffice(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    tx = credit_engine.spend(existing_user, 60, 'redemption_request', '5', 'Canje camiseta')
    assert tx is not None
    assert tx.amount == -60
    assert credit_engine.get_wallet(existing_user).balance == 40


@pytest.mark.django_db
def test_spend_refuses_insufficient_funds(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '2', 'x', amount=10)
    tx = credit_engine.spend(existing_user, 60, 'redemption_request', '6', 'Canje')
    assert tx is None
    assert credit_engine.get_wallet(existing_user).balance == 10


@pytest.mark.django_db
def test_spend_is_idempotent_per_reference(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '3', 'x', amount=100)
    credit_engine.spend(existing_user, 20, 'redemption_request', '7', 'Canje')
    dup = credit_engine.spend(existing_user, 20, 'redemption_request', '7', 'Canje')
    assert dup is None
    assert credit_engine.get_wallet(existing_user).balance == 80
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/services/test_credit_spend.py --no-cov -q`
Expected: FAIL — `AttributeError: ... has no attribute 'spend'`

- [ ] **Step 3: Implement (append to `credit_engine.py`)**

```python
def spend(customer, amount, reference_type, reference_id, description) -> CreditTransaction | None:
    """Debit confirmed credits for a redemption. Atomic; never goes below 0.

    Returns None on non-positive amount, insufficient funds, or duplicate reference.
    """
    if amount <= 0:
        return None
    ref_id = str(reference_id) if reference_id is not None else None
    with transaction.atomic():
        wallet = CreditWallet.objects.select_for_update().get_or_create(customer=customer)[0]
        if wallet.balance < amount:
            return None
        tx, created = CreditTransaction.objects.get_or_create(
            customer=customer,
            action=CreditTransaction.Action.REDEMPTION,
            reference_type=reference_type,
            reference_id=ref_id,
            defaults={'amount': -amount, 'status': CreditTransaction.Status.CONFIRMED, 'description': description},
        )
        if not created:
            return None
        CreditWallet.objects.filter(customer=customer).update(balance=F('balance') - amount)
    return tx
```

- [ ] **Step 4: Run test, commit**

Run: `pytest core_app/tests/services/test_credit_spend.py --no-cov -q`
Expected: 3 passed

```bash
git add backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_spend.py
git commit -m "feat(store): credit_engine.spend with funds check and floor-at-0"
```

---

### Task 3: Engine — `apply_penalty` (clamp to balance) + switch call sites

**Files:**
- Modify: `backend/core_app/services/credit_engine.py`
- Test: `backend/core_app/tests/services/test_credit_penalty_floor.py`

**Interfaces:**
- Consumes: `get_wallet`, `get_settings`, `action_value`, `CreditTransaction`.
- Produces: `apply_penalty(customer, action, reference_type, reference_id, description) -> CreditTransaction | None` — records a clamped negative amount (never drives the balance below 0; returns None when balance is already 0 or a duplicate reference). `record_attendance` no-show and `on_reschedule` switch to it.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_penalty_floor.py
import pytest

from core_app.models.credit import CreditTransaction
from core_app.services import credit_engine


@pytest.mark.django_db
def test_penalty_clamps_to_balance(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '1', 'x', amount=10)
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '9', 'No asististe')
    # preset no_show_penalty is -40 but only 10 available → records -10, balance 0
    assert tx.amount == -10
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_penalty_on_zero_balance_records_nothing(existing_user):
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '10', 'No asististe')
    assert tx is None
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_penalty_full_when_funds_suffice(existing_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '2', 'x', amount=100)
    tx = credit_engine.apply_penalty(existing_user, CreditTransaction.Action.NO_SHOW_PENALTY, 'booking', '11', 'No asististe')
    assert tx.amount == -40
    assert credit_engine.get_wallet(existing_user).balance == 60
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/services/test_credit_penalty_floor.py --no-cov -q`
Expected: FAIL — no attribute `apply_penalty`

- [ ] **Step 3: Implement + switch call sites**

Append to `credit_engine.py`:

```python
def apply_penalty(customer, action, reference_type, reference_id, description) -> CreditTransaction | None:
    """Apply a penalty clamped to the available balance (floor at 0).

    The recorded amount is the clamped debit, so the ledger and wallet stay
    consistent. Returns None when the balance is already 0 or the reference
    was already penalized.
    """
    magnitude = abs(action_value(get_settings(), action))
    ref_id = str(reference_id) if reference_id is not None else None
    with transaction.atomic():
        wallet = CreditWallet.objects.select_for_update().get_or_create(customer=customer)[0]
        effective = min(magnitude, max(0, wallet.balance))
        if effective <= 0:
            return None
        tx, created = CreditTransaction.objects.get_or_create(
            customer=customer,
            action=action,
            reference_type=reference_type,
            reference_id=ref_id,
            defaults={'amount': -effective, 'status': CreditTransaction.Status.CONFIRMED, 'description': description},
        )
        if not created:
            return None
        CreditWallet.objects.filter(customer=customer).update(balance=F('balance') - effective)
    return tx
```

In `record_attendance` (no-show branch), replace the `award(... NO_SHOW_PENALTY ...)` call with:

```python
        apply_penalty(
            booking.customer, CreditTransaction.Action.NO_SHOW_PENALTY,
            'booking', booking.pk,
            f'No asististe a tu sesión del {day}',
        )
```

In `on_reschedule`, replace the `award(... LATE_RESCHEDULE_PENALTY ...)` call with:

```python
        apply_penalty(
            old_booking.customer, CreditTransaction.Action.LATE_RESCHEDULE_PENALTY,
            'booking', old_booking.pk,
            f'Reprogramaste tu sesión del {day} con poca anticipación',
        )
```

(The no-show reversal already reads `prior_penalty.amount`, so it correctly reverses the clamped amount.)

- [ ] **Step 4: Run new test + the existing engine-rules regression**

Run: `pytest core_app/tests/services/test_credit_penalty_floor.py core_app/tests/services/test_credit_engine_rules.py --no-cov -q`
Expected: new 3 PASS; existing rules still PASS (they seed enough balance that clamping doesn't change amounts — if any asserted a specific negative balance, update it to floor at 0)

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_penalty_floor.py
git commit -m "feat(store): floor-at-0 penalties via apply_penalty; switch penalty call sites"
```

---

### Task 4: Engine — `refund_redemption`

**Files:**
- Modify: `backend/core_app/services/credit_engine.py`
- Test: `backend/core_app/tests/services/test_credit_refund.py`

**Interfaces:**
- Produces: `refund_redemption(request, reviewer, note='') -> bool` — awards a positive `redemption_refund` for `request.credits_spent`, sets the request `rejected` + note + `resolved_by`/`resolved_at`. Idempotent (already-resolved → False).

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/services/test_credit_refund.py
import pytest

from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.services import credit_engine


@pytest.mark.django_db
def test_refund_returns_credits_and_marks_rejected(existing_user, admin_user):
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    item = StoreItem.objects.create(name='X', price_credits=60, item_type='producto')
    credit_engine.spend(existing_user, 60, 'redemption_request', '1', 'Canje X')
    req = RedemptionRequest.objects.create(customer=existing_user, item=item, credits_spent=60)
    # after spend, balance is 40
    assert credit_engine.get_wallet(existing_user).balance == 40
    ok = credit_engine.refund_redemption(req, admin_user, 'Sin stock')
    assert ok is True
    req.refresh_from_db()
    assert req.status == RedemptionRequest.Status.REJECTED
    assert 'Sin stock' in req.trainer_note
    assert credit_engine.get_wallet(existing_user).balance == 100
    # idempotent
    assert credit_engine.refund_redemption(req, admin_user, 'otra') is False
```

Note: the spend uses ref `('redemption', 'redemption_request', '1')` and the refund uses `('redemption_refund', 'redemption_request', <req.pk>)`. In the test the request pk may differ from '1'; align the refund's reference to `req.pk` inside `refund_redemption`.

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/services/test_credit_refund.py --no-cov -q`
Expected: FAIL — no attribute `refund_redemption`

- [ ] **Step 3: Implement (append to `credit_engine.py`)**

```python
def refund_redemption(request_obj, reviewer, note: str = '') -> bool:
    """Reject a redemption and refund its credits. Idempotent on non-pending."""
    from core_app.models.store import RedemptionRequest
    updated = RedemptionRequest.objects.filter(
        pk=request_obj.pk, status=RedemptionRequest.Status.PENDING,
    ).update(
        status=RedemptionRequest.Status.REJECTED,
        trainer_note=note,
        resolved_by=reviewer,
        resolved_at=timezone.now(),
    )
    if not updated:
        return False
    award(
        request_obj.customer, CreditTransaction.Action.REDEMPTION_REFUND,
        'redemption_request', request_obj.pk,
        f'Canje rechazado: {request_obj.item.name} — créditos devueltos',
        amount=request_obj.credits_spent,
    )
    return True
```

- [ ] **Step 4: Run test, commit**

Run: `pytest core_app/tests/services/test_credit_refund.py --no-cov -q`
Expected: 1 passed

```bash
git add backend/core_app/services/credit_engine.py backend/core_app/tests/services/test_credit_refund.py
git commit -m "feat(store): refund_redemption reverses credits on trainer rejection"
```

---

### Task 5: Serializers + admin

**Files:**
- Create: `backend/core_app/serializers/store_serializers.py`
- Modify: `backend/core_app/admin.py`
- Test: none (exercised via view tests)

**Interfaces:**
- Produces: `StoreItemSerializer` (read: `id, name, description, image_url, price_credits, item_type, is_active`; write: `image` ImageField), `RedemptionRequestSerializer` (`id, item, item_name, item_image_url, credits_spent, status, trainer_note, created_at, resolved_at`).

- [ ] **Step 1: Implement serializers**

```python
# backend/core_app/serializers/store_serializers.py
from rest_framework import serializers

from core_app.models.store import StoreItem, RedemptionRequest

MAX_IMAGE_BYTES = 5 * 1024 * 1024


class StoreItemSerializer(serializers.ModelSerializer):
    image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = StoreItem
        fields = ('id', 'name', 'description', 'image', 'image_url', 'price_credits', 'item_type', 'is_active')
        extra_kwargs = {'image': {'write_only': True, 'required': False}}

    def get_image_url(self, obj):
        if not obj.image:
            return None
        request = self.context.get('request')
        url = obj.image.url
        return request.build_absolute_uri(url) if request else url

    def validate_image(self, value):
        if value and value.size > MAX_IMAGE_BYTES:
            raise serializers.ValidationError('La imagen no puede superar 5MB.')
        return value


class RedemptionRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_image_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RedemptionRequest
        fields = ('id', 'item', 'item_name', 'item_image_url', 'credits_spent', 'status', 'trainer_note', 'created_at', 'resolved_at')
        read_only_fields = ('credits_spent', 'status', 'trainer_note', 'resolved_at')

    def get_item_image_url(self, obj):
        if not obj.item.image:
            return None
        request = self.context.get('request')
        url = obj.item.image.url
        return request.build_absolute_uri(url) if request else url
```

- [ ] **Step 2: Register admin**

In `backend/core_app/admin.py` add near the other registrations:

```python
from core_app.models.store import StoreItem, RedemptionRequest


@admin.register(StoreItem)
class StoreItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_credits', 'item_type', 'is_active')
    list_filter = ('item_type', 'is_active')
    search_fields = ('name', 'description')


@admin.register(RedemptionRequest)
class RedemptionRequestAdmin(admin.ModelAdmin):
    list_display = ('customer', 'item', 'credits_spent', 'status', 'created_at')
    list_filter = ('status',)
    raw_id_fields = ('customer', 'item', 'resolved_by')
```

- [ ] **Step 3: Django check, commit**

Run: `python manage.py check`
Expected: no issues

```bash
git add backend/core_app/serializers/store_serializers.py backend/core_app/admin.py
git commit -m "feat(store): store serializers + django admin registration"
```

---

### Task 6: Views — catalog, redemption, trainer CRUD + review

**Files:**
- Create: `backend/core_app/views/store_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_store_views.py`

**Interfaces:**
- Produces:
  - `StoreItemViewSet` (ModelViewSet, IsTrainerRole) at `trainer/store-items`.
  - `GET /api/store/items/` → `{items: [...], balance, pending_balance}`.
  - `POST /api/store/redemptions/` `{item_id}` → 201 redemption or 400 (funds/inactive); `GET /api/store/redemptions/` → own list.
  - `GET /api/trainer/store/redemptions/` → pending of assigned clients; `POST /api/trainer/store/redemptions/<pk>/review/` `{decision, note?}`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_store_views.py
import pytest

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    u = User.objects.create_user(email='t@example.com', password='x', first_name='T', last_name='R', role=User.Role.TRAINER)
    TrainerProfile.objects.get_or_create(user=u)
    return u


@pytest.fixture
def assigned_customer(existing_user, trainer_user):
    existing_user.assigned_trainer = trainer_user.trainer_profile
    existing_user.save(update_fields=['assigned_trainer'])
    return existing_user


@pytest.mark.django_db
def test_catalog_lists_active_items_with_balance(api_client, existing_user):
    StoreItem.objects.create(name='Activo', price_credits=50, item_type='producto', is_active=True)
    StoreItem.objects.create(name='Inactivo', price_credits=50, item_type='producto', is_active=False)
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/store/items/')
    assert resp.status_code == 200
    data = resp.json()
    assert len(data['items']) == 1
    assert data['balance'] == 100


@pytest.mark.django_db
def test_redeem_spends_and_creates_request(api_client, existing_user):
    item = StoreItem.objects.create(name='Camiseta', price_credits=60, item_type='producto')
    credit_engine.award(existing_user, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/store/redemptions/', {'item_id': item.id}, format='json')
    assert resp.status_code == 201
    assert credit_engine.get_wallet(existing_user).balance == 40
    assert RedemptionRequest.objects.filter(customer=existing_user, item=item, status='pending').exists()


@pytest.mark.django_db
def test_redeem_insufficient_funds_400(api_client, existing_user):
    item = StoreItem.objects.create(name='Caro', price_credits=500, item_type='producto')
    credit_engine.award(existing_user, CreditTransaction.Action.CHECKIN, 'seed', '1', 'x', amount=10)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/store/redemptions/', {'item_id': item.id}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_trainer_fulfills_redemption(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='X', price_credits=30, item_type='servicio')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=30)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'fulfill'}, format='json')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'fulfilled'


@pytest.mark.django_db
def test_trainer_rejects_redemption_refunds(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='Y', price_credits=30, item_type='servicio')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    credit_engine.spend(assigned_customer, 30, 'redemption_request', '99', 'Canje Y')
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=30)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'reject', 'note': 'no hay'}, format='json')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'rejected'
    assert credit_engine.get_wallet(assigned_customer).balance == 100
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/views/test_store_views.py --no-cov -q`
Expected: FAIL — 404 (routes missing)

- [ ] **Step 3: Implement the views**

```python
# backend/core_app/views/store_views.py
from django.db import transaction
from django.db.models import Sum
from django.utils import timezone
from rest_framework import status, viewsets
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import TrainerMessage
from core_app.models.credit import CreditTransaction
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.permissions import IsTrainerRole, is_admin_user
from core_app.serializers.store_serializers import StoreItemSerializer, RedemptionRequestSerializer
from core_app.services import credit_engine


class StoreItemViewSet(viewsets.ModelViewSet):
    """Trainer/admin CRUD of the (global) catalog."""
    serializer_class = StoreItemSerializer
    permission_classes = [IsTrainerRole]

    def get_queryset(self):
        return StoreItem.objects.all()


class StoreCatalogView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        items = StoreItem.objects.filter(is_active=True)
        wallet = credit_engine.get_wallet(request.user)
        pending = (
            CreditTransaction.objects.filter(customer=request.user, status=CreditTransaction.Status.PENDING)
            .aggregate(total=Sum('amount'))['total'] or 0
        )
        return Response({
            'items': StoreItemSerializer(items, many=True, context={'request': request}).data,
            'balance': wallet.balance,
            'pending_balance': pending,
        })


class RedemptionView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = RedemptionRequest.objects.filter(customer=request.user).select_related('item')
        return Response(RedemptionRequestSerializer(qs, many=True, context={'request': request}).data)

    def post(self, request):
        item_id = request.data.get('item_id')
        item = StoreItem.objects.filter(pk=item_id, is_active=True).first()
        if item is None:
            return Response({'detail': 'Ítem no disponible.'}, status=status.HTTP_400_BAD_REQUEST)
        with transaction.atomic():
            req = RedemptionRequest.objects.create(
                customer=request.user, item=item, credits_spent=item.price_credits,
            )
            tx = credit_engine.spend(
                request.user, item.price_credits, 'redemption_request', req.pk,
                f'Canje: {item.name}',
            )
            if tx is None:
                transaction.set_rollback(True)
                return Response({'detail': 'No tienes créditos suficientes para este canje.'}, status=status.HTTP_400_BAD_REQUEST)
        return Response(RedemptionRequestSerializer(req, context={'request': request}).data, status=status.HTTP_201_CREATED)


def _notify(customer, trainer_profile, message, ref_id):
    TrainerMessage.objects.create(
        customer=customer, trainer=trainer_profile, trigger_type='manual',
        trigger_ref_id=ref_id, message=message,
    )


class TrainerRedemptionView(APIView):
    permission_classes = [IsTrainerRole]

    def get(self, request):
        qs = RedemptionRequest.objects.filter(status=RedemptionRequest.Status.PENDING).select_related('item', 'customer')
        if not is_admin_user(request.user):
            tp = getattr(request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=tp)
        results = []
        for r in qs:
            row = RedemptionRequestSerializer(r, context={'request': request}).data
            row['customer_email'] = r.customer.email
            row['customer_name'] = f'{r.customer.first_name} {r.customer.last_name}'.strip()
            results.append(row)
        return Response({'count': len(results), 'results': results})


class TrainerRedemptionReviewView(APIView):
    permission_classes = [IsTrainerRole]

    def post(self, request, pk):
        qs = RedemptionRequest.objects.filter(pk=pk).select_related('item', 'customer')
        if not is_admin_user(request.user):
            tp = getattr(request.user, 'trainer_profile', None)
            qs = qs.filter(customer__assigned_trainer=tp)
        req = qs.first()
        if req is None:
            return Response({'detail': 'Solicitud no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        if req.status != RedemptionRequest.Status.PENDING:
            return Response({'detail': 'La solicitud ya fue resuelta.'}, status=status.HTTP_400_BAD_REQUEST)
        trainer_profile = getattr(request.user, 'trainer_profile', None)
        decision = request.data.get('decision')
        if decision == 'fulfill':
            req.status = RedemptionRequest.Status.FULFILLED
            req.trainer_note = request.data.get('note', '')
            req.resolved_by = request.user
            req.resolved_at = timezone.now()
            req.save(update_fields=['status', 'trainer_note', 'resolved_by', 'resolved_at', 'updated_at'])
            _notify(req.customer, trainer_profile, f'Tu canje "{req.item.name}" fue entregado. ¡Disfrútalo!', req.pk)
        elif decision == 'reject':
            credit_engine.refund_redemption(req, request.user, request.data.get('note', ''))
            _notify(req.customer, trainer_profile, f'Tu canje "{req.item.name}" no pudo entregarse; te devolvimos {req.credits_spent} créditos.', req.pk)
        else:
            return Response({'detail': 'decision debe ser fulfill o reject.'}, status=status.HTTP_400_BAD_REQUEST)
        req.refresh_from_db()
        return Response(RedemptionRequestSerializer(req, context={'request': request}).data)
```

Routes in `api_urls.py` — add to the credit views import area and the router/paths:

```python
from core_app.views.store_views import (
    StoreItemViewSet, StoreCatalogView, RedemptionView,
    TrainerRedemptionView, TrainerRedemptionReviewView,
)
```

```python
router.register('trainer/store-items', StoreItemViewSet, basename='store-item')
```

```python
    path('store/items/', StoreCatalogView.as_view(), name='store-items'),
    path('store/redemptions/', RedemptionView.as_view(), name='store-redemptions'),
    path('trainer/store/redemptions/', TrainerRedemptionView.as_view(), name='trainer-store-redemptions'),
    path('trainer/store/redemptions/<int:pk>/review/', TrainerRedemptionReviewView.as_view(), name='trainer-store-redemption-review'),
```

- [ ] **Step 4: Run tests, migrate dev DB, commit**

Run: `pytest core_app/tests/views/test_store_views.py --no-cov -q && python manage.py migrate --noinput`
Expected: 5 passed; migration applied

```bash
git add backend/core_app/views/store_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_store_views.py
git commit -m "feat(store): catalog, redemption and trainer review endpoints"
```

---

### Task 7: `storeStore` (frontend)

**Files:**
- Create: `frontend/lib/stores/storeStore.ts`
- Test: `frontend/app/__tests__/stores/storeStore.test.ts`

**Interfaces:**
- Produces: `useStoreStore` with `{ items, balance, pendingBalance, redemptions, loading, error, fetchCatalog(), redeem(itemId): Promise<boolean>, fetchMyRedemptions(), pendingReviews, fetchPendingReviews(), reviewRedemption(pk, decision, note?): Promise<boolean> }`.
- Types: `StoreItem = { id, name, description, image_url, price_credits, item_type, is_active }`; `Redemption = { id, item, item_name, item_image_url, credits_spent, status, trainer_note, created_at, resolved_at }`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/storeStore.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(), extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

describe('storeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useStoreStore.setState({ items: [], balance: 0, pendingBalance: 0, redemptions: [], pendingReviews: [], loading: false, error: '' });
  });

  it('fetchCatalog stores items and balances', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { items: [{ id: 1, name: 'X', price_credits: 50 }], balance: 100, pending_balance: 15 } });
    await useStoreStore.getState().fetchCatalog();
    const s = useStoreStore.getState();
    expect(s.items).toHaveLength(1);
    expect(s.balance).toBe(100);
    expect(s.pendingBalance).toBe(15);
  });

  it('redeem posts item_id and returns true on success', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 9, status: 'pending' } });
    (api.get as jest.Mock).mockResolvedValue({ data: { items: [], balance: 40, pending_balance: 0 } });
    const ok = await useStoreStore.getState().redeem(1);
    expect(api.post).toHaveBeenCalledWith('/store/redemptions/', { item_id: 1 }, expect.any(Object));
    expect(ok).toBe(true);
  });

  it('redeem returns false and sets error on insufficient funds', async () => {
    (api.post as jest.Mock).mockRejectedValue({ response: { data: { detail: 'No tienes créditos suficientes para este canje.' } } });
    const ok = await useStoreStore.getState().redeem(1);
    expect(ok).toBe(false);
    expect(useStoreStore.getState().error).toBe('No tienes créditos suficientes para este canje.');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/storeStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/stores/storeStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type StoreItem = {
  id: number; name: string; description: string; image_url: string | null;
  price_credits: number; item_type: string; is_active: boolean;
};

export type Redemption = {
  id: number; item: number; item_name: string; item_image_url: string | null;
  credits_spent: number; status: 'pending' | 'fulfilled' | 'rejected';
  trainer_note: string; created_at: string; resolved_at: string | null;
};

type StoreState = {
  items: StoreItem[];
  balance: number;
  pendingBalance: number;
  redemptions: Redemption[];
  pendingReviews: (Redemption & { customer_email?: string; customer_name?: string })[];
  loading: boolean;
  error: string;
  fetchCatalog: () => Promise<void>;
  redeem: (itemId: number) => Promise<boolean>;
  fetchMyRedemptions: () => Promise<void>;
  fetchPendingReviews: () => Promise<void>;
  reviewRedemption: (pk: number, decision: 'fulfill' | 'reject', note?: string) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useStoreStore = create<StoreState>((set, get) => ({
  items: [], balance: 0, pendingBalance: 0, redemptions: [], pendingReviews: [], loading: false, error: '',

  fetchCatalog: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/store/items/', { headers: authHeaders() });
      set({ items: data.items ?? [], balance: data.balance ?? 0, pendingBalance: data.pending_balance ?? 0, loading: false });
    } catch {
      set({ error: 'No se pudo cargar la tienda.', loading: false });
    }
  },

  redeem: async (itemId) => {
    set({ error: '' });
    try {
      await api.post('/store/redemptions/', { item_id: itemId }, { headers: authHeaders() });
      await get().fetchCatalog();
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo realizar el canje.') });
      return false;
    }
  },

  fetchMyRedemptions: async () => {
    try {
      const { data } = await api.get('/store/redemptions/', { headers: authHeaders() });
      set({ redemptions: Array.isArray(data) ? data : data.results ?? [] });
    } catch {
      set({ error: 'No se pudo cargar tus canjes.' });
    }
  },

  fetchPendingReviews: async () => {
    try {
      const { data } = await api.get('/trainer/store/redemptions/', { headers: authHeaders() });
      set({ pendingReviews: data.results ?? [] });
    } catch {
      set({ error: 'No se pudieron cargar las solicitudes.' });
    }
  },

  reviewRedemption: async (pk, decision, note) => {
    try {
      await api.post(`/trainer/store/redemptions/${pk}/review/`, { decision, note }, { headers: authHeaders() });
      set((s) => ({ pendingReviews: s.pendingReviews.filter((r) => r.id !== pk) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo procesar la solicitud.') });
      return false;
    }
  },
}));
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/stores/storeStore.test.ts`
Expected: 3 passed

```bash
git add frontend/lib/stores/storeStore.ts frontend/app/__tests__/stores/storeStore.test.ts
git commit -m "feat(store): storeStore for catalog, redemptions and trainer reviews"
```

---

### Task 8: Client `/tienda` page

**Files:**
- Create: `frontend/app/(app)/tienda/page.tsx`
- Test: covered by E2E (Task 12)

**Interfaces:**
- Consumes: `useStoreStore`.

- [ ] **Step 1: Implement the page**

```tsx
// frontend/app/(app)/tienda/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { Sparkles } from 'lucide-react';
import { useStoreStore, type StoreItem } from '@/lib/stores/storeStore';

function ItemCard({ item, balance, onRedeem }: { item: StoreItem; balance: number; onRedeem: (item: StoreItem) => void }) {
  const affordable = balance >= item.price_credits;
  return (
    <div className="bg-white rounded-2xl border border-kore-gray-light/40 shadow-sm overflow-hidden flex flex-col" data-testid="store-item">
      <div className="aspect-[4/3] bg-kore-cream relative">
        {item.image_url && (
          <Image src={item.image_url} alt={item.name} fill className="object-cover" unoptimized />
        )}
      </div>
      <div className="p-4 flex flex-col flex-1">
        <p className="text-[14px] font-semibold text-kore-gray-dark">{item.name}</p>
        {item.description && <p className="text-[12px] text-kore-gray-dark/50 mt-1 line-clamp-2 flex-1">{item.description}</p>}
        <div className="flex items-center justify-between mt-3">
          <span className="inline-flex items-center gap-1 text-[13px] font-bold text-kore-gold-deep">
            <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />{item.price_credits}
          </span>
          <button
            type="button"
            disabled={!affordable}
            onClick={() => onRedeem(item)}
            className={`text-[12px] font-semibold px-3 py-1.5 rounded-xl transition-colors ${affordable ? 'bg-kore-red text-white hover:bg-kore-red-dark' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}
          >
            {affordable ? 'Canjear' : 'Sin saldo'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TiendaPage() {
  const { items, balance, loading, error, fetchCatalog, redeem } = useStoreStore();
  const [confirming, setConfirming] = useState<StoreItem | null>(null);
  const [busy, setBusy] = useState(false);
  const [okMsg, setOkMsg] = useState('');

  useEffect(() => { fetchCatalog(); }, [fetchCatalog]);

  async function doRedeem() {
    if (!confirming) return;
    setBusy(true);
    const ok = await redeem(confirming.id);
    setBusy(false);
    setConfirming(null);
    if (ok) { setOkMsg('¡Canje solicitado! Tu entrenador lo gestionará.'); setTimeout(() => setOkMsg(''), 4000); }
  }

  return (
    <div className="px-4 py-6 max-w-xl mx-auto space-y-5" data-testid="tienda">
      <div className="flex items-center justify-between">
        <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Tienda</h1>
        <span className="inline-flex items-center gap-1 text-[13px] font-bold text-kore-gold-deep bg-kore-gold/10 px-3 py-1 rounded-full">
          <Sparkles className="w-3.5 h-3.5" strokeWidth={2} />{balance} disponibles
        </span>
      </div>

      {okMsg && <p className="text-[13px] text-kore-sage-deep bg-kore-sage/15 rounded-xl px-3 py-2">{okMsg}</p>}
      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-kore-gray-dark/40">Cargando…</p>
      ) : items.length === 0 ? (
        <p className="text-[13px] text-kore-gray-dark/40 py-8 text-center">Aún no hay productos en la tienda.</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {items.map((it) => <ItemCard key={it.id} item={it} balance={balance} onRedeem={setConfirming} />)}
        </div>
      )}

      {confirming && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(45,15,26,0.45)' }}>
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full text-center">
            <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mb-1">¿Canjear {confirming.name}?</p>
            <p className="text-[13px] text-kore-gray-dark/60 mb-5">Se descontarán <b>{confirming.price_credits} créditos</b> de tu saldo.</p>
            <div className="flex flex-col gap-2.5">
              <button type="button" disabled={busy} onClick={doRedeem} className="w-full py-3 rounded-2xl bg-kore-red text-white text-[14px] font-semibold hover:bg-kore-red-dark transition-colors disabled:opacity-60">
                {busy ? 'Canjeando…' : 'Confirmar canje'}
              </button>
              <button type="button" disabled={busy} onClick={() => setConfirming(null)} className="w-full py-2.5 text-[13px] text-kore-gray-dark/60">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

Note: `next/image` with a remote `image_url` needs `unoptimized` (static export has no image optimizer) — already set.

- [ ] **Step 2: Typecheck + verify**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. Open `http://192.168.56.10:3000/tienda` as `customer1` (seed an item via admin or shell first).

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/tienda/page.tsx"
git commit -m "feat(store): client tienda page — catalog grid, redeem with confirm"
```

---

### Task 9: `/mis-creditos` balance split + Mis canjes

**Files:**
- Modify: `frontend/app/(app)/mis-creditos/page.tsx`
- Test: covered by E2E (Task 12)

**Interfaces:**
- Consumes: `useWalletStore` (balance, pending_balance), `useStoreStore` (redemptions, fetchMyRedemptions).

- [ ] **Step 1: Split the balance card**

In `mis-creditos/page.tsx`, replace the single balance number block with a two-figure split. Find the balance card `<div>` and change its body to:

```tsx
        <p className="text-[11px] uppercase tracking-[0.16em] font-semibold" style={{ color: '#E7C8A0' }}>Balance</p>
        <div className="flex items-stretch justify-center gap-6 mt-3">
          <div>
            <p className="font-heading font-black tabular-nums leading-none" style={{ color: '#FFF8EC', fontSize: 'clamp(36px, 11vw, 52px)' }}>
              {walletLoaded && wallet ? wallet.balance : '—'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#FFE9DC', opacity: 0.75 }}>Disponibles</p>
          </div>
          <div className="w-px self-stretch" style={{ background: 'rgba(231,200,160,0.25)' }} />
          <div>
            <p className="font-heading font-black tabular-nums leading-none" style={{ color: '#E7C8A0', fontSize: 'clamp(36px, 11vw, 52px)' }}>
              {wallet ? wallet.pending_balance : '—'}
            </p>
            <p className="text-[11px] mt-1" style={{ color: '#FFE9DC', opacity: 0.6 }}>Por aprobar</p>
          </div>
        </div>
        <p className="text-[11px] mt-3" style={{ color: '#FFE9DC', opacity: 0.55 }}>
          Solo puedes canjear con los créditos disponibles.
        </p>
```

(Remove the old single balance `<p>` and the pending chip — they are replaced by this split.)

- [ ] **Step 2: Add the "Mis canjes" section**

Add imports at the top: `import { useStoreStore } from '@/lib/stores/storeStore';`. Inside the component add:

```tsx
  const { redemptions, fetchMyRedemptions } = useStoreStore();
  useEffect(() => { fetchMyRedemptions(); }, [fetchMyRedemptions]);
```

Before the history card, add:

```tsx
      {redemptions.length > 0 && (
        <div className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-1 px-1">Mis canjes</p>
          <div className="divide-y divide-kore-gray-light/40">
            {redemptions.map((r) => {
              const tone = r.status === 'fulfilled' ? 'bg-kore-sage/20 text-kore-sage-deep'
                : r.status === 'rejected' ? 'bg-red-100 text-red-600' : 'bg-amber-100 text-amber-600';
              const label = r.status === 'fulfilled' ? 'Entregado' : r.status === 'rejected' ? 'Rechazado' : 'Pendiente';
              return (
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-kore-gray-dark truncate">{r.item_name}</p>
                    <p className="text-[11px] text-kore-gray-dark/40">{new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {r.credits_spent} créditos</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
```

- [ ] **Step 3: Typecheck, verify, commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

```bash
git add "frontend/app/(app)/mis-creditos/page.tsx"
git commit -m "feat(store): mis-creditos balance split (disponibles/por aprobar) + Mis canjes"
```

---

### Task 10: Trainer `/trainer/tienda` management page

**Files:**
- Create: `frontend/app/(app)/trainer/tienda/page.tsx`
- Test: covered by E2E (Task 12)

**Interfaces:**
- Consumes: `useStoreStore` (items catalog CRUD via direct api calls for create/edit; pendingReviews + reviewRedemption). For the catalog CRUD the page calls `api` directly (trainer/store-items) — add minimal actions inline.

- [ ] **Step 1: Implement the page** (catalog list + create form + redemptions inbox)

```tsx
// frontend/app/(app)/trainer/tienda/page.tsx
'use client';

import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AdminItem = { id: number; name: string; price_credits: number; item_type: string; is_active: boolean };

export default function TrainerTiendaPage() {
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('servicio');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function loadItems() {
    const { data } = await api.get('/trainer/store-items/', { headers: authHeaders() });
    setItems(Array.isArray(data) ? data : data.results ?? []);
  }
  useEffect(() => { loadItems(); fetchPendingReviews(); }, [fetchPendingReviews]);

  async function createItem() {
    setError('');
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) { setError('Nombre y precio (>0) son obligatorios.'); return; }
    setSaving(true);
    try {
      await api.post('/trainer/store-items/', { name, price_credits: p, item_type: type }, { headers: authHeaders() });
      setName(''); setPrice(''); setType('servicio');
      await loadItems();
    } catch {
      setError('No se pudo crear el ítem.');
    } finally { setSaving(false); }
  }

  async function toggleActive(it: AdminItem) {
    await api.patch(`/trainer/store-items/${it.id}/`, { is_active: !it.is_active }, { headers: authHeaders() });
    await loadItems();
  }

  return (
    <div className="px-5 xl:px-10 pt-20 pb-16 space-y-6" data-testid="trainer-tienda">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Tienda</h1>

      {/* Redemptions inbox */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-3">Solicitudes de canje</p>
        {pendingReviews.length === 0 ? (
          <p className="text-[13px] text-kore-gray-dark/40">Sin solicitudes pendientes.</p>
        ) : (
          <div className="space-y-2">
            {pendingReviews.map((r) => (
              <div key={r.id} className="flex items-center gap-3 py-2 border-b border-kore-gray-light/30 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{r.item_name}</p>
                  <p className="text-[11px] text-kore-gray-dark/45">{r.customer_name} · {r.credits_spent} créditos</p>
                </div>
                <button onClick={() => reviewRedemption(r.id, 'fulfill')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep">Entregar</button>
                <button onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Rechazar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Catalog management */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">Catálogo</p>
        {error && <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex flex-wrap gap-2 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[140px] rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio" type="number" className="w-24 rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]">
            <option value="servicio">Servicio</option>
            <option value="producto">Producto</option>
            <option value="sesion_adicional">Sesión adicional</option>
            <option value="descuento">Descuento</option>
          </select>
          <button onClick={createItem} disabled={saving} className="rounded-xl bg-kore-red text-white px-4 py-2 text-[13px] font-medium disabled:opacity-60">
            {saving ? 'Guardando…' : 'Agregar'}
          </button>
        </div>
        <div className="divide-y divide-kore-gray-light/40">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{it.name}</p>
                <p className="text-[11px] text-kore-gray-dark/45">{it.price_credits} créditos · {it.item_type}</p>
              </div>
              <button onClick={() => toggleActive(it)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${it.is_active ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}>
                {it.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
```

Note: image upload for items is done from Django admin (registered in Task 5) for this part — the trainer create form ships name/price/type; image management via admin keeps the UI slice small. (A future iteration can add multipart upload here.)

- [ ] **Step 2: Typecheck, verify, commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. Verify as `german.franco@kore.com` at `/trainer/tienda`.

```bash
git add "frontend/app/(app)/trainer/tienda/page.tsx"
git commit -m "feat(store): trainer tienda page — redemptions inbox + catalog management"
```

---

### Task 11: Navigation links

**Files:**
- Modify: `frontend/app/components/layouts/Sidebar.tsx`, `MobileBottomNav.tsx`, and the trainer sidebar (`frontend/app/components/layouts/TrainerSidebar.tsx` if present — else the trainer nav source).

**Interfaces:**
- Produces: "Tienda" link for clients (→ `/tienda`) in sidebar + bottom-nav "Más"; "Tienda" link for the trainer (→ `/trainer/tienda`).

- [ ] **Step 1: Client links** — in `Sidebar.tsx`, add a `StoreIcon` (inline SVG) and an item in the Cuenta group before "Mis créditos":

```tsx
  const StoreIcon = (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="w-5 h-5">
      <path d="M3 9l1-5h16l1 5M4 9v10a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V9M4 9h16M9 13h6" />
    </svg>
  );
```

```tsx
        { key: 'store', label: 'Tienda', href: '/tienda', icon: StoreIcon },
        { key: 'credits', label: 'Mis créditos', href: '/mis-creditos', icon: CreditsIcon },
```

In `MobileBottomNav.tsx`, add a `moreItems` entry `{ key: 'store', label: 'Tienda', icon: StoreIcon, href: '/tienda' }` (define the same inline `StoreIcon`).

- [ ] **Step 2: Trainer link** — locate the trainer nav (grep `TrainerSidebar` or the trainer layout nav array). Add `{ ..., label: 'Tienda', href: '/trainer/tienda' }` following that file's item shape and icon convention.

- [ ] **Step 3: Typecheck, commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean

```bash
git add frontend/app/components/layouts/
git commit -m "feat(store): tienda nav links for client and trainer"
```

---

### Task 12: E2E + flow triplet + guides

**Files:**
- Create: `frontend/e2e/app/tienda.spec.ts`, `frontend/e2e/trainer/trainer-tienda.spec.ts`
- Modify: `frontend/e2e/app/mis-creditos.spec.ts`, `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`, `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Client tienda spec**

```typescript
// frontend/e2e/app/tienda.spec.ts
import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const CATALOG = {
  items: [
    { id: 1, name: 'Camiseta KÓRE', description: 'Algodón premium', image_url: null, price_credits: 50, item_type: 'producto', is_active: true },
    { id: 2, name: 'Sesión extra', description: '', image_url: null, price_credits: 500, item_type: 'sesion_adicional', is_active: true },
  ],
  balance: 100, pending_balance: 15,
};

test.describe('Tienda', { tag: [...FlowTags.CUSTOMER_STORE, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/store/items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CATALOG) }));
  });

  test('shows catalog with balance and affordability', async ({ page }) => {
    await page.goto('/tienda');
    await expect(page.getByTestId('tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('100 disponibles')).toBeVisible();
    await expect(page.getByText('Camiseta KÓRE')).toBeVisible();
    // affordable → "Canjear"; too expensive → "Sin saldo"
    await expect(page.getByRole('button', { name: 'Canjear' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Sin saldo' })).toBeVisible();
  });

  test('redeems an affordable item via the confirm dialog', async ({ page }) => {
    await page.route('**/api/store/redemptions/', (r) => {
      if (r.request().method() === 'POST') return r.fulfill({ status: 201, contentType: 'application/json', body: JSON.stringify({ id: 9, status: 'pending' }) });
      return r.fallback();
    });
    await page.goto('/tienda');
    await page.getByRole('button', { name: 'Canjear' }).first().click();
    await expect(page.getByText(/¿Canjear Camiseta KÓRE\?/)).toBeVisible();
    await page.getByRole('button', { name: 'Confirmar canje' }).click();
    await expect(page.getByText(/¡Canje solicitado!/)).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Trainer tienda spec**

```typescript
// frontend/e2e/trainer/trainer-tienda.spec.ts
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Trainer — tienda', { tag: [...FlowTags.TRAINER_STORE_MANAGEMENT, RoleTags.TRAINER] }, () => {
  test.beforeEach(async ({ context }) => { await injectTrainerAuthCookies(context); });

  test('shows pending redemptions and the catalog manager', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([{ id: 1, name: 'Camiseta', price_credits: 50, item_type: 'producto', is_active: true }]) }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, results: [{ id: 7, item_name: 'Camiseta', credits_spent: 50, status: 'pending', customer_name: 'Ana Ruiz' }] }) }));
    await page.goto('/trainer/tienda');
    await expect(page.getByTestId('trainer-tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Camiseta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
  });

  test('fulfills a redemption', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 1, results: [{ id: 7, item_name: 'Camiseta', credits_spent: 50, status: 'pending', customer_name: 'Ana Ruiz' }] }) }));
    await page.route('**/api/trainer/store/redemptions/7/review/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 7, status: 'fulfilled' }) }));
    await page.goto('/trainer/tienda');
    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('Sin solicitudes pendientes.')).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 3: mis-creditos spec** — add wallet `pending_balance` assertion and a redemptions route mock:

```typescript
  test('shows the balance split (disponibles / por aprobar)', async ({ page }) => {
    await page.route('**/api/store/redemptions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.goto('/mis-creditos');
    await expect(page.getByText('Disponibles')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Por aprobar')).toBeVisible();
  });
```

Add `**/api/store/redemptions/**` route to the existing `beforeEach` too (so the page's fetch doesn't hit the proxy).

- [ ] **Step 4: Flow triplet** — `flow-definitions.json` version `1.1.0`, add `customer-store` (module `app`, P2) and `trainer-store-management` (module `trainer`, P2). `flow-tags.ts`: `CUSTOMER_STORE` and `TRAINER_STORE_MANAGEMENT`. `USER_FLOW_MAP.md`: entries for both (routes `/tienda` and `/trainer/tienda`, steps as implemented). Tag the new specs accordingly.

- [ ] **Step 5: Guides** — `GUIA_DE_VALIDACION.md` gains a "Parte 4" section (5-block format: catálogo, canjear, ver estado en Mis créditos; y del lado trainer, gestionar catálogo y entregar/rechazar). `GUIA_QA_STAGING.md` gains store seed records (create 3-4 `StoreItem` rows) and the store test routes.

- [ ] **Step 6: Run specs serialized, commit**

Run: `./node_modules/.bin/playwright test e2e/app/tienda.spec.ts e2e/app/mis-creditos.spec.ts --workers=1` and `./node_modules/.bin/playwright test e2e/trainer/trainer-tienda.spec.ts --workers=1`
Expected: PASS (CI re-verifies)

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md docs/release-july/
git commit -m "test(store): e2e for tienda, trainer management, mis-creditos split + flows"
```

---

### Task 13: Wrap-up — audit, push, PR

- [ ] **Step 1**: invoke `e2e-user-flows-check` for the touched/new flows (`customer-store`, `trainer-store-management`, `customer-credits`); close any P1/P2 gap.
- [ ] **Step 2**: `cd backend && source venv/bin/activate && python manage.py check && python manage.py makemigrations core_app --check --dry-run` (no pending) and `cd frontend && npx tsc --noEmit` (clean).
- [ ] **Step 3**: `git push -u origin feat/03072026-phase4-credit-store`, create the PR to base `july-release` titled `feat(store): Phase 2 Part 4 — internal credit store`, summarizing models, engine (spend/apply_penalty/refund, floor-at-0 with the Part 1 penalty behavior change noted), client tienda + mis-creditos split, trainer management, guides. CI runs everything. Report the PR URL.
