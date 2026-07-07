# Part 7 — Buy Credits with Wompi Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a client buy credits with money via Wompi; on webhook APPROVED, award the purchased credits as confirmed (idempotent), marked with a dedicated `PURCHASE` ledger action.

**Architecture:** Admin-managed `CreditPackage` catalog + a `CreditPurchase` one-time record (separate from the subscription `PaymentIntent`). Initiate returns a Wompi Web Checkout redirect URL; the existing webhook gains a credit branch that awards confirmed credits via the idempotent `credit_engine.award`. Frontend redirects to Wompi and polls purchase status on return.

**Tech Stack:** Django 6 + DRF, Wompi (Web Checkout redirect + webhook), Next.js 16 App Router, Zustand 5, Jest, Playwright.

## Global Constraints

- Branch: `feat/07072026-phase7-credit-topup` (based on `july-release`, includes Parts 4–6). PR targets `july-release`.
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Django module `core_project`, single app `core_app`. Don't edit old migrations; last is `0063`. New = `0064`.
- Purchased credits are **CONFIRMED** (real money) and use `CreditTransaction.Action.PURCHASE = 'purchase'`.
- Idempotent award via `credit_engine.award(customer, action, reference_type, reference_id, description, *, amount)` (defaults to CONFIRMED; returns None on duplicate `(customer, action, reference_type, reference_id)`).
- Credit references are prefixed `CR-` (`f'CR-{generate_reference()}'`); the webhook routes by looking up `CreditPurchase` by reference. Subscription payment path stays unchanged.
- Reuse `wompi_service.generate_reference` and `generate_integrity_signature`. Config: `settings.WOMPI_PUBLIC_KEY`, `settings.FRONTEND_BASE_URL`. Wompi Web Checkout base: `https://checkout.wompi.co/p/`.
- `(app)` page containers use the dashboard padding pattern (`px-5 xl:px-10 pt-20`), never `max-w-*`.
- Backend pytest and store-only Jest run locally; component/E2E verified by CI. Spanish user-facing strings.

---

### Task 1: Models — `CreditPackage` + `CreditPurchase` + `Action.PURCHASE`

**Files:**
- Create: `backend/core_app/models/credit_package.py`, `backend/core_app/models/credit_purchase.py`
- Modify: `backend/core_app/models/__init__.py`, `backend/core_app/models/credit.py` (Action enum)
- Create (makemigrations): `backend/core_app/migrations/0064_credit_topup.py`
- Test: `backend/core_app/tests/models/test_credit_purchase.py`

**Interfaces:**
- Produces: `CreditPackage(name, credits, price_cop, is_active)`; `CreditPurchase(customer, credit_package, credits, amount_cop, reference, wompi_transaction_id, status, resolved_at)` with `Status.PENDING/APPROVED/DECLINED`; `CreditTransaction.Action.PURCHASE == 'purchase'`.

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/models/test_credit_purchase.py`:

```python
import pytest

from core_app.models import User
from core_app.models.credit import CreditTransaction
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


def test_purchase_action_exists():
    assert CreditTransaction.Action.PURCHASE == 'purchase'


@pytest.mark.django_db
def test_credit_purchase_defaults():
    u = User.objects.create_user(email='b@example.com', password='x', first_name='B', last_name='C')
    pkg = CreditPackage.objects.create(name='100 créditos', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=u, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-abc')
    assert p.status == CreditPurchase.Status.PENDING
    assert p.resolved_at is None
    assert pkg.is_active is True
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/models/test_credit_purchase.py -q`
Expected: FAIL — modules/action missing.

- [ ] **Step 3: Create `CreditPackage`** — `backend/core_app/models/credit_package.py`:

```python
from django.db import models

from core_app.models.base import TimestampedModel


class CreditPackage(TimestampedModel):
    """An admin-configured bundle of credits purchasable with money."""

    name = models.CharField(max_length=120)
    credits = models.PositiveIntegerField()
    price_cop = models.PositiveIntegerField(help_text='Whole COP (no cents).')
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('price_cop',)

    def __str__(self):
        return f'{self.name} — {self.credits} cr / {self.price_cop} COP'
```

- [ ] **Step 4: Create `CreditPurchase`** — `backend/core_app/models/credit_purchase.py`:

```python
from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class CreditPurchase(TimestampedModel):
    """A one-time credit purchase paid via Wompi (not a subscription)."""

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        APPROVED = 'approved', 'Approved'
        DECLINED = 'declined', 'Declined'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name='credit_purchases',
    )
    credit_package = models.ForeignKey('core_app.CreditPackage', on_delete=models.PROTECT, related_name='purchases')
    credits = models.PositiveIntegerField()
    amount_cop = models.PositiveIntegerField()
    reference = models.CharField(max_length=64, unique=True, db_index=True)
    wompi_transaction_id = models.CharField(max_length=255, blank=True)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING, db_index=True)
    resolved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f'{self.customer} — {self.credits} cr ({self.status})'
