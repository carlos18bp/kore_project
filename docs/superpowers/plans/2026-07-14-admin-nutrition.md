# Admin Nutrition Management — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Manage the nutrition add-on (its monthly price and which plans include it) from `/admin-platform/nutricion`, instead of only from the Django admin.

**Architecture:** Three moving parts. The backend exposes `includes_nutrition` on the existing `PackageSerializer` (no new package endpoint — `PackageViewSet` already serves admin-only `PATCH /packages/{id}/`) and adds a singleton `GET`/`PATCH /api/admin/nutrition-product/` view for the `NutritionProduct` price. The frontend adds an `adminNutritionStore` for the price and a `toggleNutrition` action on the existing `adminPackageStore`, both consumed by a new admin page. No billing logic changes: `nutrition_surcharge()` keeps reading the active price at charge time, and the page surfaces that blast radius with a confirmation dialog.

**Tech Stack:** Django 6 + DRF (`APIView` + `IsAdminRole`), Next.js 16 App Router, Zustand 5, Playwright, pytest, Jest.

**Spec:** `docs/superpowers/specs/2026-07-14-admin-nutrition-design.md`

## Global Constraints

- Branch: `feat/14072026-admin-nutrition`. Never commit to `master`/`july-release`.
- **Do not run pytest / Jest / Playwright locally.** GitHub CI runs them on push. Local verification is limited to `python manage.py check` and `npx tsc --noEmit`. Tests are still written first, in the same commit as the code they cover.
- Run all git commands from the repo root: `git -C /home/cerrotico/work/kore_project ...` (the Bash tool's cwd persists across calls and repo-relative paths double up otherwise).
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do not put `max-w-*` on the page container. Admin pages wrap content in `<AdminShell>`, which owns layout.
- User-facing copy is in Spanish; code, comments and commits in English.
- The nutrition price is a whole-COP positive integer (`price_cop`). No decimals, no currency conversion.

## File Structure

**Backend**
- `core_app/serializers/package_serializers.py` — add `includes_nutrition` to `PackageSerializer.Meta.fields`.
- `core_app/serializers/nutrition_product_serializers.py` *(new)* — `NutritionProductSerializer`.
- `core_app/views/admin_nutrition_views.py` *(new)* — `AdminNutritionProductView` (GET/PATCH, singleton, admin-only).
- `core_app/urls/api_urls.py` — wire `admin/nutrition-product/`.
- `core_app/tests/views/test_packages_views.py` — `includes_nutrition` round-trip.
- `core_app/tests/views/test_admin_nutrition_views.py` *(new)* — endpoint tests.

**Frontend**
- `lib/stores/adminNutritionStore.ts` *(new)* — the price singleton.
- `lib/stores/adminPackageStore.ts` — `includes_nutrition` on the types + a `toggleNutrition` action.
- `app/admin-platform/nutricion/page.tsx` *(new)* — thin server component.
- `app/admin-platform/nutricion/NutritionAdminClient.tsx` *(new)* — the two blocks.
- `app/components/admin/AdminSidebar.tsx`, `app/components/layouts/AdminMobileBottomNav.tsx` — nav entries.
- `app/__tests__/stores/adminNutritionStore.test.ts` *(new)* — Jest.
- `e2e/admin/admin-nutrition.spec.ts` *(new)*, `e2e/helpers/flow-tags.ts`, `e2e/flow-definitions.json`, `docs/USER_FLOW_MAP.md` — the flow triplet.

**Docs**
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`.

---

### Task 1: Expose `includes_nutrition` on `PackageSerializer`

**Files:**
- Modify: `backend/core_app/serializers/package_serializers.py`
- Test: `backend/core_app/tests/views/test_packages_views.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `PATCH /api/packages/{id}/` accepts `{"includes_nutrition": bool}`; every package payload gains an `includes_nutrition` boolean. Task 4 and Task 6 depend on this field's name.

- [ ] **Step 1: Write the failing test**

Append to `backend/core_app/tests/views/test_packages_views.py`:

```python
@pytest.mark.django_db
def test_package_admin_can_toggle_includes_nutrition(api_client, admin_user):
    """The nutrition flag round-trips through PackageSerializer."""
    package = Package.objects.create(title='Plan', sessions_count=4, includes_nutrition=False)
    api_client.force_authenticate(user=admin_user)

    url = reverse('package-detail', args=[package.pk])
    response = api_client.patch(url, {'includes_nutrition': True}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['includes_nutrition'] is True
    package.refresh_from_db()
    assert package.includes_nutrition is True
```

- [ ] **Step 2: Add the field**

In `backend/core_app/serializers/package_serializers.py`, inside `Meta.fields`, add `'includes_nutrition',` immediately after `'currency',`:

```python
        fields = (
            'id',
            'title',
            'short_description',
            'description',
            'category',
            'sessions_count',
            'session_duration_minutes',
            'price',
            'currency',
            'includes_nutrition',
            'validity_days',
            'terms_and_conditions',
            'is_active',
            'order',
            'created_at',
            'updated_at',
        )
```

- [ ] **Step 3: Verify Django still loads**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 4: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/serializers/package_serializers.py backend/core_app/tests/views/test_packages_views.py
git -C /home/cerrotico/work/kore_project commit -m "feat(admin): expose includes_nutrition on PackageSerializer

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Nutrition-product singleton endpoint

**Files:**
- Create: `backend/core_app/serializers/nutrition_product_serializers.py`
- Create: `backend/core_app/views/admin_nutrition_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_admin_nutrition_views.py`

**Interfaces:**
- Consumes: `NutritionProduct` (`name`, `price_cop`, `is_active`), `Subscription.Status.ACTIVE`, `core_app.permissions.IsAdminRole`.
- Produces: `GET`/`PATCH /api/admin/nutrition-product/` (url name `admin-nutrition-product`). Payload: `{id, name, price_cop, is_active, active_nutrition_subscriptions}`. Task 3 consumes this exact shape.

- [ ] **Step 1: Write the failing tests**

Create `backend/core_app/tests/views/test_admin_nutrition_views.py`:

```python
"""Tests for the admin nutrition-product endpoint (singleton price of the add-on)."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Package, Subscription
from core_app.models.nutrition_product import NutritionProduct

URL_NAME = 'admin-nutrition-product'


@pytest.mark.django_db
def test_non_admin_cannot_read_the_nutrition_product(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_get_creates_the_singleton_when_none_exists(api_client, admin_user):
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['price_cop'] == 0
    assert response.data['is_active'] is True
    assert NutritionProduct.objects.count() == 1


@pytest.mark.django_db
def test_get_returns_the_existing_row_without_creating_another(api_client, admin_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.data['price_cop'] == 30000
    assert NutritionProduct.objects.count() == 1


@pytest.mark.django_db
def test_get_counts_active_subscriptions_with_nutrition(api_client, admin_user, existing_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    package = Package.objects.create(title='Plan', sessions_count=4)
    now = timezone.now()
    Subscription.objects.create(
        customer=existing_user, package=package, sessions_total=4,
        starts_at=now, expires_at=now + timedelta(days=30),
        status=Subscription.Status.ACTIVE, includes_nutrition=True,
    )
    Subscription.objects.create(
        customer=admin_user, package=package, sessions_total=4,
        starts_at=now, expires_at=now + timedelta(days=30),
        status=Subscription.Status.ACTIVE, includes_nutrition=False,
    )
    api_client.force_authenticate(user=admin_user)

    response = api_client.get(reverse(URL_NAME))

    assert response.data['active_nutrition_subscriptions'] == 1


@pytest.mark.django_db
def test_patch_updates_the_price(api_client, admin_user):
    product = NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(reverse(URL_NAME), {'price_cop': 45000}, format='json')

    assert response.status_code == status.HTTP_200_OK
    assert response.data['price_cop'] == 45000
    product.refresh_from_db()
    assert product.price_cop == 45000


@pytest.mark.django_db
def test_patch_rejects_a_negative_price(api_client, admin_user):
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    api_client.force_authenticate(user=admin_user)

    response = api_client.patch(reverse(URL_NAME), {'price_cop': -1}, format='json')

    assert response.status_code == status.HTTP_400_BAD_REQUEST
```

- [ ] **Step 2: Write the serializer**

Create `backend/core_app/serializers/nutrition_product_serializers.py`:

```python
from rest_framework import serializers

from core_app.models.nutrition_product import NutritionProduct


class NutritionProductSerializer(serializers.ModelSerializer):
    class Meta:
        model = NutritionProduct
        fields = ('id', 'name', 'price_cop', 'is_active')
```

`price_cop` is a `PositiveIntegerField`, so DRF already rejects negatives with a 400 — no custom validator needed.

- [ ] **Step 3: Write the view**

Create `backend/core_app/views/admin_nutrition_views.py`:

```python
"""Admin-only management of the nutrition add-on price (a single active row)."""

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import Subscription
from core_app.models.nutrition_product import NutritionProduct
from core_app.permissions import IsAdminRole
from core_app.serializers.nutrition_product_serializers import NutritionProductSerializer

DEFAULT_NAME = 'Nutrición'
DEFAULT_PRICE_COP = 0


def _load_product() -> NutritionProduct:
    """Return the add-on row, preferring the active one, creating it if absent.

    An inactive-only row is reused rather than shadowed by a new one, so the
    admin can reactivate it instead of silently accumulating duplicates.
    """
    product = (
        NutritionProduct.objects.filter(is_active=True).first()
        or NutritionProduct.objects.order_by('-created_at').first()
    )
    if product:
        return product
    return NutritionProduct.objects.create(
        name=DEFAULT_NAME, price_cop=DEFAULT_PRICE_COP, is_active=True,
    )


def _active_nutrition_subscriptions() -> int:
    return Subscription.objects.filter(
        status=Subscription.Status.ACTIVE, includes_nutrition=True,
    ).count()


class AdminNutritionProductView(APIView):
    """GET/PATCH /api/admin/nutrition-product/

    `nutrition_surcharge()` reads this price at charge time, so a change here
    hits every nutrition subscriber's next renewal. `active_nutrition_subscriptions`
    is the blast radius the admin UI confirms against before saving.
    """

    permission_classes = [IsAuthenticated, IsAdminRole]

    def get(self, request):
        return Response(self._payload(NutritionProductSerializer(_load_product()).data))

    def patch(self, request):
        serializer = NutritionProductSerializer(_load_product(), data=request.data, partial=True)
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(self._payload(serializer.data))

    def _payload(self, data):
        return {**data, 'active_nutrition_subscriptions': _active_nutrition_subscriptions()}
```

- [ ] **Step 4: Wire the URL**

In `backend/core_app/urls/api_urls.py`, add the import next to the other view imports (they are alphabetical by module):

```python
from core_app.views.admin_nutrition_views import AdminNutritionProductView
```

and add the path right beside the other `admin/` path:

```python
    path('admin/nutrition-product/', AdminNutritionProductView.as_view(), name='admin-nutrition-product'),
```

- [ ] **Step 5: Verify wiring**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/serializers/nutrition_product_serializers.py backend/core_app/views/admin_nutrition_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_admin_nutrition_views.py
git -C /home/cerrotico/work/kore_project commit -m "feat(admin): singleton endpoint for the nutrition add-on price

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: `adminNutritionStore`

**Files:**
- Create: `frontend/lib/stores/adminNutritionStore.ts`
- Test: `frontend/app/__tests__/stores/adminNutritionStore.test.ts`

**Interfaces:**
- Consumes: `GET`/`PATCH /admin/nutrition-product/` from Task 2.
- Produces: `useAdminNutritionStore` with `{ product: NutritionProduct | null, activeSubscriptions: number, loading, actionLoading, error, fetchProduct(), updateProduct({price_cop, is_active}) }`. `updateProduct` resolves to `boolean`. Task 5 consumes these exact names.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/__tests__/stores/adminNutritionStore.test.ts`:

```ts
import { api } from '@/lib/services/http';
import { useAdminNutritionStore } from '@/lib/stores/adminNutritionStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), patch: jest.fn() },
  // The store calls this in its catch block; without it the rejection path throws.
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; patch: jest.Mock };

