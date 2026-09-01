# Part 5 — Store Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let trainers manage store-item media (image/title/description) from their own UI and require a delivery-verification photo when fulfilling `producto`/`servicio` redemptions, which the client sees in "Mis canjes"; remove the `descuento` item type.

**Architecture:** Additive on the Part 4 store (models/serializers/views/pages, already on `july-release`). Backend: one `ImageField` on `RedemptionRequest`, a narrowed `item_type`, a multipart review endpoint that enforces the photo for physical/service items. Frontend: multipart item create/edit, a photo dialog on "Entregar", and the comprobante shown in "Mis canjes".

**Tech Stack:** Django 6 + DRF (MultiPartParser, ImageField), Next.js 16 App Router, Zustand 5, Axios (`@/lib/services/http`), Jest, Playwright.

## Global Constraints

- Branch: `feat/04072026-phase5-store-enrichment` (already based on `july-release`; PR targets `july-release`).
- Commit messages end with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Django module is `core_project`; single app `core_app`. Do not edit old migrations; add new ones.
- Image size cap: **5 MB** (`MAX_IMAGE_BYTES = 5 * 1024 * 1024`), shared between `StoreItem.image` and `RedemptionRequest.delivery_photo`.
- `item_type` after this part: `servicio | producto | sesion_adicional` (no `descuento`).
- Delivery photo is **required** to fulfill `producto`/`servicio`; **not used** for `sesion_adicional`.
- `(app)` page containers use the dashboard padding pattern (`px-5 xl:px-10 pt-20`), never `max-w-*`.
- Don't run the full suite. Backend pytest and the store-only Jest run locally; component/E2E verified by CI.
- User-facing strings in Spanish.

---

### Task 1: Model — `delivery_photo` + remove `descuento` (migrations)

**Files:**
- Modify: `backend/core_app/models/store.py:10-14` (remove `DESCUENTO`), `:49` (add `delivery_photo`)
- Create: `backend/core_app/migrations/0061_store_delivery_photo.py` (via makemigrations), `backend/core_app/migrations/0062_remap_descuento_items.py` (hand-written data migration)
- Test: `backend/core_app/tests/models/test_store_models.py` (append)

**Interfaces:**
- Produces: `RedemptionRequest.delivery_photo` (`ImageField`, nullable); `StoreItem.ItemType` without `DESCUENTO`.

- [ ] **Step 1: Write the failing test** — append to `backend/core_app/tests/models/test_store_models.py`:

```python
def test_item_type_has_no_descuento():
    from core_app.models.store import StoreItem
    assert 'descuento' not in StoreItem.ItemType.values


@pytest.mark.django_db
def test_redemption_has_delivery_photo_field():
    from core_app.models.store import StoreItem, RedemptionRequest
    from core_app.models import User
    u = User.objects.create_user(email='m@example.com', password='x', first_name='M', last_name='N')
    item = StoreItem.objects.create(name='X', price_credits=10, item_type='servicio')
    req = RedemptionRequest.objects.create(customer=u, item=item, credits_spent=10)
    assert req.delivery_photo.name in (None, '')  # unset by default
```

(If `test_store_models.py` lacks `import pytest`, add it at the top.)

- [ ] **Step 2: Run to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/models/test_store_models.py -q`
Expected: FAIL (`'descuento' in values`, and/or `delivery_photo` attribute error).

- [ ] **Step 3: Edit the model** — in `backend/core_app/models/store.py`, change the `ItemType` block to drop `DESCUENTO`:

```python
    class ItemType(models.TextChoices):
        SERVICIO = 'servicio', 'Servicio'
        PRODUCTO = 'producto', 'Producto físico'
        SESION = 'sesion_adicional', 'Sesión adicional'
```

And add the field to `RedemptionRequest`, right after `resolved_at` (line 49):

```python
    delivery_photo = models.ImageField(upload_to='redemption_deliveries/', null=True, blank=True)
```

- [ ] **Step 4: Generate the schema migration**

Run: `cd backend && source venv/bin/activate && python manage.py makemigrations core_app -n store_delivery_photo`
Expected: creates `core_app/migrations/0061_store_delivery_photo.py` (AddField `delivery_photo`, AlterField `item_type`).

- [ ] **Step 5: Hand-write the data migration** — create `backend/core_app/migrations/0062_remap_descuento_items.py`:

```python
from django.db import migrations