```

- [ ] **Step 5: Register models + add the action.** In `backend/core_app/models/__init__.py`, add imports and `__all__` entries (mirror `SessionGrant`):

```python
from .credit_package import CreditPackage
from .credit_purchase import CreditPurchase
```

Add `'CreditPackage'` and `'CreditPurchase'` to `__all__`. In `backend/core_app/models/credit.py`, add to the `Action` class after `REDEMPTION_REFUND`:

```python
        PURCHASE = 'purchase', 'Credit purchase'
```

- [ ] **Step 6: Migrate + run tests**

Run: `python manage.py makemigrations core_app -n credit_topup && python manage.py migrate`
Expected: creates `0064_credit_topup.py` (CreditPackage, CreditPurchase, alter Action). Migrates clean.

Run: `pytest core_app/tests/models/test_credit_purchase.py -q`
Expected: 3 passed.

- [ ] **Step 7: Commit**

```bash
git add backend/core_app/models/ backend/core_app/migrations/0064_credit_topup.py backend/core_app/tests/models/test_credit_purchase.py
git commit -m "feat(credits): CreditPackage + CreditPurchase models + PURCHASE ledger action

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Serializers — package + purchase

**Files:**
- Create: `backend/core_app/serializers/credit_purchase_serializers.py`
- Test: `backend/core_app/tests/serializers/test_credit_purchase_serializers.py`

**Interfaces:**
- Produces: `CreditPackageSerializer` (`id, name, credits, price_cop`); `CreditPurchaseStatusSerializer` (`reference, status, credits`).

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/serializers/test_credit_purchase_serializers.py`:

```python
import pytest

from core_app.models.credit_package import CreditPackage
from core_app.serializers.credit_purchase_serializers import CreditPackageSerializer


@pytest.mark.django_db
def test_package_serializer_shape():
    pkg = CreditPackage.objects.create(name='300', credits=300, price_cop=50000)
    data = CreditPackageSerializer(pkg).data
    assert data['credits'] == 300
    assert data['price_cop'] == 50000
    assert set(data.keys()) == {'id', 'name', 'credits', 'price_cop'}
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/serializers/test_credit_purchase_serializers.py -q`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement** — `backend/core_app/serializers/credit_purchase_serializers.py`:

```python
from rest_framework import serializers

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


class CreditPackageSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditPackage
        fields = ('id', 'name', 'credits', 'price_cop')


class CreditPurchaseStatusSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditPurchase
        fields = ('reference', 'status', 'credits')
```

- [ ] **Step 4: Run the test**

Run: `pytest core_app/tests/serializers/test_credit_purchase_serializers.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/serializers/credit_purchase_serializers.py backend/core_app/tests/serializers/test_credit_purchase_serializers.py
git commit -m "feat(credits): credit package + purchase-status serializers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Endpoints — list packages, initiate purchase, status

**Files:**
- Create: `backend/core_app/views/credit_purchase_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_credit_purchase_views.py`

**Interfaces:**
- Consumes: `CreditPackage`, `CreditPurchase` (Task 1), serializers (Task 2), `wompi_service.generate_reference`/`generate_integrity_signature`.
- Produces: `GET /api/credits/packages/`; `POST /api/credits/purchases/` → `{reference, checkout_url}`; `GET /api/credits/purchases/<reference>/` → `{reference, status, credits}`.

- [ ] **Step 1: Write the failing tests** — create `backend/core_app/tests/views/test_credit_purchase_views.py`:

```python
import pytest

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


@pytest.mark.django_db
def test_lists_active_packages(api_client, existing_user):
    CreditPackage.objects.create(name='A', credits=100, price_cop=20000, is_active=True)
    CreditPackage.objects.create(name='B', credits=200, price_cop=35000, is_active=False)
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/packages/')
    assert resp.status_code == 200
    assert len(resp.json()) == 1


@pytest.mark.django_db
def test_initiate_purchase_returns_checkout(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/credits/purchases/', {'credit_package_id': pkg.id}, format='json')
    assert resp.status_code == 201
    body = resp.json()
    assert body['reference'].startswith('CR-')
    assert 'checkout_url' in body and 'checkout.wompi.co' in body['checkout_url']
    purchase = CreditPurchase.objects.get(reference=body['reference'])
    assert purchase.status == 'pending'
    assert purchase.credits == 100
    assert purchase.amount_cop == 20000


@pytest.mark.django_db
def test_initiate_inactive_package_400(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000, is_active=False)
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/credits/purchases/', {'credit_package_id': pkg.id}, format='json')
    assert resp.status_code == 400


@pytest.mark.django_db
def test_purchase_status(api_client, existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-xyz')
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/purchases/CR-xyz/')
    assert resp.status_code == 200
    assert resp.json()['status'] == 'pending'
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest core_app/tests/views/test_credit_purchase_views.py -q`
Expected: FAIL — routes 404.

- [ ] **Step 3: Implement the views** — `backend/core_app/views/credit_purchase_views.py`:

```python
from urllib.parse import quote

from django.conf import settings
from rest_framework import status
from rest_framework.generics import ListAPIView
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.serializers.credit_purchase_serializers import (
    CreditPackageSerializer, CreditPurchaseStatusSerializer,
)
from core_app.services.wompi_service import generate_reference, generate_integrity_signature

WOMPI_CHECKOUT_URL = 'https://checkout.wompi.co/p/'


class CreditPackageListView(ListAPIView):
    serializer_class = CreditPackageSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return CreditPackage.objects.filter(is_active=True)


class CreditPurchaseCreateView(APIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        pkg = CreditPackage.objects.filter(pk=request.data.get('credit_package_id'), is_active=True).first()
        if pkg is None:
            return Response({'detail': 'Paquete no disponible.'}, status=status.HTTP_400_BAD_REQUEST)
        reference = f'CR-{generate_reference()}'
        amount_in_cents = pkg.price_cop * 100
        purchase = CreditPurchase.objects.create(
            customer=request.user, credit_package=pkg,
            credits=pkg.credits, amount_cop=pkg.price_cop, reference=reference,
        )
        signature = generate_integrity_signature(reference, amount_in_cents, 'COP')
        redirect_url = f'{settings.FRONTEND_BASE_URL}/comprar-creditos?ref={reference}'
        checkout_url = (
            f'{WOMPI_CHECKOUT_URL}?public-key={settings.WOMPI_PUBLIC_KEY}'
            f'&currency=COP&amount-in-cents={amount_in_cents}'
            f'&reference={reference}&signature:integrity={signature}'
            f'&redirect-url={quote(redirect_url, safe="")}'
        )
        return Response({'reference': reference, 'checkout_url': checkout_url}, status=status.HTTP_201_CREATED)


class CreditPurchaseStatusView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, reference):
        purchase = CreditPurchase.objects.filter(reference=reference, customer=request.user).first()
        if purchase is None:
            return Response({'detail': 'Compra no encontrada.'}, status=status.HTTP_404_NOT_FOUND)
        return Response(CreditPurchaseStatusSerializer(purchase).data)
```

- [ ] **Step 4: Register the routes** — in `backend/core_app/urls/api_urls.py`, add the import and paths (near the other `credits/` paths):

```python
from core_app.views.credit_purchase_views import (
    CreditPackageListView, CreditPurchaseCreateView, CreditPurchaseStatusView,
)
```

```python
    path('credits/packages/', CreditPackageListView.as_view(), name='credit-packages'),
    path('credits/purchases/', CreditPurchaseCreateView.as_view(), name='credit-purchases'),
    path('credits/purchases/<str:reference>/', CreditPurchaseStatusView.as_view(), name='credit-purchase-status'),
```

- [ ] **Step 5: Run the tests**

Run: `pytest core_app/tests/views/test_credit_purchase_views.py -q`
Expected: 4 passed.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/credit_purchase_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_credit_purchase_views.py
git commit -m "feat(credits): endpoints to list packages, initiate purchase (Wompi checkout URL), poll status

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Webhook — credit-purchase branch (idempotent award)

**Files:**
- Modify: `backend/core_app/views/wompi_views.py` (imports + `_handle_transaction_updated` + new `_resolve_credit_purchase`)
- Test: `backend/core_app/tests/views/test_wompi_credit_topup.py`

