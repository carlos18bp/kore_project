# Part 8 — Buy Nutrition (plan upgrade) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Gate nutrition behind payment; let a client add nutrition to their current plan for a prorated one-time Wompi charge, then bill training + nutrition as one combined recurring payment.

**Architecture:** `Subscription.includes_nutrition` is the access flag (copied from `Package.includes_nutrition` on purchase). A `NutritionUpgrade` one-time Wompi purchase (Part 7 pattern) flips the flag mid-cycle for a prorated amount; the recurring billing task adds an admin-set `NutritionProduct` monthly price when the flag is on. Client nutrition routes are gated by a `HasNutritionAccess` permission.

**Tech Stack:** Django 6 + DRF, Wompi (Web Checkout + webhook), Next.js 16 App Router, Zustand 5, Jest, Playwright.

## Global Constraints

- Branch: `feat/07072026-phase8-buy-packs` (based on `july-release`, includes Parts 4–7). PR targets `july-release`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Django module `core_project`, single app `core_app`. Don't edit old migrations; last is `0064`. New = `0065`.
- Paywall is **retroactive**: `includes_nutrition` defaults `False` on existing subscriptions.
- Nutrition is **monthly/recurring**; the upgrade charge is **prorated** by `days_remaining / validity_days`.
- Nutrition references are prefixed `NU-`; the webhook routes by looking up `NutritionUpgrade` by reference. Subscription and credit-purchase paths stay unchanged.
- Reuse `wompi_service.generate_reference` / `generate_integrity_signature`; add a shared `build_wompi_checkout_url` helper. Config: `settings.WOMPI_PUBLIC_KEY`, `settings.FRONTEND_BASE_URL`.
- `(app)` page containers use the dashboard padding pattern (`px-5 xl:px-10 pt-20`), never `max-w-*`.
- Backend pytest and store-only Jest run locally; component/E2E verified by CI. Spanish user-facing strings.

---

### Task 1: Access flags + copy on purchase

**Files:**
- Modify: `backend/core_app/models/subscription.py`, `backend/core_app/models/package.py`, `backend/core_app/views/wompi_views.py:373` (subscription create), `backend/core_app/services/admin_subscription_service.py:68` (subscription create)
- Create (makemigrations): `backend/core_app/migrations/0065_buy_nutrition.py` (this task adds the two flags; later tasks' models fold into the same migration if generated together — regenerate as needed)
- Test: `backend/core_app/tests/services/test_nutrition_access.py`

**Interfaces:**
- Produces: `Subscription.includes_nutrition` (bool), `Package.includes_nutrition` (bool); both purchase paths copy the package flag onto the subscription.

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/services/test_nutrition_access.py`:

```python
import pytest
from django.utils import timezone
from datetime import timedelta

from core_app.models import Package, Subscription, User
from core_app.services.admin_subscription_service import create_subscription_for_admin
from core_app.models.payment import Payment


@pytest.mark.django_db
def test_admin_purchase_copies_nutrition_flag():
    u = User.objects.create_user(email='n@example.com', password='x', first_name='N', last_name='U')
    pkg = Package.objects.create(title='Bundle', sessions_count=4, price=100000, includes_nutrition=True)
    now = timezone.now()
    sub = create_subscription_for_admin(
        customer=u, package=pkg, payment_method=Payment.Provider.CASH,
        starts_at=now, expires_at=now + timedelta(days=30), sessions_used=0,
    )
    assert sub.includes_nutrition is True


@pytest.mark.django_db
def test_subscription_flag_defaults_false():
    u = User.objects.create_user(email='n2@example.com', password='x', first_name='N', last_name='U')
    pkg = Package.objects.create(title='Solo', sessions_count=4, price=100000)
    sub = Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30))
    assert sub.includes_nutrition is False
    assert pkg.includes_nutrition is False
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_nutrition_access.py -q`
Expected: FAIL — `includes_nutrition` not a field.

- [ ] **Step 3: Add the fields** — in `backend/core_app/models/subscription.py`, add after `sessions_used`:

```python
    includes_nutrition = models.BooleanField(default=False, db_index=True)
```

In `backend/core_app/models/package.py`, add after `is_active`:

```python
    includes_nutrition = models.BooleanField(default=False)