def remap_descuento(apps, schema_editor):
    StoreItem = apps.get_model('core_app', 'StoreItem')
    StoreItem.objects.filter(item_type='descuento').update(item_type='servicio')


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0061_store_delivery_photo'),
    ]

    operations = [
        migrations.RunPython(remap_descuento, migrations.RunPython.noop),
    ]
```

- [ ] **Step 6: Apply migrations + run the test**

Run: `python manage.py migrate && pytest core_app/tests/models/test_store_models.py -q`
Expected: migrations apply cleanly; tests PASS.

- [ ] **Step 7: Commit**

```bash
git add backend/core_app/models/store.py backend/core_app/migrations/0061_store_delivery_photo.py backend/core_app/migrations/0062_remap_descuento_items.py backend/core_app/tests/models/test_store_models.py
git commit -m "feat(store): RedemptionRequest.delivery_photo + drop descuento item type

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Serializer — `delivery_photo_url`

**Files:**
- Modify: `backend/core_app/serializers/store_serializers.py:29-43`
- Test: `backend/core_app/tests/serializers/test_store_serializers.py` (create)

**Interfaces:**
- Consumes: `RedemptionRequest.delivery_photo` (Task 1).
- Produces: `RedemptionRequestSerializer` emits `delivery_photo_url` (absolute URL or `None`). `MAX_IMAGE_BYTES` remains importable from this module for the view (Task 3).

- [ ] **Step 1: Write the failing test** — create `backend/core_app/tests/serializers/test_store_serializers.py`:

```python
import pytest

from core_app.models import User
from core_app.models.store import StoreItem, RedemptionRequest
from core_app.serializers.store_serializers import RedemptionRequestSerializer


@pytest.mark.django_db
def test_delivery_photo_url_is_none_when_unset():
    u = User.objects.create_user(email='s@example.com', password='x', first_name='S', last_name='T')
    item = StoreItem.objects.create(name='X', price_credits=10, item_type='servicio')
    req = RedemptionRequest.objects.create(customer=u, item=item, credits_spent=10)
    data = RedemptionRequestSerializer(req).data
    assert data['delivery_photo_url'] is None
    assert 'delivery_photo_url' in data
```

- [ ] **Step 2: Run to verify it fails**

Run: `pytest core_app/tests/serializers/test_store_serializers.py -q`
Expected: FAIL with `KeyError: 'delivery_photo_url'`.

- [ ] **Step 3: Implement** — edit `RedemptionRequestSerializer` in `backend/core_app/serializers/store_serializers.py`:

```python
class RedemptionRequestSerializer(serializers.ModelSerializer):
    item_name = serializers.CharField(source='item.name', read_only=True)
    item_type = serializers.CharField(source='item.item_type', read_only=True)
    item_image_url = serializers.SerializerMethodField(read_only=True)
    delivery_photo_url = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = RedemptionRequest
        fields = ('id', 'item', 'item_name', 'item_type', 'item_image_url', 'credits_spent', 'status', 'trainer_note', 'delivery_photo_url', 'created_at', 'resolved_at')
        read_only_fields = ('credits_spent', 'status', 'trainer_note', 'resolved_at')

    def get_item_image_url(self, obj):
        if not obj.item.image:
            return None
        request = self.context.get('request')
        url = obj.item.image.url
        return request.build_absolute_uri(url) if request else url

    def get_delivery_photo_url(self, obj):
        if not obj.delivery_photo:
            return None
        request = self.context.get('request')
        url = obj.delivery_photo.url
        return request.build_absolute_uri(url) if request else url
```

- [ ] **Step 4: Run the test**

Run: `pytest core_app/tests/serializers/test_store_serializers.py -q`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/serializers/store_serializers.py backend/core_app/tests/serializers/test_store_serializers.py
git commit -m "feat(store): expose delivery_photo_url in redemption serializer

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: View — review endpoint multipart + mandatory photo + 5 MB

**Files:**
- Modify: `backend/core_app/views/store_views.py` (imports + `TrainerRedemptionReviewView`)
- Test: `backend/core_app/tests/views/test_store_views.py` (append)