**Interfaces:**
- Consumes: `CreditPurchase` (Task 1), `credit_engine.award`, `CreditTransaction.Action.PURCHASE`.
- Produces: on webhook APPROVED for a `CreditPurchase` reference → purchase `approved` + confirmed credits awarded once.

- [ ] **Step 1: Write the failing tests** — create `backend/core_app/tests/views/test_wompi_credit_topup.py`:

```python
import pytest

from core_app.models import User
from core_app.models.credit import CreditTransaction
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.services import credit_engine
from core_app.views.wompi_views import _handle_transaction_updated


def _event(reference, txn_id, status='APPROVED'):
    return {'transaction': {'id': txn_id, 'status': status, 'reference': reference}}


@pytest.mark.django_db
def test_webhook_approved_awards_confirmed_credits(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a1')
    _handle_transaction_updated(_event('CR-a1', 'txn-1'))
    p.refresh_from_db()
    assert p.status == 'approved'
    assert credit_engine.get_wallet(existing_user).balance == 100
    assert CreditTransaction.objects.filter(customer=existing_user, action='purchase', status='confirmed').count() == 1


@pytest.mark.django_db
def test_webhook_duplicate_awards_once(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a2')
    _handle_transaction_updated(_event('CR-a2', 'txn-2'))
    _handle_transaction_updated(_event('CR-a2', 'txn-2'))  # retransmission
    assert credit_engine.get_wallet(existing_user).balance == 100
    assert CreditTransaction.objects.filter(customer=existing_user, action='purchase').count() == 1


@pytest.mark.django_db
def test_webhook_declined_awards_nothing(existing_user):
    pkg = CreditPackage.objects.create(name='A', credits=100, price_cop=20000)
    p = CreditPurchase.objects.create(customer=existing_user, credit_package=pkg, credits=100, amount_cop=20000, reference='CR-a3')
    _handle_transaction_updated(_event('CR-a3', 'txn-3', status='DECLINED'))
    p.refresh_from_db()
    assert p.status == 'declined'
    assert credit_engine.get_wallet(existing_user).balance == 0
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest core_app/tests/views/test_wompi_credit_topup.py -q`
Expected: FAIL — purchase stays pending, no credits (branch not implemented).

- [ ] **Step 3: Implement** — in `backend/core_app/views/wompi_views.py`:

Add imports (with the existing model/service imports; use explicit module paths to avoid `__init__` ordering issues):

```python
from core_app.models.credit import CreditTransaction
from core_app.models.credit_purchase import CreditPurchase
from core_app.services import credit_engine
```

Insert the credit branch in `_handle_transaction_updated`, immediately **after** the Path 1 block ends (the `_resolve_payment_intent(intent, ...); return` at the end of `if intent is not None:`) and **before** the "Path 2: Update an existing Payment" comment:

```python
    # --- Path 1.5: Resolve a CreditPurchase (one-time credit top-up) ---
    if txn_reference:
        purchase = CreditPurchase.objects.select_related('customer').filter(reference=txn_reference).first()
        if purchase is not None:
            _resolve_credit_purchase(purchase, txn_id, txn_status)
            return
```

Add the resolver function (near `_resolve_payment_intent`):

```python
def _resolve_credit_purchase(purchase, txn_id, txn_status):
    """Award confirmed credits on APPROVED; mark declined otherwise. Idempotent."""
    if purchase.status != CreditPurchase.Status.PENDING:
        return
    if txn_status == 'APPROVED':
        with db_transaction.atomic():
            purchase.status = CreditPurchase.Status.APPROVED
            purchase.wompi_transaction_id = txn_id
            purchase.resolved_at = timezone.now()
            purchase.save(update_fields=['status', 'wompi_transaction_id', 'resolved_at', 'updated_at'])
            credit_engine.award(
                purchase.customer, CreditTransaction.Action.PURCHASE,
                'credit_purchase', purchase.pk,
                f'Compraste {purchase.credits} créditos', amount=purchase.credits,
            )
    elif txn_status in ('DECLINED', 'ERROR', 'VOIDED'):
        purchase.status = CreditPurchase.Status.DECLINED
        purchase.wompi_transaction_id = txn_id
        purchase.resolved_at = timezone.now()
        purchase.save(update_fields=['status', 'wompi_transaction_id', 'resolved_at', 'updated_at'])
```