const PRODUCT = {
  id: 1,
  name: 'Nutrición',
  price_cop: 30000,
  is_active: true,
  active_nutrition_subscriptions: 7,
};

beforeEach(() => {
  jest.clearAllMocks();
  useAdminNutritionStore.setState({
    product: null,
    activeSubscriptions: 0,
    loading: false,
    actionLoading: false,
    error: '',
  });
});

test('fetchProduct stores the product and the impact count', async () => {
  mockApi.get.mockResolvedValue({ data: PRODUCT });

  await useAdminNutritionStore.getState().fetchProduct();

  const state = useAdminNutritionStore.getState();
  expect(mockApi.get).toHaveBeenCalledWith('/admin/nutrition-product/', expect.anything());
  expect(state.product?.price_cop).toBe(30000);
  expect(state.activeSubscriptions).toBe(7);
  expect(state.loading).toBe(false);
});

test('updateProduct patches the price and refreshes the state', async () => {
  useAdminNutritionStore.setState({ product: PRODUCT, activeSubscriptions: 7 });
  mockApi.patch.mockResolvedValue({
    data: { ...PRODUCT, price_cop: 45000, active_nutrition_subscriptions: 7 },
  });

  const ok = await useAdminNutritionStore.getState().updateProduct({
    price_cop: 45000,
    is_active: true,
  });

  expect(ok).toBe(true);
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/admin/nutrition-product/',
    { price_cop: 45000, is_active: true },
    expect.anything(),
  );
  expect(useAdminNutritionStore.getState().product?.price_cop).toBe(45000);
});