**Interfaces:**
- Consumes: `RedemptionRequest.delivery_photo` (Task 1), `MAX_IMAGE_BYTES` (Task 2 module).
- Produces: `POST /api/trainer/store/redemptions/<pk>/review/` accepts multipart; `decision=fulfill` on `producto`/`servicio` requires `delivery_photo` (≤ 5 MB), else 400.

- [ ] **Step 1: Write the failing tests** — append to `backend/core_app/tests/views/test_store_views.py`:

```python
from django.core.files.uploadedfile import SimpleUploadedFile

# 1x1 transparent PNG
_PNG = (
    b'\x89PNG\r\n\x1a\n\x00\x00\x00\rIHDR\x00\x00\x00\x01\x00\x00\x00\x01\x08\x06'
    b'\x00\x00\x00\x1f\x15\xc4\x89\x00\x00\x00\nIDATx\x9cc\x00\x01\x00\x00\x05'
    b'\x00\x01\r\n-\xb4\x00\x00\x00\x00IEND\xaeB`\x82'
)


def _photo(name='d.png'):
    return SimpleUploadedFile(name, _PNG, content_type='image/png')


@pytest.mark.django_db
def test_fulfill_producto_requires_photo(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='P', price_credits=20, item_type='producto')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=20)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'fulfill'}, format='multipart')
    assert resp.status_code == 400
    req.refresh_from_db()
    assert req.status == 'pending'


@pytest.mark.django_db
def test_fulfill_producto_with_photo_ok(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='P', price_credits=20, item_type='producto')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=20)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'fulfill', 'delivery_photo': _photo()}, format='multipart')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'fulfilled'
    assert bool(req.delivery_photo)


@pytest.mark.django_db
def test_fulfill_sesion_adicional_no_photo_ok(api_client, trainer_user, assigned_customer):
    item = StoreItem.objects.create(name='S', price_credits=20, item_type='sesion_adicional')
    credit_engine.award(assigned_customer, CreditTransaction.Action.SESSION_ATTENDED, 'seed', '1', 'x', amount=100)
    req = RedemptionRequest.objects.create(customer=assigned_customer, item=item, credits_spent=20)
    api_client.force_authenticate(trainer_user)
    resp = api_client.post(f'/api/trainer/store/redemptions/{req.id}/review/', {'decision': 'fulfill'}, format='multipart')
    assert resp.status_code == 200
    req.refresh_from_db()
    assert req.status == 'fulfilled'
```

- [ ] **Step 2: Run to verify they fail**

Run: `pytest core_app/tests/views/test_store_views.py -q`
Expected: FAIL (producto-without-photo currently returns 200; `delivery_photo` not saved).

- [ ] **Step 3: Implement** — in `backend/core_app/views/store_views.py`, add imports near the top:

```python
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser

from core_app.serializers.store_serializers import (
    StoreItemSerializer, RedemptionRequestSerializer, MAX_IMAGE_BYTES,
)
```

(Replace the existing `from core_app.serializers.store_serializers import StoreItemSerializer, RedemptionRequestSerializer` line with the grouped import above.)

Then change `TrainerRedemptionReviewView` to accept multipart and enforce the photo. Replace the class body's `post` from the `decision == 'fulfill'` branch:

```python
class TrainerRedemptionReviewView(APIView):
    permission_classes = [IsTrainerRole]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

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
            requires_photo = req.item.item_type in (StoreItem.ItemType.PRODUCTO, StoreItem.ItemType.SERVICIO)
            photo = request.FILES.get('delivery_photo')
            if requires_photo:
                if photo is None:
                    return Response({'detail': 'La foto de entrega es obligatoria.'}, status=status.HTTP_400_BAD_REQUEST)
                if photo.size > MAX_IMAGE_BYTES:
                    return Response({'detail': 'La foto no puede superar 5MB.'}, status=status.HTTP_400_BAD_REQUEST)
            req.status = RedemptionRequest.Status.FULFILLED
            req.trainer_note = request.data.get('note', '')
            req.resolved_by = request.user
            req.resolved_at = timezone.now()
            if photo is not None:
                req.delivery_photo = photo
                req.save(update_fields=['status', 'trainer_note', 'resolved_by', 'resolved_at', 'delivery_photo', 'updated_at'])
            else:
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