```

- [ ] **Step 4: Copy the flag on purchase.** In `backend/core_app/views/wompi_views.py`, the `Subscription.objects.create(` at ~line 373 — add the field:

```python
                    is_recurring=is_recurring,
                    wompi_transaction_id=locked_intent.wompi_transaction_id,
                    next_billing_date=next_billing_date,
                    includes_nutrition=package.includes_nutrition,
```

In `backend/core_app/services/admin_subscription_service.py`, the `Subscription.objects.create(` at ~line 68 — add:

```python
        is_recurring=False,
        payment_method_type='',
        includes_nutrition=package.includes_nutrition,
```

- [ ] **Step 5: Make the migration + run tests**

Run: `python manage.py makemigrations core_app -n buy_nutrition && python manage.py migrate`
Expected: creates `0065_buy_nutrition.py` (add both flags). Migrates clean.

Run: `pytest core_app/tests/services/test_nutrition_access.py -q`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/models/subscription.py backend/core_app/models/package.py backend/core_app/views/wompi_views.py backend/core_app/services/admin_subscription_service.py backend/core_app/migrations/0065_buy_nutrition.py backend/core_app/tests/services/test_nutrition_access.py
git commit -m "feat(nutrition): includes_nutrition flag on Subscription/Package, copied on purchase

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: `NutritionProduct` + `NutritionUpgrade` models + access service

**Files:**
- Create: `backend/core_app/models/nutrition_product.py`, `backend/core_app/models/nutrition_upgrade.py`, `backend/core_app/services/nutrition_access.py`
- Modify: `backend/core_app/models/__init__.py`, `backend/core_app/migrations/0065_buy_nutrition.py` (regenerate to include the new models — run makemigrations again after adding them)
- Test: `backend/core_app/tests/services/test_nutrition_access.py` (append)

**Interfaces:**
- Produces: `NutritionProduct(name, price_cop, is_active)`; `NutritionUpgrade(customer, subscription, amount_cop, reference, wompi_transaction_id, status)`; `nutrition_access.has_nutrition_access(user) -> bool`; `nutrition_access.active_nutrition_price() -> int | None`.

- [ ] **Step 1: Write the failing test** — append to `backend/core_app/tests/services/test_nutrition_access.py`:

```python
from core_app.models.nutrition_product import NutritionProduct
from core_app.services.nutrition_access import has_nutrition_access, active_nutrition_price


@pytest.mark.django_db
def test_has_nutrition_access():
    u = User.objects.create_user(email='a@example.com', password='x', first_name='A', last_name='B')
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=True)
    assert has_nutrition_access(u) is True


@pytest.mark.django_db
def test_no_access_without_flag():
    u = User.objects.create_user(email='a2@example.com', password='x', first_name='A', last_name='B')
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=False)
    assert has_nutrition_access(u) is False


@pytest.mark.django_db
def test_active_nutrition_price():
    assert active_nutrition_price() is None
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert active_nutrition_price() == 30000
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/services/test_nutrition_access.py -q`
Expected: FAIL — modules missing.

- [ ] **Step 3: Create the models** — `backend/core_app/models/nutrition_product.py`:

```python
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionProduct(TimestampedModel):
    """Admin-configured monthly price for the nutrition add-on (single active row)."""

    name = models.CharField(max_length=120, default='Nutrición')
    price_cop = models.PositiveIntegerField(help_text='Monthly price in whole COP.')
    is_active = models.BooleanField(default=True, db_index=True)

    def __str__(self):
        return f'{self.name} — {self.price_cop} COP/mes'