test('updateProduct surfaces an error and returns false on failure', async () => {
  useAdminNutritionStore.setState({ product: PRODUCT });
  mockApi.patch.mockRejectedValue(new Error('boom'));

  const ok = await useAdminNutritionStore.getState().updateProduct({
    price_cop: 45000,
    is_active: true,
  });

  expect(ok).toBe(false);
  expect(useAdminNutritionStore.getState().error).not.toBe('');
  expect(useAdminNutritionStore.getState().actionLoading).toBe(false);
});
```

- [ ] **Step 2: Write the store**

Create `frontend/lib/stores/adminNutritionStore.ts`:

```ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type NutritionProduct = {
  id: number;
  name: string;
  price_cop: number;
  is_active: boolean;
};

export type NutritionProductPayload = {
  price_cop: number;
  is_active: boolean;
};

type AdminNutritionState = {
  product: NutritionProduct | null;
  /** Active subscriptions with nutrition — the blast radius of a price change. */
  activeSubscriptions: number;
  loading: boolean;
  actionLoading: boolean;
  error: string;

  fetchProduct: () => Promise<void>;
  updateProduct: (payload: NutritionProductPayload) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useAdminNutritionStore = create<AdminNutritionState>((set) => ({
  product: null,
  activeSubscriptions: 0,
  loading: false,
  actionLoading: false,
  error: '',

  fetchProduct: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/admin/nutrition-product/', { headers: authHeaders() });
      const { active_nutrition_subscriptions: count, ...product } = data;
      set({
        product: product as NutritionProduct,
        activeSubscriptions: count ?? 0,
        loading: false,
      });
    } catch {
      set({ error: 'No se pudo cargar el precio de nutrición.', loading: false });
    }
  },

  updateProduct: async (payload) => {
    set({ actionLoading: true, error: '' });
    try {
      const { data } = await api.patch('/admin/nutrition-product/', payload, {
        headers: authHeaders(),
      });
      const { active_nutrition_subscriptions: count, ...product } = data;
      set({
        product: product as NutritionProduct,
        activeSubscriptions: count ?? 0,
        actionLoading: false,
      });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err, 'No se pudo guardar el precio de nutrición.'),
        actionLoading: false,
      });
      return false;
    }
  },
}));
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/lib/stores/adminNutritionStore.ts frontend/app/__tests__/stores/adminNutritionStore.test.ts
git -C /home/cerrotico/work/kore_project commit -m "feat(admin): adminNutritionStore for the add-on price

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `includes_nutrition` on `adminPackageStore`