> Note: the existing `WompiEvent` idempotency guard already blocks a repeated terminal-status webhook for the same `txn_id` before this branch runs; `award`'s reference idempotency is the second layer. The duplicate test uses the same `txn_id`, so the guard makes the second call a no-op.

- [ ] **Step 4: Run the tests**

Run: `pytest core_app/tests/views/test_wompi_credit_topup.py -q`
Expected: 3 passed.

- [ ] **Step 5: Regression — subscription webhook path unchanged**

Run: `pytest core_app/tests/views/ -q -k "wompi or webhook" 2>&1 | tail -5`
Expected: existing Wompi/webhook tests still pass.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/views/wompi_views.py backend/core_app/tests/views/test_wompi_credit_topup.py
git commit -m "feat(credits): webhook awards confirmed credits on approved credit purchase (idempotent)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Admin — register catalog + read-only purchases

**Files:**
- Modify: `backend/core_app/admin.py`

- [ ] **Step 1: Register** — append to `backend/core_app/admin.py`:

```python
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


@admin.register(CreditPackage)
class CreditPackageAdmin(admin.ModelAdmin):
    list_display = ('name', 'credits', 'price_cop', 'is_active')
    list_editable = ('is_active',)
    list_filter = ('is_active',)


@admin.register(CreditPurchase)
class CreditPurchaseAdmin(admin.ModelAdmin):
    list_display = ('reference', 'customer', 'credits', 'amount_cop', 'status', 'resolved_at')
    list_filter = ('status',)
    search_fields = ('reference', 'customer__email')
    readonly_fields = ('customer', 'credit_package', 'credits', 'amount_cop', 'reference', 'wompi_transaction_id', 'status', 'resolved_at')

    def has_add_permission(self, request):
        return False
```

- [ ] **Step 2: Verify + commit**

Run: `python manage.py check`
Expected: `System check identified no issues`.

```bash
git add backend/core_app/admin.py
git commit -m "feat(credits): admin for CreditPackage (editable) + CreditPurchase (read-only)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Frontend — store + `/comprar-creditos` + button

**Files:**
- Create: `frontend/lib/stores/creditPurchaseStore.ts`, `frontend/app/(app)/comprar-creditos/page.tsx`
- Modify: `frontend/app/(app)/mis-creditos/page.tsx`
- Test: `frontend/app/__tests__/stores/creditPurchaseStore.test.ts`

**Interfaces:**
- Consumes: `GET /credits/packages/`, `POST /credits/purchases/`, `GET /credits/purchases/<ref>/`.
- Produces: `useCreditPurchaseStore` with `{ packages, fetchCreditPackages(), startCreditPurchase(id), fetchPurchaseStatus(ref) }`.

- [ ] **Step 1: Write the failing store test** — create `frontend/app/__tests__/stores/creditPurchaseStore.test.ts`:

```typescript
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useCreditPurchaseStore } from '@/lib/stores/creditPurchaseStore';

describe('creditPurchaseStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCreditPurchaseStore.setState({ packages: [] });
  });

  it('fetchCreditPackages stores packages', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: [{ id: 1, name: 'A', credits: 100, price_cop: 20000 }] });
    await useCreditPurchaseStore.getState().fetchCreditPackages();
    expect(useCreditPurchaseStore.getState().packages).toHaveLength(1);
  });

  it('startCreditPurchase posts the package id and returns checkout_url', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { reference: 'CR-x', checkout_url: 'https://checkout.wompi.co/p/?x' } });
    const url = await useCreditPurchaseStore.getState().startCreditPurchase(1);
    expect(api.post).toHaveBeenCalledWith('/credits/purchases/', { credit_package_id: 1 }, expect.any(Object));
    expect(url).toBe('https://checkout.wompi.co/p/?x');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/creditPurchaseStore.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the store** — `frontend/lib/stores/creditPurchaseStore.ts`:

```typescript
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

export type CreditPackage = { id: number; name: string; credits: number; price_cop: number };
export type PurchaseStatus = { reference: string; status: 'pending' | 'approved' | 'declined'; credits: number };

type State = {
  packages: CreditPackage[];
  loading: boolean;
  error: string;
  fetchCreditPackages: () => Promise<void>;
  startCreditPurchase: (packageId: number) => Promise<string | null>;
  fetchPurchaseStatus: (reference: string) => Promise<PurchaseStatus | null>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useCreditPurchaseStore = create<State>((set) => ({
  packages: [], loading: false, error: '',

  fetchCreditPackages: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get<CreditPackage[]>('/credits/packages/', { headers: authHeaders() });
      set({ packages: Array.isArray(data) ? data : [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar los paquetes.', loading: false });
    }
  },

  startCreditPurchase: async (packageId) => {
    set({ error: '' });
    try {
      const { data } = await api.post<{ reference: string; checkout_url: string }>('/credits/purchases/', { credit_package_id: packageId }, { headers: authHeaders() });
      return data.checkout_url;
    } catch {
      set({ error: 'No se pudo iniciar la compra.' });
      return null;
    }
  },

  fetchPurchaseStatus: async (reference) => {
    try {
      const { data } = await api.get<PurchaseStatus>(`/credits/purchases/${reference}/`, { headers: authHeaders() });
      return data;
    } catch {
      return null;
    }
  },
}));
```

- [ ] **Step 4: Run the store test**

Run: `npx jest app/__tests__/stores/creditPurchaseStore.test.ts`
Expected: 2 passed.

- [ ] **Step 5: Build the page** — `frontend/app/(app)/comprar-creditos/page.tsx`:

Note: `useSearchParams` requires a `<Suspense>` boundary under static export — mirror `book-session/page.tsx` (inner component + Suspense in the default export).

```tsx
'use client';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Sparkles } from 'lucide-react';
import { useCreditPurchaseStore, type CreditPackage } from '@/lib/stores/creditPurchaseStore';
import { useWalletStore } from '@/lib/stores/walletStore';

function ComprarCreditosInner() {
  const { packages, loading, error, fetchCreditPackages, startCreditPurchase, fetchPurchaseStatus } = useCreditPurchaseStore();
  const { fetchWallet } = useWalletStore();
  const searchParams = useSearchParams();
  const ref = searchParams.get('ref');
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<'approved' | 'declined' | null>(null);

  useEffect(() => { fetchCreditPackages(); }, [fetchCreditPackages]);

  // On return from Wompi, poll the purchase status a few times.
  useEffect(() => {
    if (!ref) return;
    let tries = 0;
    const id = setInterval(async () => {
      tries += 1;
      const status = await fetchPurchaseStatus(ref);
      if (status && status.status !== 'pending') {
        setResult(status.status);
        if (status.status === 'approved') fetchWallet(true);
        clearInterval(id);
      }
      if (tries >= 10) clearInterval(id);
    }, 2000);
    return () => clearInterval(id);
  }, [ref, fetchPurchaseStatus, fetchWallet]);

  async function buy(pkg: CreditPackage) {
    setBusy(true);
    const url = await startCreditPurchase(pkg.id);
    if (url) window.location.href = url;
    else setBusy(false);
  }

  return (
    <div className="px-5 xl:px-10 pt-20 pb-16 space-y-5" data-testid="comprar-creditos">
      <h1 className="font-heading text-[24px] font-semibold text-kore-wine-dark">Comprar créditos</h1>

      {result === 'approved' && <p className="text-[13px] text-kore-sage-deep bg-kore-sage/15 rounded-xl px-3 py-2">¡Pago aprobado! Tus créditos ya están en tu saldo.</p>}
      {result === 'declined' && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">El pago no se completó. Intenta de nuevo.</p>}
      {ref && !result && <p className="text-[13px] text-kore-gray-dark/50">Confirmando tu pago…</p>}
      {error && <p className="text-[13px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}

      {loading ? (
        <p className="text-[13px] text-kore-gray-dark/40">Cargando…</p>
      ) : packages.length === 0 ? (
        <p className="text-[13px] text-kore-gray-dark/40 py-8 text-center">No hay paquetes disponibles.</p>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {packages.map((pkg) => (
            <div key={pkg.id} className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm flex flex-col" data-testid="credit-package">
              <span className="inline-flex items-center gap-1 text-[15px] font-bold text-kore-gold-deep">
                <Sparkles className="w-4 h-4" strokeWidth={2} />{pkg.credits}
              </span>
              <p className="text-[12px] text-kore-gray-dark/50 mt-1 flex-1">{pkg.name}</p>
              <p className="text-[13px] font-semibold text-kore-gray-dark mt-2">${pkg.price_cop.toLocaleString('es-CO')}</p>
              <button type="button" disabled={busy} onClick={() => buy(pkg)} className="mt-3 py-2 rounded-xl bg-kore-red text-white text-[12px] font-semibold hover:bg-kore-red-dark transition-colors disabled:opacity-60">
                {busy ? 'Abriendo…' : 'Comprar'}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function ComprarCreditosPage() {
  return (
    <Suspense fallback={<div className="px-5 xl:px-10 pt-20 text-[13px] text-kore-gray-dark/40">Cargando…</div>}>
      <ComprarCreditosInner />
    </Suspense>
  );
}
```