- [ ] **Step 4: Run the tests (new + existing store view tests)**

Run: `pytest core_app/tests/views/test_store_views.py -q`
Expected: PASS (all — new photo tests plus the Part 4 tests still green; the Part 4 `test_trainer_fulfills_redemption` uses `item_type='servicio'` with `format='json'` and no photo → now 400. **Update it**: change that test's item to `item_type='sesion_adicional'` so the no-photo fulfill still returns 200. Locate `test_trainer_fulfills_redemption` and change `item_type='servicio'` → `item_type='sesion_adicional'`.)

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/store_views.py backend/core_app/tests/views/test_store_views.py
git commit -m "feat(store): require delivery photo to fulfill producto/servicio redemptions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `storeStore` — multipart `reviewRedemption` + `delivery_photo_url` type

**Files:**
- Modify: `frontend/lib/stores/storeStore.ts`
- Test: `frontend/app/__tests__/stores/storeStore.test.ts` (append)

**Interfaces:**
- Produces: `reviewRedemption(pk, decision, note?, deliveryPhoto?: File)` — sends multipart `FormData` when a photo is present, JSON otherwise. `Redemption` type gains `delivery_photo_url: string | null`.

- [ ] **Step 1: Write the failing test** — append to `frontend/app/__tests__/stores/storeStore.test.ts`:

```typescript
  it('reviewRedemption sends FormData when a photo is passed', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 7, status: 'fulfilled' } });
    const file = new File([new Uint8Array([1, 2, 3])], 'd.png', { type: 'image/png' });
    useStoreStore.setState({ pendingReviews: [{ id: 7 } as never] });
    const ok = await useStoreStore.getState().reviewRedemption(7, 'fulfill', undefined, file);
    expect(ok).toBe(true);
    const body = (api.post as jest.Mock).mock.calls[0][1];
    expect(body instanceof FormData).toBe(true);
  });

  it('reviewRedemption sends JSON when no photo is passed', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { id: 8, status: 'rejected' } });
    await useStoreStore.getState().reviewRedemption(8, 'reject', 'no hay');
    const body = (api.post as jest.Mock).mock.calls[0][1];
    expect(body instanceof FormData).toBe(false);
    expect(body).toEqual({ decision: 'reject', note: 'no hay' });
  });
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/storeStore.test.ts`
Expected: FAIL (current `reviewRedemption` always sends JSON `{decision, note}` and ignores a 4th arg).

- [ ] **Step 3: Implement** — in `frontend/lib/stores/storeStore.ts`:

Add `delivery_photo_url` to the `Redemption` type:

```typescript
export type Redemption = {
  id: number; item: number; item_name: string; item_type: string; item_image_url: string | null;
  credits_spent: number; status: 'pending' | 'fulfilled' | 'rejected';
  trainer_note: string; delivery_photo_url: string | null;
  created_at: string; resolved_at: string | null;
};
```

Update the `reviewRedemption` signature in the `StoreState` type:

```typescript
  reviewRedemption: (pk: number, decision: 'fulfill' | 'reject', note?: string, deliveryPhoto?: File) => Promise<boolean>;
```

Replace the `reviewRedemption` implementation:

```typescript
  reviewRedemption: async (pk, decision, note, deliveryPhoto) => {
    try {
      let body: FormData | { decision: string; note?: string };
      const headers = authHeaders();
      if (deliveryPhoto) {
        const fd = new FormData();
        fd.append('decision', decision);
        if (note) fd.append('note', note);
        fd.append('delivery_photo', deliveryPhoto);
        body = fd;
      } else {
        body = { decision, note };
      }
      await api.post(`/trainer/store/redemptions/${pk}/review/`, body, { headers });
      set((s) => ({ pendingReviews: s.pendingReviews.filter((r) => r.id !== pk) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo procesar la solicitud.') });
      return false;
    }
  },
```

- [ ] **Step 4: Run the test**

Run: `npx jest app/__tests__/stores/storeStore.test.ts`
Expected: PASS (all store tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/storeStore.ts frontend/app/__tests__/stores/storeStore.test.ts
git commit -m "feat(store): multipart reviewRedemption + delivery_photo_url type

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Trainer `/trainer/tienda` — create/edit multipart + remove descuento + delivery-photo dialog

**Files:**
- Modify: `frontend/app/(app)/trainer/tienda/page.tsx`
- Test: covered by E2E (Task 7)

**Interfaces:**
- Consumes: `useStoreStore` (`reviewRedemption` with photo, Task 4), `api` (multipart create/edit).

- [ ] **Step 1: Replace the page** — overwrite `frontend/app/(app)/trainer/tienda/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';
import { useStoreStore } from '@/lib/stores/storeStore';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

type AdminItem = { id: number; name: string; description: string; price_credits: number; item_type: string; is_active: boolean; image_url: string | null };

const TYPES = [
  { value: 'servicio', label: 'Servicio' },
  { value: 'producto', label: 'Producto' },
  { value: 'sesion_adicional', label: 'Sesión adicional' },
];

export default function TrainerTiendaPage() {
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();
  const [items, setItems] = useState<AdminItem[]>([]);
  const [editing, setEditing] = useState<AdminItem | null>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [type, setType] = useState('servicio');
  const [image, setImage] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Delivery-photo dialog state
  const [delivering, setDelivering] = useState<{ id: number; requiresPhoto: boolean } | null>(null);
  const deliverFileRef = useRef<HTMLInputElement>(null);
  const [deliverErr, setDeliverErr] = useState('');

  async function loadItems() {
    const { data } = await api.get('/trainer/store-items/', { headers: authHeaders() });
    setItems(Array.isArray(data) ? data : data.results ?? []);
  }
  useEffect(() => { loadItems(); fetchPendingReviews(); }, [fetchPendingReviews]);

  function resetForm() {
    setEditing(null); setName(''); setDescription(''); setPrice(''); setType('servicio'); setImage(null);
  }

  function startEdit(it: AdminItem) {
    setEditing(it); setName(it.name); setDescription(it.description || '');
    setPrice(String(it.price_credits)); setType(it.item_type); setImage(null); setError('');
  }

  async function saveItem() {
    setError('');
    const p = parseInt(price, 10);
    if (!name.trim() || !p || p <= 0) { setError('Nombre y precio (>0) son obligatorios.'); return; }
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append('name', name);
      fd.append('description', description);
      fd.append('price_credits', String(p));
      fd.append('item_type', type);
      if (image) fd.append('image', image);
      if (editing) {
        await api.patch(`/trainer/store-items/${editing.id}/`, fd, { headers: authHeaders() });
      } else {
        await api.post('/trainer/store-items/', fd, { headers: authHeaders() });
      }
      resetForm();
      await loadItems();
    } catch {
      setError('No se pudo guardar el ítem.');
    } finally { setSaving(false); }
  }

  async function toggleActive(it: AdminItem) {
    await api.patch(`/trainer/store-items/${it.id}/`, { is_active: !it.is_active }, { headers: authHeaders() });
    await loadItems();
  }

  function openDeliver(r: { id: number; item_type?: string }) {
    const requiresPhoto = r.item_type === 'producto' || r.item_type === 'servicio';
    setDeliverErr('');
    setDelivering({ id: r.id, requiresPhoto });
  }

  async function confirmDeliver() {
    if (!delivering) return;
    const file = deliverFileRef.current?.files?.[0];
    if (delivering.requiresPhoto && !file) { setDeliverErr('La foto de entrega es obligatoria.'); return; }
    const ok = await reviewRedemption(delivering.id, 'fulfill', undefined, file ?? undefined);
    if (ok) setDelivering(null);
    else setDeliverErr('No se pudo entregar. Intenta de nuevo.');
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
                <button onClick={() => openDeliver(r)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep">Entregar</button>
                <button onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600">Rechazar</button>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Catalog management */}
      <section className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50">{editing ? 'Editar ítem' : 'Nuevo ítem'}</p>
        {error && <p className="text-[12px] text-red-600 bg-red-50 rounded-xl px-3 py-2">{error}</p>}
        <div className="flex flex-wrap gap-2 items-end">
          <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Nombre" className="flex-1 min-w-[140px] rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <input value={price} onChange={(e) => setPrice(e.target.value)} placeholder="Precio" type="number" className="w-24 rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
          <select value={type} onChange={(e) => setType(e.target.value)} className="rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]">
            {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Descripción" rows={2} className="w-full rounded-xl border border-kore-gray-light/60 px-3 py-2 text-[13px]" />
        <div className="flex items-center gap-2 flex-wrap">
          <input type="file" accept="image/*" onChange={(e) => setImage(e.target.files?.[0] ?? null)} className="text-[12px]" data-testid="item-image-input" />
          <button onClick={saveItem} disabled={saving} className="rounded-xl bg-kore-red text-white px-4 py-2 text-[13px] font-medium disabled:opacity-60">
            {saving ? 'Guardando…' : editing ? 'Guardar cambios' : 'Agregar'}
          </button>
          {editing && <button onClick={resetForm} className="text-[12px] text-kore-gray-dark/60 px-2">Cancelar</button>}
        </div>
        <div className="divide-y divide-kore-gray-light/40 pt-2">
          {items.map((it) => (
            <div key={it.id} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[13px] font-semibold text-kore-gray-dark truncate">{it.name}</p>
                <p className="text-[11px] text-kore-gray-dark/45">{it.price_credits} créditos · {it.item_type}</p>
              </div>
              <button onClick={() => startEdit(it)} className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-gray-light/40 text-kore-gray-dark/70">Editar</button>
              <button onClick={() => toggleActive(it)} className={`text-[11px] font-bold px-2.5 py-1 rounded-full ${it.is_active ? 'bg-kore-sage/20 text-kore-sage-deep' : 'bg-kore-gray-light/40 text-kore-gray-dark/40'}`}>
                {it.is_active ? 'Activo' : 'Inactivo'}
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Delivery-photo dialog */}
      {delivering && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-6" style={{ background: 'rgba(45,15,26,0.45)' }}>
          <div className="bg-white rounded-3xl p-6 max-w-xs w-full" data-testid="deliver-dialog">
            <p className="font-heading text-[18px] font-semibold text-kore-wine-dark mb-1">Confirmar entrega</p>
            <p className="text-[12px] text-kore-gray-dark/60 mb-3">
              {delivering.requiresPhoto ? 'Sube una foto que verifique la entrega (obligatoria).' : 'Este canje no requiere foto.'}
            </p>
            {delivering.requiresPhoto && (
              <input ref={deliverFileRef} type="file" accept="image/*" className="text-[12px] mb-2" data-testid="deliver-photo-input" />
            )}
            {deliverErr && <p className="text-[12px] text-red-600 mb-2">{deliverErr}</p>}
            <div className="flex flex-col gap-2 mt-2">
              <button onClick={confirmDeliver} className="w-full py-2.5 rounded-2xl bg-kore-red text-white text-[13px] font-semibold">Entregar</button>
              <button onClick={() => setDelivering(null)} className="w-full py-2 text-[12px] text-kore-gray-dark/60">Cancelar</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/trainer/tienda/page.tsx"
git commit -m "feat(store): trainer item create/edit with image + delivery-photo dialog

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: `/mis-creditos` — show the comprobante in "Mis canjes"

**Files:**
- Modify: `frontend/app/(app)/mis-creditos/page.tsx` (the "Mis canjes" block)
- Test: covered by E2E (Task 7)

**Interfaces:**
- Consumes: `Redemption.delivery_photo_url` (Task 4).

- [ ] **Step 1: Add the comprobante link** — in `frontend/app/(app)/mis-creditos/page.tsx`, inside the "Mis canjes" map, the row currently ends with the status badge. Replace the row body so a comprobante link shows when present. Find:

```tsx
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-kore-gray-dark truncate">{r.item_name}</p>
                    <p className="text-[11px] text-kore-gray-dark/40">{new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {r.credits_spent} créditos</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
                </div>
```

Replace with:

```tsx
                <div key={r.id} className="flex items-center gap-3 py-2.5">
                  <div className="flex-1 min-w-0">
                    <p className="text-[13px] font-medium text-kore-gray-dark truncate">{r.item_name}</p>
                    <p className="text-[11px] text-kore-gray-dark/40">{new Date(r.created_at).toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} · {r.credits_spent} créditos</p>
                    {r.delivery_photo_url && (
                      <a href={r.delivery_photo_url} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-kore-sage-deep underline">Ver comprobante</a>
                    )}
                  </div>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tone}`}>{label}</span>
                </div>
```

- [ ] **Step 2: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean (exit 0).

- [ ] **Step 3: Commit**

```bash
git add "frontend/app/(app)/mis-creditos/page.tsx"
git commit -m "feat(store): show delivery comprobante in Mis canjes

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: E2E + flow triplet v1.2.0 + guides

**Files:**
- Modify: `frontend/e2e/trainer/trainer-tienda.spec.ts`, `frontend/e2e/app/mis-creditos.spec.ts`, `frontend/e2e/flow-definitions.json`, `docs/USER_FLOW_MAP.md`, `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`

- [ ] **Step 1: Trainer spec — edit item + fulfill producto with photo** — replace `frontend/e2e/trainer/trainer-tienda.spec.ts`:

```typescript
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const ITEMS = [{ id: 1, name: 'Camiseta', description: '', price_credits: 50, item_type: 'producto', is_active: true, image_url: null }];
const PENDING = { count: 1, results: [{ id: 7, item_name: 'Camiseta', credits_spent: 50, status: 'pending', customer_name: 'Ana Ruiz', item_type: 'producto' }] };

test.describe('Trainer — tienda', { tag: [...FlowTags.TRAINER_STORE_MANAGEMENT, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => { await injectTrainerAuthCookies(page); });

  test('shows pending redemptions and the catalog manager', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(ITEMS) }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.goto('/trainer/tienda');
    await expect(page.getByTestId('trainer-tienda')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Camiseta').first()).toBeVisible();
    await expect(page.getByRole('button', { name: 'Entregar' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible();
  });

  test('fulfilling a producto requires uploading a photo', async ({ page }) => {
    await page.route('**/api/trainer/store-items/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/store/redemptions/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING) }));
    await page.route('**/api/trainer/store/redemptions/7/review/', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 7, status: 'fulfilled' }) }));
    await page.goto('/trainer/tienda');
    await page.getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByTestId('deliver-dialog')).toBeVisible();
    // Confirm without a photo → inline error, dialog stays
    await page.getByTestId('deliver-dialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('La foto de entrega es obligatoria.')).toBeVisible();
    // Attach a photo and confirm
    await page.getByTestId('deliver-photo-input').setInputFiles({ name: 'd.png', mimeType: 'image/png', buffer: Buffer.from([137, 80, 78, 71]) });
    await page.getByTestId('deliver-dialog').getByRole('button', { name: 'Entregar' }).click();
    await expect(page.getByText('Sin solicitudes pendientes.')).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: mis-creditos spec — comprobante** — in `frontend/e2e/app/mis-creditos.spec.ts`, the `beforeEach` mocks `**/api/store/redemptions/**` with `'[]'`. Add a test that returns a fulfilled redemption with a photo. Insert after the balance-split test:

```typescript
  test('shows the delivery comprobante link for a fulfilled redemption', async ({ page }) => {
    await page.route('**/api/store/redemptions/**', (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify([
      { id: 5, item: 1, item_name: 'Camiseta', item_image_url: null, credits_spent: 50, status: 'fulfilled', trainer_note: '', delivery_photo_url: 'http://x/media/redemption_deliveries/d.png', created_at: '2026-07-03T10:00:00Z', resolved_at: '2026-07-04T10:00:00Z' },
    ]) }));
    await page.goto('/mis-creditos');
    await expect(page.getByRole('link', { name: 'Ver comprobante' })).toBeVisible({ timeout: 15_000 });
  });
```

- [ ] **Step 3: Flow triplet → v1.2.0** — in `frontend/e2e/flow-definitions.json`, bump `"version"` to `"1.2.0"` and `"lastUpdated"` to `"2026-07-04"`. Update the two descriptions:

```json
    "trainer-store-management": {
      "name": "Trainer — Gestión de tienda",
      "module": "trainer",
      "priority": "P2",
      "roles": ["trainer"],
      "description": "El entrenador gestiona el catálogo (crear/editar con imagen, activar/desactivar) y resuelve canjes: entrega productos/servicios subiendo una foto de verificación obligatoria, o rechaza (con devolución de créditos)."
    },
```

```json
    "customer-store": {
      "name": "Cliente — Tienda",
      "module": "app",
      "priority": "P2",
      "roles": ["user"],
      "description": "El cliente ve el catálogo, su saldo disponible, canjea un artículo y ve el estado de sus canjes con el comprobante de entrega cuando aplica."
    },
```

- [ ] **Step 4: USER_FLOW_MAP.md** — update the `trainer-store-management` and `customer-store` entries to mention item edit + mandatory delivery photo + comprobante. In `docs/USER_FLOW_MAP.md`, under `### trainer-store-management`, replace the Steps/Branches with:

```markdown
**Steps**
1. Open /trainer/tienda from the trainer nav "Tienda" link.
2. See "Solicitudes de canje": each pending request shows item, customer and credits spent.
3. Click "Entregar" → for producto/servicio a dialog requires a verification photo; upload it and confirm. "Rechazar" refunds the credits.
4. In "Catálogo", create or edit an item (name, description, price, type, image) and toggle Activo/Inactivo.

**Branches / Variations**
- Fulfilling producto/servicio without a photo is blocked with an inline error.
- Sesión adicional is fulfilled without a photo (transitional; auto-grant lands in Part 6).
- Rejecting a redemption refunds the spent credits to the client's balance.
- Non-admin trainers only see redemptions from their assigned customers; admins see all.
```

And under `### customer-store`, add to Branches:

```markdown
- Fulfilled producto/servicio redemptions show a "Ver comprobante" link in Mis canjes.
```

- [ ] **Step 5: Guides** — in `docs/release-july/GUIA_DE_VALIDACION.md`, extend the Part 4 "Funcionalidad 8 (entrenador)" section with a note that entregar producto/servicio ahora **exige una foto** y que el cliente la ve en Mis canjes; and add that the trainer can **editar** items con imagen. In `docs/release-july/GUIA_QA_STAGING.md`, add to route 3.7 a step: "Al Entregar un producto/servicio, sube una foto (obligatoria); verifícala luego en Mis canjes del cliente como 'Ver comprobante'." Add these edits verbatim:

In `GUIA_DE_VALIDACION.md`, after the Funcionalidad 8 step list "4. En **'Catálogo'** agrega un artículo...", append:

```markdown
5. Para **editar** un artículo, toca **Editar**, cambia nombre/descr./precio/imagen y guarda.
6. Al **Entregar** un producto o servicio, el sistema **exige una foto** de verificación; súbela para confirmar. El cliente la verá como **"Ver comprobante"** en *Mis créditos → Mis canjes*.
```

In `GUIA_QA_STAGING.md`, in section 3.7, append:

```markdown
6. Al **Entregar** un producto/servicio se abre un diálogo que **pide foto obligatoria**; sube una imagen y confirma.
7. Entra como el cliente a **Mis créditos → Mis canjes**: el canje entregado muestra **"Ver comprobante"** con la foto.
```

- [ ] **Step 6: Run the specs (CI re-verifies) + commit**

Run: `cd frontend && npx tsc --noEmit`
Expected: clean. (Playwright specs are verified by CI per project policy.)

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md docs/release-july/
git commit -m "test(store): e2e for item edit + delivery photo + comprobante; flows v1.2.0 + guides

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 8: Wrap-up — audit, checks, push, PR

- [ ] **Step 1**: invoke `e2e-user-flows-check` for `trainer-store-management` and `customer-store`; close any P1/P2 gap.
- [ ] **Step 2**: `cd backend && source venv/bin/activate && python manage.py check && python manage.py makemigrations core_app --check --dry-run` (no pending) and `cd frontend && npx tsc --noEmit` (clean).
- [ ] **Step 3**: `git push -u origin feat/04072026-phase5-store-enrichment`, create the PR to base `july-release` titled `feat(store): Phase 2 Part 5 — store enrichment (media + delivery photo)`, summarizing: `delivery_photo` + drop `descuento` (with the Part 4 fulfill-test change noted), mandatory photo for producto/servicio, trainer item create/edit with image, comprobante in Mis canjes, flows v1.2.0 + guides. CI runs everything. Report the PR URL.