**Files:**
- Modify: `frontend/lib/stores/adminPackageStore.ts`
- Test: `frontend/app/__tests__/stores/adminNutritionStore.test.ts` (a `toggleNutrition` block appended to the same file — both stores serve the same page)

**Interfaces:**
- Consumes: `PATCH /packages/{id}/` accepting `includes_nutrition` (Task 1).
- Produces: `AdminPackage.includes_nutrition: boolean`, `PackagePayload.includes_nutrition?: boolean`, and `toggleNutrition(id: number, next: boolean) => Promise<boolean>` (optimistic, rolls back on error). Task 5 consumes `toggleNutrition`.

- [ ] **Step 1: Write the failing test**

Append to `frontend/app/__tests__/stores/adminNutritionStore.test.ts`:

```ts
import { useAdminPackageStore } from '@/lib/stores/adminPackageStore';

const PACKAGE = {
  id: 101,
  title: 'Plan Base',
  short_description: '',
  description: '',
  category: 'personalizado' as const,
  sessions_count: 8,
  session_duration_minutes: 60,
  price: '300000',
  currency: 'COP',
  includes_nutrition: false,
  validity_days: 30,
  terms_and_conditions: '',
  is_active: true,
  order: 1,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

test('toggleNutrition patches the package and keeps the new value', async () => {
  useAdminPackageStore.setState({ packages: [PACKAGE] });
  mockApi.patch.mockResolvedValue({ data: { ...PACKAGE, includes_nutrition: true } });

  const ok = await useAdminPackageStore.getState().toggleNutrition(101, true);

  expect(ok).toBe(true);
  expect(mockApi.patch).toHaveBeenCalledWith(
    '/packages/101/',
    { includes_nutrition: true },
    expect.anything(),
  );
  expect(useAdminPackageStore.getState().packages[0].includes_nutrition).toBe(true);
});

test('toggleNutrition rolls back when the request fails', async () => {
  useAdminPackageStore.setState({ packages: [PACKAGE] });
  mockApi.patch.mockRejectedValue(new Error('boom'));

  const ok = await useAdminPackageStore.getState().toggleNutrition(101, true);

  expect(ok).toBe(false);
  expect(useAdminPackageStore.getState().packages[0].includes_nutrition).toBe(false);
});
```

- [ ] **Step 2: Add the field to both types**

In `frontend/lib/stores/adminPackageStore.ts`, add to `AdminPackage` right after `currency: string;`:

```ts
  includes_nutrition: boolean;
```

and to `PackagePayload` right after `currency?: string;`:

```ts
  includes_nutrition?: boolean;
```

- [ ] **Step 3: Declare and implement `toggleNutrition`**

Add to the `AdminPackageState` type, right after the `toggleActive` line:

```ts
  toggleNutrition: (id: number, next: boolean) => Promise<boolean>;
```

and add the action to the store body, right after `toggleActive`. It mirrors `toggleActive` — optimistic update, rollback on error:

```ts
  toggleNutrition: async (id, next) => {
    const before = get().packages;
    set({
      packages: before.map((p) => (p.id === id ? { ...p, includes_nutrition: next } : p)),
      actionLoading: true,
      error: '',
    });
    try {
      const { data } = await api.patch(
        `/packages/${id}/`,
        { includes_nutrition: next },
        { headers: authHeaders() },
      );
      const pkg = data as AdminPackage;
      set((state) => ({
        packages: state.packages.map((p) => (p.id === id ? pkg : p)),
        actionLoading: false,
      }));
      return true;
    } catch (err) {
      const msg = describeError(err, 'No se pudo cambiar la nutrición del plan.');
      set({ packages: before, actionLoading: false, error: msg });
      return false;
    }
  },
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/lib/stores/adminPackageStore.ts frontend/app/__tests__/stores/adminNutritionStore.test.ts
git -C /home/cerrotico/work/kore_project commit -m "feat(admin): toggleNutrition action on adminPackageStore

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: The `/admin-platform/nutricion` page and its nav entries

**Files:**
- Create: `frontend/app/admin-platform/nutricion/page.tsx`
- Create: `frontend/app/admin-platform/nutricion/NutritionAdminClient.tsx`
- Modify: `frontend/app/components/admin/AdminSidebar.tsx`
- Modify: `frontend/app/components/layouts/AdminMobileBottomNav.tsx`

**Interfaces:**
- Consumes: `useAdminNutritionStore` (Task 3) and `useAdminPackageStore.toggleNutrition` (Task 4).
- Produces: the testids Task 6 asserts on — `nutrition-admin`, `nutrition-price-input`, `nutrition-active-toggle`, `nutrition-save`, `nutrition-confirm-dialog`, and `nutrition-toggle-{packageId}`.

- [ ] **Step 1: Write the page shell**

Create `frontend/app/admin-platform/nutricion/page.tsx` (mirrors `admin-platform/plans/page.tsx`):

```tsx
import NutritionAdminClient from './NutritionAdminClient';

export default function AdminNutritionPage() {
  return <NutritionAdminClient />;
}
```

- [ ] **Step 2: Write the client component**

Create `frontend/app/admin-platform/nutricion/NutritionAdminClient.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import AdminShell from '@/app/components/admin/AdminShell';
import Btn from '@/app/components/admin/Btn';
import Card from '@/app/components/admin/Card';
import Field from '@/app/components/admin/Field';
import Input from '@/app/components/admin/Input';
import Modal from '@/app/components/admin/Modal';
import Toggle from '@/app/components/admin/Toggle';
import { useAdminNutritionStore } from '@/lib/stores/adminNutritionStore';
import { useAdminPackageStore } from '@/lib/stores/adminPackageStore';

const COP = new Intl.NumberFormat('es-CO');