- [ ] **Step 6: Add the button in `/mis-creditos`** — in `frontend/app/(app)/mis-creditos/page.tsx`, add a link under the balance card. After the balance card's closing `</div>` (the gradient card), insert:

```tsx
      <a href="/comprar-creditos" className="block text-center text-[13px] font-semibold text-kore-red bg-kore-red/10 rounded-xl py-2.5" data-testid="buy-credits-link">
        Comprar créditos
      </a>
```

- [ ] **Step 7: Typecheck + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean.

```bash
git add "frontend/lib/stores/creditPurchaseStore.ts" "frontend/app/(app)/comprar-creditos/page.tsx" "frontend/app/(app)/mis-creditos/page.tsx" "frontend/app/__tests__/stores/creditPurchaseStore.test.ts"
git commit -m "feat(credits): comprar-creditos page + store + mis-creditos entry point

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: E2E + flow triplet v1.4.0 + guides

**Files:**
- Create: `frontend/e2e/app/comprar-creditos.spec.ts`
- Modify: `frontend/e2e/flow-definitions.json`, `frontend/e2e/helpers/flow-tags.ts`, `docs/USER_FLOW_MAP.md`, `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Flow tag** — in `frontend/e2e/helpers/flow-tags.ts`, add after `CUSTOMER_SESSION_GRANTS`:

```typescript
  CUSTOMER_BUY_CREDITS: ['@flow:customer-buy-credits', '@module:app', '@priority:P2'],
```

- [ ] **Step 2: E2E spec** — create `frontend/e2e/app/comprar-creditos.spec.ts`:

```typescript
import { test, expect, mockLoginAsTestUser } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const PACKAGES = [{ id: 1, name: 'Impulso', credits: 100, price_cop: 20000 }];

test.describe('Comprar créditos', { tag: [...FlowTags.CUSTOMER_BUY_CREDITS, RoleTags.USER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsTestUser(page);
    await page.route('**/api/credits/packages/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PACKAGES) }));
    await page.route('**/api/credits/wallet/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ balance: 100, pending_balance: 0, current_streak: 1, longest_streak: 1, last_active_date: '2026-07-07', next_milestone: null }) }));
  });

  test('lists credit packages', async ({ page }) => {
    await page.goto('/comprar-creditos');
    await expect(page.getByTestId('comprar-creditos')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Impulso')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Comprar' })).toBeVisible();
  });

  test('shows success on return from an approved payment', async ({ page }) => {
    await page.route('**/api/credits/purchases/CR-ok/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ reference: 'CR-ok', status: 'approved', credits: 100 }) }));
    await page.goto('/comprar-creditos?ref=CR-ok');
    await expect(page.getByText(/¡Pago aprobado!/)).toBeVisible({ timeout: 15_000 });
  });
});
```

- [ ] **Step 3: flow-definitions.json → v1.4.0** — bump `"version"` to `"1.4.0"`, `"lastUpdated"` to `"2026-07-07"`, add after `customer-session-grants`:

```json
    "customer-buy-credits": {
      "name": "Cliente — Comprar créditos",
      "module": "app",
      "priority": "P2",
      "roles": ["user"],
      "description": "El cliente compra créditos con dinero real vía Wompi eligiendo un paquete; al aprobarse el pago los créditos se acreditan como confirmados en su saldo."
    },
```

- [ ] **Step 4: USER_FLOW_MAP.md** — add before `### trainer-store-management`:

```markdown
### customer-buy-credits: Cliente — Comprar créditos
- Module: app
- Priority: P2
- Route: /comprar-creditos
- Roles: user
- Description: The client buys credits with money via Wompi; on approval the credits are added as confirmed and marked as purchased in the ledger.
- E2E Coverage: Covered (frontend/e2e/app/comprar-creditos.spec.ts)

**Steps**
1. From /mis-creditos tap "Comprar créditos".
2. Pick a credit package and tap "Comprar" → redirect to Wompi checkout.
3. Pay; Wompi returns to /comprar-creditos?ref=…; the page polls the purchase status.
4. On approval, the success message shows and the wallet balance rises.

**Branches / Variations**
- The webhook is the source of truth; the credit is awarded once (idempotent), even if Wompi retransmits.
- DECLINED/ERROR/VOIDED → purchase declined, no credits, failure message.
- Purchased credits use the `purchase` ledger action (distinguishable from earned credits).
```

- [ ] **Step 5: Guides** — in `docs/release-july/GUIA_DE_VALIDACION.md`, add a **Parte 7** section (5-block: elegir paquete → pagar en Wompi → volver y ver créditos acreditados). In `docs/release-july/GUIA_QA_STAGING.md`, add a Parte 7 seed (`CreditPackage`) + a route 3.9. Write verbatim:

`GUIA_DE_VALIDACION.md` (before "Próximas secciones"):

```markdown
## Parte 7 — Comprar créditos

### Funcionalidad 10: Comprar créditos con dinero

#### 1. ¿Qué es y para qué sirve?
Además de ganarlos, puedes **comprar créditos** con dinero (tarjeta / Nequi / Bancolombia) vía Wompi. Se acreditan apenas se aprueba el pago.

#### 2. Antes de empezar
- Cuenta **cliente**.
- Al menos un **paquete de créditos** publicado por el admin.

#### 3. Paso a paso para probarlo
1. En **Mis créditos**, toca **"Comprar créditos"**.
2. Elige un paquete y toca **"Comprar"** → te lleva al checkout de Wompi.
3. Paga (en sandbox usa los datos de prueba). Al volver, la página confirma el pago.

#### 4. Cómo sabes que funcionó
- Vuelves a **Comprar créditos** con el mensaje **"¡Pago aprobado!"**.
- Tu **saldo** en Mis créditos sube por la cantidad comprada.
- En el historial aparece **"Compraste N créditos"**.

#### 5. Si algo no sale como esperabas
- **Pagué pero no veo los créditos** → espera unos segundos (la confirmación llega por webhook) y refresca.
- **El pago fue rechazado** → verás un mensaje de error; intenta con otro método.
- Si persiste, avísale al equipo técnico con una captura.
```

`GUIA_QA_STAGING.md` — add a route after 3.8:

```markdown
### 3.9 Cliente — Comprar créditos (Parte 7)
1. (Admin) crea un `CreditPackage` activo en el Django admin (o usa el seed).
2. Login cliente → **Mis créditos → Comprar créditos** → elige un paquete → **Comprar**.
3. Completa el pago en Wompi (sandbox). Al volver a `/comprar-creditos?ref=…`, verifica **"¡Pago aprobado!"** y que el saldo subió.
```

Add the seed to section 5's shell snippet:

```python
# Paquetes de crédito (Parte 7)
from core_app.models.credit_package import CreditPackage
CreditPackage.objects.get_or_create(name='Impulso', defaults={'credits': 100, 'price_cop': 20000})
CreditPackage.objects.get_or_create(name='Pro', defaults={'credits': 300, 'price_cop': 50000})
```

- [ ] **Step 6: Typecheck + validate JSON + commit**

Run: `cd frontend && npx tsc --noEmit` (clean) and `python3 -c "import json; json.load(open('e2e/flow-definitions.json'))"` (no error).

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md docs/release-july/
git commit -m "test(credits): e2e for buying credits; flows v1.4.0 + guides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Wrap-up — audit, checks, push, PR

- [ ] **Step 1**: invoke `e2e-user-flows-check` for `customer-buy-credits`; close any P1/P2 gap.
- [ ] **Step 2**: `cd backend && source venv/bin/activate && python manage.py check && python manage.py makemigrations core_app --check --dry-run` (no pending) and `cd frontend && npx tsc --noEmit` (clean).
- [ ] **Step 3**: `git push -u origin feat/07072026-phase7-credit-topup`, create the PR to base `july-release` titled `feat(credits): Phase 2 Part 7 — buy credits with Wompi`, summarizing: CreditPackage/CreditPurchase, initiate → Wompi Web Checkout URL, webhook credit branch (confirmed + idempotent, subscription path untouched), PURCHASE ledger action for analytics, admin catalog, frontend buy flow, flows v1.4.0 + guides. CI runs everything. Report the PR URL.