```

`backend/core_app/models/nutrition_upgrade.py`:

```python
from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionUpgrade(TimestampedModel):
    """A one-time, prorated Wompi charge that adds nutrition to a subscription."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        DECLINED = 'declined', 'Declined'

    customer = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='nutrition_upgrades')
    subscription = models.ForeignKey('core_app.Subscription', on_delete=models.PROTECT, related_name='nutrition_upgrades')
    amount_cop = models.PositiveIntegerField()
    reference = models.CharField(max_length=64, unique=True, db_index=True)
    wompi_transaction_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.customer} — nutrición ({self.status})'
```

- [ ] **Step 4: Access service** — `backend/core_app/services/nutrition_access.py`:

```python
def has_nutrition_access(user) -> bool:
    if not user or not getattr(user, 'is_authenticated', False):
        return False
    from core_app.models import Subscription
    return Subscription.objects.filter(
        customer=user, status=Subscription.Status.ACTIVE, includes_nutrition=True,
    ).exists()


def active_nutrition_price():
    from core_app.models.nutrition_product import NutritionProduct
    product = NutritionProduct.objects.filter(is_active=True).first()
    return product.price_cop if product else None
```

- [ ] **Step 5: Register models + regenerate migration** — in `backend/core_app/models/__init__.py`, add imports + `__all__` entries for `NutritionProduct`, `NutritionUpgrade`. Then:

Run: `python manage.py makemigrations core_app && python manage.py migrate`
Expected: extends the pending migration (or adds `0066_*`) with `NutritionProduct` + `NutritionUpgrade`; migrates clean.

Run: `pytest core_app/tests/services/test_nutrition_access.py -q`
Expected: 5 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/models/ backend/core_app/services/nutrition_access.py backend/core_app/migrations/
git commit -m "feat(nutrition): NutritionProduct + NutritionUpgrade models + access service

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Shared checkout helper + upgrade/access endpoints

**Files:**
- Modify: `backend/core_app/services/wompi_service.py` (add `build_wompi_checkout_url`)
- Create: `backend/core_app/views/nutrition_upgrade_views.py`, `backend/core_app/serializers/nutrition_upgrade_serializers.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_nutrition_upgrade_views.py`

**Interfaces:**
- Consumes: `NutritionUpgrade`, `active_nutrition_price`, `has_nutrition_access`.
- Produces: `build_wompi_checkout_url(reference, amount_in_cents, redirect_path) -> str`; `GET /api/nutrition/access/` → `{has_nutrition_access, price_cop}`; `POST /api/nutrition/upgrade/` → `{reference, checkout_url, amount_cop}`; `GET /api/nutrition/upgrade/<reference>/` → `{reference, status}`.

- [ ] **Step 1: Write the failing tests** — create `backend/core_app/tests/views/test_nutrition_upgrade_views.py`:

```python
import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription
from core_app.models.nutrition_product import NutritionProduct
from core_app.models.nutrition_upgrade import NutritionUpgrade


@pytest.mark.django_db
def test_access_endpoint_reports_flag(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/nutrition/access/')
    assert resp.status_code == 200
    assert resp.json()['has_nutrition_access'] is False


@pytest.mark.django_db
def test_upgrade_prorates_half_cycle(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    today = timezone.localdate()
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', next_billing_date=today + timedelta(days=15))
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['amount_cop'] == 15000  # 15/30 of 30000
    assert body['reference'].startswith('NU-')
    assert 'checkout.wompi.co' in body['checkout_url']


@pytest.mark.django_db
def test_upgrade_requires_active_subscription(api_client, existing_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_upgrade_rejects_when_already_included(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', includes_nutrition=True, next_billing_date=timezone.localdate() + timedelta(days=15))
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/nutrition/upgrade/', {}, format='json')
    assert resp.status_code == 400
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest core_app/tests/views/test_nutrition_upgrade_views.py -q`
Expected: FAIL — routes 404.

- [ ] **Step 3: Add the shared checkout helper** — in `backend/core_app/services/wompi_service.py`, add:

```python
from urllib.parse import quote
from django.conf import settings


def build_wompi_checkout_url(reference, amount_in_cents, redirect_path):
    """Build a Wompi Web Checkout redirect URL for a one-time payment."""
    signature = generate_integrity_signature(reference, amount_in_cents, 'COP')
    redirect_url = f'{settings.FRONTEND_BASE_URL}{redirect_path}'
    return (
        f'https://checkout.wompi.co/p/?public-key={settings.WOMPI_PUBLIC_KEY}'
        f'&currency=COP&amount-in-cents={amount_in_cents}'
        f'&reference={reference}&signature:integrity={signature}'
        f'&redirect-url={quote(redirect_url, safe="")}'
    )
```

(If `quote`/`settings` are already imported at the top of the module, don't duplicate the imports — place them with the existing imports.)

- [ ] **Step 4: Serializer** — `backend/core_app/serializers/nutrition_upgrade_serializers.py`:

```python
from rest_framework import serializers

from core_app.models.nutrition_upgrade import NutritionUpgrade


class NutritionUpgradeStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionUpgrade
        fields = ('reference', 'status')
```

- [ ] **Step 5: Views** — `backend/core_app/views/nutrition_upgrade_views.py`:

```python
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription
from core_app.models.nutrition_upgrade import NutritionUpgrade
from core_app.serializers.nutrition_upgrade_serializers import NutritionUpgradeStatusSerializer
from core_app.services.nutrition_access import has_nutrition_access, active_nutrition_price
from core_app.services.wompi_service import generate_reference, build_wompi_checkout_url


class NutritionAccessView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response({
            'has_nutrition_access': has_nutrition_access(request.user),
            'price_cop': active_nutrition_price(),
        })


class NutritionUpgradeCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        sub = Subscription.objects.filter(customer=request.user, status=Subscription.Status.ACTIVE).select_related('package').first()
        if sub is None:
            return Response({'detail': 'Necesitas un plan activo para agregar nutrición.'}, status=status.HTTP_400_BAD_REQUEST)
        if sub.includes_nutrition:
            return Response({'detail': 'Tu plan ya incluye nutrición.'}, status=status.HTTP_400_BAD_REQUEST)
        price = active_nutrition_price()
        if price is None:
            return Response({'detail': 'Nutrición no disponible por ahora.'}, status=status.HTTP_400_BAD_REQUEST)
        cycle = sub.package.validity_days or 30
        today = timezone.localdate()
        if sub.next_billing_date:
            days_remaining = (sub.next_billing_date - today).days
        else:
            days_remaining = (sub.expires_at.date() - today).days
        days_remaining = max(1, min(days_remaining, cycle))
        amount_cop = round(price * days_remaining / cycle)
        reference = f'NU-{generate_reference()}'
        NutritionUpgrade.objects.create(customer=request.user, subscription=sub, amount_cop=amount_cop, reference=reference)
        checkout_url = build_wompi_checkout_url(reference, amount_cop * 100, f'/my-nutrition?ref={reference}')
        return Response({'reference': reference, 'checkout_url': checkout_url, 'amount_cop': amount_cop}, status=status.HTTP_201_CREATED)


class NutritionUpgradeStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        upgrade = NutritionUpgrade.objects.filter(reference=reference, customer=request.user).first()
        if upgrade is None:
            return Response({'detail': 'No encontrado.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(NutritionUpgradeStatusSerializer(upgrade).data)
```

- [ ] **Step 6: Routes** — in `backend/core_app/urls/api_urls.py`, add the import and paths (near the other `credits/`/`nutrition` paths):

```python
from core_app.views.nutrition_upgrade_views import (
    NutritionAccessView, NutritionUpgradeCreateView, NutritionUpgradeStatusView,
)
```

```python
    path('nutrition/access/', NutritionAccessView.as_view(), name='nutrition-access'),
    path('nutrition/upgrade/', NutritionUpgradeCreateView.as_view(), name='nutrition-upgrade'),
    path('nutrition/upgrade/<str:reference>/', NutritionUpgradeStatusView.as_view(), name='nutrition-upgrade-status'),
```

- [ ] **Step 7: Run the tests**

Run: `pytest core_app/tests/views/test_nutrition_upgrade_views.py -q`
Expected: 4 passed.

- [ ] **Step 8: Commit**

```bash
git add backend/core_app/services/wompi_service.py backend/core_app/views/nutrition_upgrade_views.py backend/core_app/serializers/nutrition_upgrade_serializers.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_nutrition_upgrade_views.py
git commit -m "feat(nutrition): access + prorated upgrade endpoints (Wompi checkout)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Webhook branch — grant nutrition on approved upgrade

**Files:**
- Modify: `backend/core_app/views/wompi_views.py` (imports + `_handle_transaction_updated` + `_resolve_nutrition_upgrade`)
- Test: `backend/core_app/tests/views/test_wompi_nutrition_upgrade.py`

**Interfaces:**
- Consumes: `NutritionUpgrade`.
- Produces: webhook APPROVED for a `NU-` reference → upgrade `approved` + `subscription.includes_nutrition=True`.

- [ ] **Step 1: Write the failing tests** — create `backend/core_app/tests/views/test_wompi_nutrition_upgrade.py`:

```python
import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription
from core_app.models.nutrition_upgrade import NutritionUpgrade
from core_app.views.wompi_views import _handle_transaction_updated


def _event(reference, txn_id, status='APPROVED'):
    return {'transaction': {'id': txn_id, 'status': status, 'reference': reference}}


def _sub(user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000, validity_days=30)
    return Subscription.objects.create(customer=user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=15), status='active', next_billing_date=timezone.localdate() + timedelta(days=15))


@pytest.mark.django_db
def test_webhook_approved_grants_nutrition(existing_user):
    sub = _sub(existing_user)
    up = NutritionUpgrade.objects.create(customer=existing_user, subscription=sub, amount_cop=15000, reference='NU-1')
    _handle_transaction_updated(_event('NU-1', 'txn-n1'))
    up.refresh_from_db(); sub.refresh_from_db()
    assert up.status == 'approved'
    assert sub.includes_nutrition is True


@pytest.mark.django_db
def test_webhook_declined_does_not_grant(existing_user):
    sub = _sub(existing_user)
    up = NutritionUpgrade.objects.create(customer=existing_user, subscription=sub, amount_cop=15000, reference='NU-2')
    _handle_transaction_updated(_event('NU-2', 'txn-n2', status='DECLINED'))
    up.refresh_from_db(); sub.refresh_from_db()
    assert up.status == 'declined'
    assert sub.includes_nutrition is False
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest core_app/tests/views/test_wompi_nutrition_upgrade.py -q`
Expected: FAIL — flag stays False.

- [ ] **Step 3: Implement** — in `backend/core_app/views/wompi_views.py`, add the import next to the credit-purchase import:

```python
from core_app.models.nutrition_upgrade import NutritionUpgrade
```

Insert the branch in `_handle_transaction_updated`, immediately after the Path 1.5 (CreditPurchase) block and before "Path 2":

```python
    # --- Path 1.6: Resolve a NutritionUpgrade (prorated nutrition add-on) ---
    if txn_reference:
        upgrade = NutritionUpgrade.objects.select_related('subscription').filter(reference=txn_reference).first()
        if upgrade is not None:
            _resolve_nutrition_upgrade(upgrade, txn_id, txn_status)
            return
```

Add the resolver (near `_resolve_credit_purchase`):

```python
def _resolve_nutrition_upgrade(upgrade, txn_id, txn_status):
    """Grant nutrition on APPROVED; mark declined otherwise. Idempotent."""
    if upgrade.status != NutritionUpgrade.Status.PENDING:
        return
    if txn_status == 'APPROVED':
        with db_transaction.atomic():
            upgrade.status = NutritionUpgrade.Status.APPROVED
            upgrade.wompi_transaction_id = txn_id
            upgrade.resolved_at = timezone.now()
            upgrade.save(update_fields=['status', 'wompi_transaction_id', 'resolved_at', 'updated_at'])
            sub = upgrade.subscription
            sub.includes_nutrition = True
            sub.save(update_fields=['includes_nutrition', 'updated_at'])
    elif txn_status in ('DECLINED', 'ERROR', 'VOIDED'):
        upgrade.status = NutritionUpgrade.Status.DECLINED
        upgrade.wompi_transaction_id = txn_id
        upgrade.resolved_at = timezone.now()
        upgrade.save(update_fields=['status', 'wompi_transaction_id', 'resolved_at', 'updated_at'])
```

- [ ] **Step 4: Run the tests + regression**

Run: `pytest core_app/tests/views/test_wompi_nutrition_upgrade.py core_app/tests/views/test_wompi_credit_topup.py -q`
Expected: nutrition tests pass; credit-purchase webhook tests still pass.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/wompi_views.py backend/core_app/tests/views/test_wompi_nutrition_upgrade.py
git commit -m "feat(nutrition): webhook grants nutrition on approved upgrade (idempotent)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Recurring surcharge (combined single charge)

**Files:**
- Modify: `backend/core_app/services/nutrition_access.py` (add `nutrition_surcharge`), `backend/core_app/tasks.py` (`_bill_subscription`), `backend/core_app/services/recurring_renewal.py` (recorded amount)
- Test: `backend/core_app/tests/services/test_nutrition_surcharge.py`

**Interfaces:**
- Consumes: `active_nutrition_price`, `Subscription.includes_nutrition`.
- Produces: `nutrition_surcharge(includes_nutrition) -> int` (whole COP); recurring charge = `package.price + surcharge`.

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/services/test_nutrition_surcharge.py` (test the pure helper directly — no billing side effects):

```python
import pytest

from core_app.models.nutrition_product import NutritionProduct
from core_app.services.nutrition_access import nutrition_surcharge


@pytest.mark.django_db
def test_surcharge_zero_without_flag():
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert nutrition_surcharge(False) == 0


@pytest.mark.django_db
def test_surcharge_equals_price_with_flag():
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert nutrition_surcharge(True) == 30000


@pytest.mark.django_db
def test_surcharge_zero_when_no_product():
    assert nutrition_surcharge(True) == 0
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/services/test_nutrition_surcharge.py -q`
Expected: FAIL — `nutrition_surcharge` not defined.

- [ ] **Step 3: Implement the helper + wire it in.** In `backend/core_app/services/nutrition_access.py`, add:

```python
def nutrition_surcharge(includes_nutrition) -> int:
    """Whole-COP monthly nutrition surcharge to add to a recurring charge."""
    if not includes_nutrition:
        return 0
    return active_nutrition_price() or 0
```

In `backend/core_app/tasks.py` `_bill_subscription`, replace the amount computation:

```python
    package = sub.pending_package or sub.package
    from core_app.services.nutrition_access import nutrition_surcharge
    charge = Decimal(str(package.price)) + Decimal(nutrition_surcharge(sub.includes_nutrition))
    amount_in_cents = int(charge * 100)
```

Then use `charge` (not `package.price`) for the `Payment.objects.create(..., amount=charge, ...)` in the same function (the `amount=package.price` line).

In `backend/core_app/services/recurring_renewal.py`, change the recorded renewal amount to reflect what was charged — replace `'amount': str(package.price)` with `'amount': str(payment.amount)`.

- [ ] **Step 4: Run the tests + regression**

Run: `pytest core_app/tests/services/test_nutrition_surcharge.py -q` (3 passed)
Run: `pytest core_app/tests/ -q -k "recurring or billing" 2>&1 | tail -3`
Expected: existing recurring-billing tests still pass (the combined amount is package.price when no nutrition).

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/services/nutrition_access.py backend/core_app/tasks.py backend/core_app/services/recurring_renewal.py backend/core_app/tests/services/test_nutrition_surcharge.py
git commit -m "feat(nutrition): add nutrition surcharge to the combined recurring charge

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Gate client nutrition routes

**Files:**
- Modify: `backend/core_app/permissions.py` (add `HasNutritionAccess`), `backend/core_app/views/nutrition_views.py`, `backend/core_app/views/nutrition_daily_views.py`, `backend/core_app/views/nutrition_plan_views.py` (client views only)
- Test: `backend/core_app/tests/views/test_nutrition_gate.py`

**Interfaces:**
- Consumes: `has_nutrition_access`.
- Produces: client nutrition routes return `403` without access.

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/views/test_nutrition_gate.py`:

```python
import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import Package, Subscription


@pytest.mark.django_db
def test_my_nutrition_daily_today_locked_without_access(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/my-nutrition-daily/today/')
    assert resp.status_code == 403


@pytest.mark.django_db
def test_my_nutrition_daily_today_open_with_access(api_client, existing_user):
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=existing_user, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=True)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/my-nutrition-daily/today/')
    assert resp.status_code == 200
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/views/test_nutrition_gate.py -q`
Expected: FAIL — first test gets 200 (no gate yet).

- [ ] **Step 3: Add the permission** — in `backend/core_app/permissions.py`, add:

```python
class HasNutritionAccess(BasePermission):
    message = 'Tu plan no incluye nutrición.'

    def has_permission(self, request, view):
        from core_app.services.nutrition_access import has_nutrition_access
        return has_nutrition_access(request.user)
```

- [ ] **Step 4: Apply the gate** — add `HasNutritionAccess` to the `permission_classes` of the **client** nutrition views:
  - `nutrition_views.py`: `ClientNutritionListCreateView`, `ClientNutritionDetailView` → `[IsAuthenticated, HasNutritionAccess]`.
  - `nutrition_daily_views.py`: `TodayNutritionView`, `UpdateMealEntryView`, `MealEntryPhotoView`, `WaterGlassLogCreateView`, `NutritionHistoryView` → `[IsAuthenticated, HasNutritionAccess]`.
  - `nutrition_plan_views.py`: `CustomerNutritionPlanWeekView`, `CustomerNutritionPlanHistoryView` (the `my-nutrition-plan*` client views) → add `HasNutritionAccess`.

Import in each file: `from core_app.permissions import HasNutritionAccess` (append to existing permission imports). Do **not** touch trainer views (`IsTrainerRole` ones).

- [ ] **Step 5: Run the test**

Run: `pytest core_app/tests/views/test_nutrition_gate.py -q`
Expected: 2 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/permissions.py backend/core_app/views/nutrition_views.py backend/core_app/views/nutrition_daily_views.py backend/core_app/views/nutrition_plan_views.py backend/core_app/tests/views/test_nutrition_gate.py
git commit -m "feat(nutrition): gate client nutrition routes behind HasNutritionAccess

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Admin — NutritionProduct + read-only upgrades

**Files:**
- Modify: `backend/core_app/admin.py`

- [ ] **Step 1: Register** — append to `backend/core_app/admin.py`:

```python
from core_app.models.nutrition_product import NutritionProduct
from core_app.models.nutrition_upgrade import NutritionUpgrade


@admin.register(NutritionProduct)
class NutritionProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_cop', 'is_active')
    list_editable = ('price_cop', 'is_active')


@admin.register(NutritionUpgrade)
class NutritionUpgradeAdmin(admin.ModelAdmin):
    list_display = ('reference', 'customer', 'amount_cop', 'status', 'resolved_at')
    list_filter = ('status',)
    search_fields = ('reference', 'customer__email')
    readonly_fields = ('customer', 'subscription', 'amount_cop', 'reference', 'wompi_transaction_id', 'status', 'resolved_at')

    def has_add_permission(self, request):
        return False
```

- [ ] **Step 2: Verify + commit**

Run: `python manage.py check`
Expected: `System check identified no issues`.

```bash
git add backend/core_app/admin.py
git commit -m "feat(nutrition): admin for NutritionProduct (editable) + NutritionUpgrade (read-only)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Frontend — store + locked Mi Nutrición + upgrade CTA

**Files:**
- Create: `frontend/lib/stores/nutritionUpgradeStore.ts`
- Modify: `frontend/app/(app)/my-nutrition/page.tsx` (lock gate + CTA)
- Test: `frontend/app/__tests__/stores/nutritionUpgradeStore.test.ts`

**Interfaces:**
- Consumes: `GET /nutrition/access/`, `POST /nutrition/upgrade/`, `GET /nutrition/upgrade/<ref>/`.
- Produces: `useNutritionUpgradeStore` with `{ access, price, fetchNutritionAccess(), startNutritionUpgrade(), fetchUpgradeStatus(ref) }`.

- [ ] **Step 1: Write the failing store test** — create `frontend/app/__tests__/stores/nutritionUpgradeStore.test.ts`:

```typescript
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({ api: { get: jest.fn(), post: jest.fn() } }));

import { api } from '@/lib/services/http';
import { useNutritionUpgradeStore } from '@/lib/stores/nutritionUpgradeStore';

describe('nutritionUpgradeStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useNutritionUpgradeStore.setState({ access: false, price: null });
  });

  it('fetchNutritionAccess stores access + price', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { has_nutrition_access: true, price_cop: 30000 } });
    await useNutritionUpgradeStore.getState().fetchNutritionAccess();
    expect(useNutritionUpgradeStore.getState().access).toBe(true);
    expect(useNutritionUpgradeStore.getState().price).toBe(30000);
  });

  it('startNutritionUpgrade returns checkout_url', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { reference: 'NU-x', checkout_url: 'https://checkout.wompi.co/p/?x', amount_cop: 15000 } });
    const url = await useNutritionUpgradeStore.getState().startNutritionUpgrade();
    expect(url).toBe('https://checkout.wompi.co/p/?x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/nutritionUpgradeStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store** — `frontend/lib/stores/nutritionUpgradeStore.ts`:

```typescript
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type UpgradeStatus = { reference: string; status: 'pending' | 'approved' | 'declined' };

type State = {
  access: boolean;
  price: number | null;
  loading: boolean;
  fetchNutritionAccess: () => Promise<void>;
  startNutritionUpgrade: () => Promise<string | null>;
  fetchUpgradeStatus: (reference: string) => Promise<UpgradeStatus | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useNutritionUpgradeStore = create<State>((set) => ({
  access: false, price: null, loading: false,

  fetchNutritionAccess: async () => {
    set({ loading: true });
    try {
      const { data } = await api.get<{ has_nutrition_access: boolean; price_cop: number | null }>('/nutrition/access/', { headers: authHeaders() });
      set({ access: !!data.has_nutrition_access, price: data.price_cop ?? null, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  startNutritionUpgrade: async () => {
    try {
      const { data } = await api.post<{ checkout_url: string }>('/nutrition/upgrade/', {}, { headers: authHeaders() });
      return data.checkout_url;
    } catch {
      return null;
    }
  },

  fetchUpgradeStatus: async (reference) => {
    try {
      const { data } = await api.get<UpgradeStatus>(`/nutrition/upgrade/${reference}/`, { headers: authHeaders() });
      return data;
    } catch {
      return null;
    }
  },
}));
```

- [ ] **Step 4: Run the store test**

Run: `npx jest app/__tests__/stores/nutritionUpgradeStore.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Lock the nutrition page** — in `frontend/app/(app)/my-nutrition/page.tsx`, read `useNutritionUpgradeStore`, call `fetchNutritionAccess()` on mount, and when `access === false` render a lock overlay instead of the nutrition content:

```tsx
// near the top of the component body
const { access, price, fetchNutritionAccess, startNutritionUpgrade, fetchUpgradeStatus } = useNutritionUpgradeStore();
const search = useSearchParams();
const ref = search.get('ref');
useEffect(() => { fetchNutritionAccess(); }, [fetchNutritionAccess]);
useEffect(() => {
  if (!ref) return;
  let tries = 0;
  const id = setInterval(async () => {
    tries += 1;
    const s = await fetchUpgradeStatus(ref);
    if (s && s.status !== 'pending') { fetchNutritionAccess(); clearInterval(id); }
    if (tries >= 10) clearInterval(id);
  }, 2000);
  return () => clearInterval(id);
}, [ref, fetchUpgradeStatus, fetchNutritionAccess]);

async function upgrade() {
  const url = await startNutritionUpgrade();
  if (url) window.location.href = url;
}
```

And gate the render:

```tsx
if (!access) {
  return (
    <div className="px-5 xl:px-10 pt-20 pb-16 space-y-4" data-testid="nutrition-locked">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Mi Nutrición</h1>
      <div className="bg-white rounded-2xl p-6 border border-kore-gray-light/40 shadow-sm text-center space-y-3">
        <p className="text-[14px] font-semibold text-kore-gray-dark">La nutrición no está incluida en tu plan.</p>
        <p className="text-[13px] text-kore-gray-dark/60">Agrégala y accede a tu plan y seguimiento nutricional.{price ? ` Desde $${price.toLocaleString('es-CO')}/mes (prorrateado este mes).` : ''}</p>
        <button type="button" onClick={upgrade} className="py-2.5 px-5 rounded-xl bg-kore-red text-white text-[13px] font-semibold hover:bg-kore-red-dark transition-colors" data-testid="nutrition-upgrade-cta">
          Agrega nutrición a tu plan
        </button>
      </div>
    </div>
  );
}
```

If the page uses `useSearchParams`, wrap the default export in `<Suspense>` (mirror `book-session/page.tsx`) so the static build stays green.

- [ ] **Step 6: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add "frontend/lib/stores/nutritionUpgradeStore.ts" "frontend/app/(app)/my-nutrition/page.tsx" "frontend/app/__tests__/stores/nutritionUpgradeStore.test.ts"
git commit -m "feat(nutrition): locked Mi Nutrición + prorated upgrade CTA + store

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 9: E2E + flow triplet v1.5.0 + guides

**Files:**
- Create: `frontend/e2e/app/nutrition-upgrade.spec.ts`
- Modify: `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`, `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Flow tag** — in `frontend/e2e/helpers/flow-tags.ts`, add after `CUSTOMER_BUY_CREDITS`:

```typescript
  CUSTOMER_BUY_NUTRITION: ['@flow:customer-buy-nutrition', '@module:app', '@priority:P2'],
```

- [ ] **Step 2: E2E spec** — create `frontend/e2e/app/nutrition-upgrade.spec.ts`:

```typescript
import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

test.describe('Comprar nutrición', { tag: [...FlowTags.CUSTOMER_BUY_NUTRITION, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => { await mockLoginAsTestUser(page); });

  test('shows the locked state and CTA without access', async ({ page }) => {
    await page.route('**/api/nutrition/access/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ has_nutrition_access: false, price_cop: 30000 }) }));
    await page.goto('/my-nutrition');
    await expect(page.getByTestId('nutrition-locked')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('nutrition-upgrade-cta')).toBeVisible();
  });
});
```

- [ ] **Step 3: flow-definitions.json → v1.5.0** — bump `"version"` to `"1.5.0"`, `"lastUpdated"` to `"2026-07-07"`, add after `customer-buy-credits`:

```json
    "customer-buy-nutrition": {
      "name": "Cliente — Comprar nutrición",
      "module": "app",
      "priority": "P2",
      "roles": ["user"],
      "description": "La nutrición es de pago: si el plan no la incluye, el cliente ve un candado y puede agregarla pagando el prorrateo del mes; desde la renovación se cobra junto al plan."
    },
```

- [ ] **Step 4: USER_FLOW_MAP.md** — add before `### customer-session-grants`:

```markdown
### customer-buy-nutrition: Cliente — Comprar nutrición
- Module: app
- Priority: P2
- Route: /my-nutrition
- Roles: user
- Description: Nutrition is gated by payment. Without access the client sees a lock and can add nutrition to the current plan for a prorated charge; renewals then bill training + nutrition together.
- E2E Coverage: Covered (frontend/e2e/app/nutrition-upgrade.spec.ts)

**Steps**
1. Open /my-nutrition. Without access, a lock + "Agrega nutrición a tu plan" CTA shows.
2. Tap the CTA → redirect to Wompi for the prorated amount.
3. On return (?ref=NU-…) the page polls status and unlocks on approval.

**Branches / Variations**
- Existing training-only clients are locked out (retroactive paywall).
- The upgrade charge is prorated by days left in the cycle; from the next renewal the plan + nutrition bill as one payment.
- No active plan → the upgrade is rejected (need a plan first).
```

- [ ] **Step 5: Guides** — in `docs/release-july/GUIA_DE_VALIDACION.md`, add a **Parte 8** section (5-block: ver candado en Mi Nutrición → agregar nutrición → pagar prorrateo → volver desbloqueado). In `docs/release-july/GUIA_QA_STAGING.md`, add a Parte 8 seed (`NutritionProduct`) + a route 3.10. Write verbatim:

`GUIA_DE_VALIDACION.md` (before "Próximas secciones"):

```markdown
## Parte 8 — Comprar nutrición

### Funcionalidad 11: Agregar nutrición a tu plan

#### 1. ¿Qué es y para qué sirve?
La nutrición ahora es un beneficio de pago. Si tu plan no la incluye, puedes **agregarla**; pagas solo lo que resta del mes (prorrateado) y desde la siguiente renovación se cobra junto con tu plan en un solo pago.

#### 2. Antes de empezar
- Cuenta **cliente** con un **plan activo** sin nutrición.
- El admin configuró el **precio de nutrición**.

#### 3. Paso a paso para probarlo
1. Entra a **Mi Nutrición**: verás un **candado** con el precio y el botón **"Agrega nutrición a tu plan"**.
2. Tócalo → te lleva al checkout de Wompi por el **monto prorrateado**.
3. Paga (sandbox). Al volver, la sección se **desbloquea**.

#### 4. Cómo sabes que funcionó
- Mi Nutrición muestra el contenido (plan, seguimiento) en vez del candado.
- Tu próxima renovación cobrará plan **+ nutrición** en un solo pago.

#### 5. Si algo no sale como esperabas
- **Sigo viendo el candado tras pagar** → espera unos segundos (confirma por webhook) y refresca.
- **No tengo plan activo** → primero necesitas un plan para agregar nutrición.
- Si persiste, avísale al equipo técnico con una captura.
```

`GUIA_QA_STAGING.md` — add a route after 3.9:

```markdown
### 3.10 Cliente — Comprar nutrición (Parte 8)
1. (Admin) crea un `NutritionProduct` activo con `price_cop` (o usa el seed).
2. Cliente con plan activo **sin nutrición** → **Mi Nutrición** muestra el candado.
3. **Agrega nutrición** → paga el prorrateo en Wompi (sandbox) → al volver se desbloquea.
4. Verifica en admin que la `Subscription` quedó con `includes_nutrition=True`.
```

Add the seed to section 5's shell snippet:

```python
# Precio de nutrición (Parte 8)
from core_app.models.nutrition_product import NutritionProduct
NutritionProduct.objects.get_or_create(name='Nutrición', defaults={'price_cop': 30000, 'is_active': True})
```

- [ ] **Step 6: Typecheck + validate JSON + commit**

Run: `cd frontend && npx tsc --noEmit` (clean) and `python3 -c "import json; json.load(open('e2e/flow-definitions.json'))"` (no error).

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md docs/release-july/
git commit -m "test(nutrition): e2e for nutrition paywall; flows v1.5.0 + guides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 10: Wrap-up — audit, checks, push, PR

- [ ] **Step 1**: invoke `e2e-user-flows-check` for `customer-buy-nutrition` (and the touched nutrition flows); close any P1/P2 gap.
- [ ] **Step 2**: `cd backend && source venv/bin/activate && python manage.py check && python manage.py makemigrations core_app --check --dry-run` (no pending) and `cd frontend && npx tsc --noEmit` (clean).
- [ ] **Step 3**: `git push -u origin feat/07072026-phase8-buy-packs`, create the PR to base `july-release` titled `feat(nutrition): Phase 2 Part 8 — buy nutrition (plan upgrade)`, summarizing: paywall via `includes_nutrition`, prorated one-time upgrade (webhook grants access, idempotent), combined recurring charge, admin nutrition price, gated client routes, locked Mi Nutrición + CTA, flows v1.5.0 + guides. Note the retroactive paywall (existing training-only clients lose nutrition until purchase). CI runs everything. Report the PR URL.