export default function NutritionAdminClient() {
  const product = useAdminNutritionStore((s) => s.product);
  const activeSubscriptions = useAdminNutritionStore((s) => s.activeSubscriptions);
  const loading = useAdminNutritionStore((s) => s.loading);
  const actionLoading = useAdminNutritionStore((s) => s.actionLoading);
  const storeError = useAdminNutritionStore((s) => s.error);
  const fetchProduct = useAdminNutritionStore((s) => s.fetchProduct);
  const updateProduct = useAdminNutritionStore((s) => s.updateProduct);

  const packages = useAdminPackageStore((s) => s.packages);
  const fetchPackages = useAdminPackageStore((s) => s.fetchPackages);
  const toggleNutrition = useAdminPackageStore((s) => s.toggleNutrition);

  // The price is edited as a raw string so the admin can clear and retype it;
  // validation happens on save, not on every keystroke.
  const [price, setPrice] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [formError, setFormError] = useState('');
  const [confirmOpen, setConfirmOpen] = useState(false);

  useEffect(() => {
    fetchProduct();
    fetchPackages();
  }, [fetchProduct, fetchPackages]);

  useEffect(() => {
    if (!product) return;
    setPrice(String(product.price_cop));
    setIsActive(product.is_active);
  }, [product]);

  const priceChanged = !!product && Number(price) !== product.price_cop;

  const persist = async () => {
    setConfirmOpen(false);
    await updateProduct({ price_cop: Number(price), is_active: isActive });
  };

  const handleSave = () => {
    const value = Number(price);
    if (!price.trim() || !Number.isInteger(value) || value < 0) {
      setFormError('El precio debe ser un número entero en COP, mayor o igual a 0.');
      return;
    }
    setFormError('');
    // A price change hits every nutrition subscriber's next renewal — confirm first.
    if (priceChanged) {
      setConfirmOpen(true);
      return;
    }
    persist();
  };

  return (
    <AdminShell
      breadcrumb={[
        { label: 'Panel de administración', href: '/admin-platform/dashboard' },
        { label: 'Nutrición' },
      ]}
      title="Gestión de nutrición"
    >
      <div data-testid="nutrition-admin" className="space-y-6">
        {storeError && (
          <p className="text-[13px] font-semibold text-kore-red">{storeError}</p>
        )}

        <Card className="p-5 space-y-4">
          <div>
            <h2 className="text-[15px] font-bold text-kore-burgundy">Add-on Nutrición</h2>
            <p className="text-[12px] text-kore-burgundy/60">
              Precio mensual que se suma al cobro recurrente de quien contrata nutrición.
            </p>
          </div>

          <Field
            label="Precio mensual (COP)"
            required
            error={formError}
            hint={`${activeSubscriptions} suscripción(es) activa(s) con nutrición.`}
          >
            <Input
              data-testid="nutrition-price-input"
              inputMode="numeric"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              disabled={loading}
            />
          </Field>

          <div className="flex items-center gap-3">
            <span data-testid="nutrition-active-toggle">
              <Toggle
                checked={isActive}
                onChange={() => setIsActive(!isActive)}
                label={isActive ? 'Add-on activo' : 'Add-on inactivo'}
              />
            </span>
            <span className="text-[13px] font-semibold text-kore-burgundy">
              {isActive ? 'Activo' : 'Inactivo'}
            </span>
          </div>

          <Btn
            data-testid="nutrition-save"
            variant="primary"
            onClick={handleSave}
            disabled={actionLoading || loading}
          >
            Guardar precio
          </Btn>
        </Card>

        <Card className="p-5 space-y-3">
          <div>
            <h2 className="text-[15px] font-bold text-kore-burgundy">
              Planes que incluyen nutrición
            </h2>
            <p className="text-[12px] text-kore-burgundy/60">
              Quien contrate uno de estos planes recibe nutrición desde el día uno.
            </p>
          </div>

          {packages.length === 0 ? (
            <p className="text-[13px] text-kore-burgundy/60">No hay planes cargados.</p>
          ) : (
            <ul className="divide-y divide-kore-burgundy/10">
              {packages.map((pkg) => (
                <li key={pkg.id} className="flex items-center justify-between gap-3 py-3">
                  <div>
                    <p className="text-[14px] font-semibold text-kore-burgundy">{pkg.title}</p>
                    <p className="text-[12px] text-kore-burgundy/60">
                      {COP.format(Math.trunc(Number(pkg.price) || 0))} COP
                    </p>
                  </div>
                  <span data-testid={`nutrition-toggle-${pkg.id}`}>
                    <Toggle
                      checked={pkg.includes_nutrition}
                      onChange={() => toggleNutrition(pkg.id, !pkg.includes_nutrition)}
                      label={`Nutrición en ${pkg.title}`}
                    />
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {confirmOpen && (
        <div data-testid="nutrition-confirm-dialog">
          <Modal
            title="Confirmar cambio de precio"
            body={
              <p className="text-[13px] text-kore-burgundy/80">
                Esto cambiará el cobro de {activeSubscriptions} suscripción(es) activa(s) con
                nutrición en su próxima renovación.
              </p>
            }
            confirmLabel="Confirmar cambio"
            cancelLabel="Cancelar"
            loading={actionLoading}
            onClose={() => setConfirmOpen(false)}
            onConfirm={persist}
          />
        </div>
      )}
    </AdminShell>
  );
}
```

- [ ] **Step 3: Add the sidebar entry**

In `frontend/app/components/admin/AdminSidebar.tsx`, add the icon after `ChartIcon`:

```tsx
const NutritionIcon = (
  <svg {...iconProps}>
    <path d="M12 21c-4 0-7-3.5-7-8 0-3 2-6 5-6 1.2 0 2 .5 2 .5s.8-.5 2-.5c3 0 5 3 5 6 0 4.5-3 8-7 8z" />
    <path d="M12 7V3M12 3l2.5 1.5" />
  </svg>
);
```

and the nav item into `NAV_GROUPS`, between `plans` and `reports`:

```tsx
      { key: 'nutrition', label: 'Nutrición', href: '/admin-platform/nutricion', icon: NutritionIcon },
```

- [ ] **Step 4: Add the mobile nav entry**

In `frontend/app/components/layouts/AdminMobileBottomNav.tsx`, add the same icon after `ChartIcon`:

```tsx
const NutritionIcon = (
  <svg {...iconProps}>
    <path d="M12 21c-4 0-7-3.5-7-8 0-3 2-6 5-6 1.2 0 2 .5 2 .5s.8-.5 2-.5c3 0 5 3 5 6 0 4.5-3 8-7 8z" />
    <path d="M12 7V3M12 3l2.5 1.5" />
  </svg>
);
```

and make it the first entry of `MORE_ITEMS` (the four bottom tabs stay as they are — nutrition is a low-frequency admin task):

```tsx
const MORE_ITEMS: MobileNavMoreItem[] = [
  { key: 'nutrition', label: 'Nutrición', icon: NutritionIcon, href: '/admin-platform/nutricion' },
  { key: 'reports', label: 'Reportes', icon: ChartIcon, disabled: true },
];
```

- [ ] **Step 5: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/app/admin-platform/nutricion frontend/app/components/admin/AdminSidebar.tsx frontend/app/components/layouts/AdminMobileBottomNav.tsx
git -C /home/cerrotico/work/kore_project commit -m "feat(admin): nutrition management page + nav entries

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: E2E spec and the flow triplet

**Files:**
- Create: `frontend/e2e/admin/admin-nutrition.spec.ts`
- Modify: `frontend/e2e/helpers/flow-tags.ts`
- Modify: `frontend/e2e/flow-definitions.json`
- Modify: `docs/USER_FLOW_MAP.md`

**Interfaces:**
- Consumes: the testids from Task 5, `mockLoginAsAdmin` from `e2e/helpers/admin-auth`, and the endpoints from Tasks 1–2.
- Produces: the `admin-nutrition` flow, registered in all three triplet files.

The three triplet files must always change together, and both versions get bumped — a CI job (`e2e-flow-definitions-sync`) checks it.

- [ ] **Step 1: Add the flow tag**

In `frontend/e2e/helpers/flow-tags.ts`, add after the `ADMIN_PLANS` line:

```ts
  ADMIN_NUTRITION: ['@flow:admin-nutrition', '@module:admin', '@priority:P2'],
```

- [ ] **Step 2: Register the flow definition**

In `frontend/e2e/flow-definitions.json`, bump `"version"` to `"1.7.0"` and `"lastUpdated"` to `"2026-07-14"`, then add this entry to the `"flows"` object (it is a dict keyed by flow id):

```json
  "admin-nutrition": {
    "name": "Admin Nutrition Add-on",
    "module": "admin",
    "priority": "P2",
    "roles": ["admin"],
    "description": "Manage the nutrition add-on at /admin-platform/nutricion: edit the monthly COP price (confirming the impact on active subscriptions), toggle the add-on active, and flip includes_nutrition per plan.",
    "coverage": "covered"
  },
```

- [ ] **Step 3: Document the flow**

In `docs/USER_FLOW_MAP.md`, bump the `Version` to `2.0` and `Last Updated` to `2026-07-14` in the header, then add this section at the top of `## Admin Flows`:

```markdown
### admin-nutrition: Admin Nutrition Add-on

**Route:** `/admin-platform/nutricion` · **Priority:** P2 · **Role:** admin

1. The admin opens **Nutrición** from the sidebar (or from *Más* on mobile).
2. **Add-on Nutrición** shows the monthly COP price and an active/inactive toggle, plus how many active subscriptions carry nutrition.
3. Changing the price and saving opens a confirmation dialog stating the impact — `nutrition_surcharge()` reads the active price at charge time, so the change lands on every nutrition subscriber's next renewal. Confirming issues `PATCH /api/admin/nutrition-product/`.
4. **Planes que incluyen nutrición** lists every plan with a per-row switch that issues `PATCH /api/packages/{id}/` with `includes_nutrition`.

**E2E:** `e2e/admin/admin-nutrition.spec.ts`
```

- [ ] **Step 4: Write the E2E spec**

Create `frontend/e2e/admin/admin-nutrition.spec.ts`:

```ts
import { test, expect } from '../fixtures';
import { mockLoginAsAdmin } from '../helpers/admin-auth';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:admin-nutrition
 * Admin nutrition add-on: edit the monthly price behind a confirmation dialog,
 * and flip includes_nutrition on a plan.
 */

const PRODUCT = {
  id: 1,
  name: 'Nutrición',
  price_cop: 30000,
  is_active: true,
  active_nutrition_subscriptions: 7,
};

const PACKAGE = {
  id: 101,
  title: 'Plan Base Personalizado',
  short_description: '',
  description: '',
  category: 'personalizado',
  sessions_count: 8,
  session_duration_minutes: 60,
  price: '300000',
  currency: 'COP',
  includes_nutrition: false,
  validity_days: 30,
  terms_and_conditions: '',
  is_active: true,
  order: 1,
  created_at: '2026-06-01T10:00:00Z',
  updated_at: '2026-06-01T10:00:00Z',
};

test.describe('Admin Nutrition', { tag: [...FlowTags.ADMIN_NUTRITION, RoleTags.ADMIN] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await mockLoginAsAdmin(page);
    await page.route('**/api/packages/**', (route) => {
      if (route.request().method() === 'PATCH') {
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...PACKAGE, includes_nutrition: true }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ count: 1, next: null, previous: null, results: [PACKAGE] }),
      });
    });
  });

  test('changing the price asks for confirmation and saves', async ({ page }) => {
    let patched: Record<string, unknown> | null = null;
    await page.route('**/api/admin/nutrition-product/', (route) => {
      if (route.request().method() === 'PATCH') {
        patched = route.request().postDataJSON();
        return route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...PRODUCT, price_cop: 45000 }),
        });
      }
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      });
    });

    await page.goto('/admin-platform/nutricion');
    await expect(page.getByTestId('nutrition-admin')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('nutrition-price-input')).toHaveValue('30000');

    await page.getByTestId('nutrition-price-input').fill('45000');
    await page.getByTestId('nutrition-save').click();

    // The impact of the change is stated before it is committed.
    await expect(page.getByTestId('nutrition-confirm-dialog')).toBeVisible();
    await expect(page.getByText('7 suscripción(es) activa(s)')).toBeVisible();

    await page.getByRole('button', { name: 'Confirmar cambio' }).click();
    await expect(page.getByTestId('nutrition-confirm-dialog')).not.toBeVisible();
    expect(patched).toEqual({ price_cop: 45000, is_active: true });
  });

  test('toggles includes_nutrition on a plan', async ({ page }) => {
    await page.route('**/api/admin/nutrition-product/', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(PRODUCT),
      }),
    );

    await page.goto('/admin-platform/nutricion');
    await expect(page.getByTestId('nutrition-admin')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Plan Base Personalizado')).toBeVisible();

    const toggle = page.getByTestId('nutrition-toggle-101').getByRole('switch');
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
  });
});
```

- [ ] **Step 5: Validate the JSON**

Run: `cd frontend && python3 -c "import json; d=json.load(open('e2e/flow-definitions.json')); print(d['version'], 'admin-nutrition' in d['flows'])"`
Expected: `1.7.0 True`

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/e2e/admin/admin-nutrition.spec.ts frontend/e2e/helpers/flow-tags.ts frontend/e2e/flow-definitions.json docs/USER_FLOW_MAP.md
git -C /home/cerrotico/work/kore_project commit -m "test(admin): E2E + flow triplet for nutrition management

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Release guides

**Files:**
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md`
- Modify: `docs/release-july/GUIA_QA_STAGING.md`

**Interfaces:**
- Consumes: the behavior shipped in Tasks 1–6.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the validation-guide entry**

In `docs/release-july/GUIA_DE_VALIDACION.md`, inside the existing `## Extra` area (next to the trainer task-hub entry added for Gap #1), add a numbered functionality block in the same voice as its neighbours: an admin opens **Nutrición** in the sidebar, edits the monthly price, confirms the dialog stating how many active subscriptions it affects, and flips **Incluye nutrición** on a plan. State the expected result: the plan's new subscribers get nutrition, and existing nutrition subscribers pay the new price on their next renewal.

- [ ] **Step 2: Add the QA-staging entry**

In `docs/release-july/GUIA_QA_STAGING.md`, add a `### Admin — Nutrición` subsection under the same section that holds the other admin checks, listing: the price loads from the backend; saving without changing the price does not open the dialog; changing it does; the count in the dialog matches active subscriptions with nutrition; a per-plan toggle persists after a reload.

- [ ] **Step 3: Commit**

```bash
git -C /home/cerrotico/work/kore_project add docs/release-july/GUIA_DE_VALIDACION.md docs/release-july/GUIA_QA_STAGING.md
git -C /home/cerrotico/work/kore_project commit -m "docs(release): admin nutrition management in validation + QA guides

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Finishing

After all tasks are committed:

1. Run the `e2e-user-flows-check` skill (a frontend user flow changed: a new page plus a new admin form).
2. Use `superpowers:finishing-a-development-branch` to push and open the PR against **`july-release`** (not `master`).
3. Report the PR URL.
