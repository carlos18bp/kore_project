# Trainer Task Hub ("Tareas pendientes") Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a trainer "Tareas pendientes" hub that surfaces pending credit reviews (meal photos + workout captures) and store redemptions for approve/reject, and enable trainer validation of training-day credits.

**Architecture:** Reuse the existing backend review endpoints (`/trainer/credits/pending-reviews/`, `/trainer/credits/transactions/<id>/review/`) and store-redemption endpoints. Three small backend changes: enable the workout-day PENDING credit, attach workout-capture photos to the pending-reviews payload, and stop auto-confirming pending credits at day close. Frontend adds a Zustand store, a hub page at `/trainer/tareas`, sidebar/mobile nav entries with a count badge, a client-detail strip, and the flow triplet + E2E spec.

**Tech Stack:** Django 6 + DRF, pytest (backend); Next.js 16 App Router, React 19, Zustand, Axios wrapper `@/lib/services/http`, Jest, Playwright (frontend).

## Global Constraints

- Parent branch `july-release`; work on `feat/10072026-trainer-task-hub`; one PR to `july-release`.
- Never edit old migrations; next migration number is `0067`, dependency `('core_app', '0066_nutritionproduct_nutritionupgrade')`.
- Commit messages end with: `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- Match existing view style (this area uses APIView/class-based views in `credit_views.py`).
- Frontend trainer pages use the container `px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5` inside `<section className="min-h-screen bg-kore-cream">`. No `max-w-*` on the page container.
- HTTP in stores via `@/lib/services/http` (`api`, `extractApiError`) + local `authHeaders()` reading cookie `kore_token`.
- Backend tests: `cd backend && source venv/bin/activate && pytest <path> -v`. Do NOT run the full suite; max 20 tests/batch.
- Credit status values: `pending`, `confirmed`, `rejected`. Only `confirmed` touches the wallet.

---

### Task 1: Enable the workout-day credit

**Files:**
- Modify: `backend/core_app/models/credit.py:30` (`require_workout_captures` default)
- Create: `backend/core_app/migrations/0067_enable_workout_captures.py`
- Test: `backend/core_app/tests/services/test_credit_day_close.py`

**Interfaces:**
- Consumes: `credit_engine.get_settings()` → `CreditSettings` singleton; `process_credits_day_close(today=...)` (`core_app/services/credit_day_close.py`), which already awards `WORKOUT_DAY` as PENDING with `reference_type='daily_log'`, `reference_id=log.pk` when `settings_obj.require_workout_captures` is True.
- Produces: workout-day PENDING credits exist whenever a training day has a capture.

- [ ] **Step 1: Write the failing test**

Add to `backend/core_app/tests/services/test_credit_day_close.py` (top-level helpers + test). The file already imports `timezone`, `timedelta`, `credit_engine`, `process_credits_day_close`, `CreditTransaction`, and the program models via its existing `_training_day` helper. Add these:

```python
import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from core_app.models.monthly_program import ExerciseCapture


def _tiny_image(name='cap.jpg'):
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), (90, 90, 90)).save(buf, 'JPEG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/jpeg')


@pytest.mark.django_db
def test_training_day_with_capture_mints_pending_workout_credit(existing_user):
    today = timezone.localdate()
    log = _training_day(existing_user, today, completed=True)
    exercise_log = log.exercise_logs.first()
    ExerciseCapture.objects.create(exercise_log=exercise_log, image=_tiny_image())

    process_credits_day_close(today=today)

    tx = CreditTransaction.objects.filter(
        customer=existing_user, action=CreditTransaction.Action.WORKOUT_DAY,
    ).first()
    assert tx is not None
    assert tx.status == CreditTransaction.Status.PENDING
    assert tx.reference_type == 'daily_log'
    assert str(tx.reference_id) == str(log.pk)
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py::test_training_day_with_capture_mints_pending_workout_credit -v`
Expected: FAIL — no `WORKOUT_DAY` tx created (default `require_workout_captures=False`).

- [ ] **Step 3: Flip the model default**

In `backend/core_app/models/credit.py:30` change:

```python
require_workout_captures = models.BooleanField(default=True)
```

- [ ] **Step 4: Create the migration**

Create `backend/core_app/migrations/0067_enable_workout_captures.py`:

```python
from django.db import migrations, models


def enable_workout_captures(apps, schema_editor):
    CreditSettings = apps.get_model('core_app', 'CreditSettings')
    CreditSettings.objects.update_or_create(pk=1, defaults={'require_workout_captures': True})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0066_nutritionproduct_nutritionupgrade'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creditsettings',
            name='require_workout_captures',
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(enable_workout_captures, noop_reverse),
    ]
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py::test_training_day_with_capture_mints_pending_workout_credit -v`
Expected: PASS.

- [ ] **Step 6: Run the day-close regression slice**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py -v`
Expected: all PASS (the existing streak/no-show tests still pass; they use no captures so no workout credit is minted for them).

- [ ] **Step 7: Commit**

```bash
git add backend/core_app/models/credit.py backend/core_app/migrations/0067_enable_workout_captures.py backend/core_app/tests/services/test_credit_day_close.py
git commit -m "feat(credits): enable workout-day credit review (require_workout_captures)

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Expose workout-capture photos in pending reviews

**Files:**
- Modify: `backend/core_app/views/credit_views.py:75-100` (`TrainerPendingReviewsView.get`)
- Test: `backend/core_app/tests/views/test_credit_trainer_views.py`

**Interfaces:**
- Consumes: `CreditTransaction` PENDING rows scoped by `_scope_to_trainer_clients`; `MealEntry.photo`, `ExerciseCapture.image` (relation `exercise_log__daily_log_id`).
- Produces: each pending-review row gains `photos: string[]` and `photo_url` = first photo or `None`. Meal → `[meal.photo.url]`; workout (`daily_log`) → all capture urls.

- [ ] **Step 1: Write the failing test**

Add to `backend/core_app/tests/views/test_credit_trainer_views.py` (the file already has `trainer_user`, `assigned_customer`, `frozen_now`, `api_client` fixtures and imports `credit_engine`, `CreditTransaction`). Add imports + helper + tests:

```python
import io
from PIL import Image
from django.core.files.uploadedfile import SimpleUploadedFile
from core_app.models import (
    MonthlyProgram, ProgramDay, Exercise, ProgramExercise, DailyLog, ExerciseLog,
)
from core_app.models.monthly_program import ExerciseCapture


def _tiny_image(name='cap.jpg'):
    buf = io.BytesIO()
    Image.new('RGB', (10, 10), (90, 90, 90)).save(buf, 'JPEG')
    return SimpleUploadedFile(name, buf.getvalue(), content_type='image/jpeg')


def _training_log_with_capture(customer, today):
    program = MonthlyProgram.objects.create(
        customer=customer, fitness_level=3, goal='fuerza',
        start_date=today, end_date=today, status=MonthlyProgram.Status.PUBLISHED,
    )
    day = ProgramDay.objects.create(
        program=program, day_number=1, date=today, day_type=ProgramDay.DayType.TRAINING,
    )
    exercise = Exercise.objects.create(name='Sentadilla', youtube_url='https://youtu.be/x')
    pe = ProgramExercise.objects.create(program_day=day, exercise=exercise)
    log = DailyLog.objects.create(customer=customer, program=program, date=today, is_closed=True)
    el = ExerciseLog.objects.create(
        daily_log=log, program_exercise=pe, status=ExerciseLog.Status.COMPLETED,
    )
    ExerciseCapture.objects.create(exercise_log=el, image=_tiny_image())
    return log


@pytest.mark.django_db
def test_pending_reviews_attaches_workout_capture_photos(api_client, trainer_user, assigned_customer, frozen_now):
    log = _training_log_with_capture(assigned_customer, frozen_now.date())
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.WORKOUT_DAY, 'daily_log', log.pk,
        'Entrenamiento', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )

    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')

    assert resp.status_code == 200
    row = next(r for r in resp.json()['results'] if r['reference_type'] == 'daily_log')
    assert len(row['photos']) == 1
    assert row['photos'][0].endswith('.jpg')
    assert row['photo_url'] == row['photos'][0]


@pytest.mark.django_db
def test_pending_reviews_meal_photo_uses_photos_list(api_client, trainer_user, assigned_customer, frozen_now):
    from core_app.models import NutritionDailyLog, MealEntry
    dlog = NutritionDailyLog.objects.create(customer=assigned_customer, date=frozen_now.date())
    meal = MealEntry.objects.create(
        daily_log=dlog, meal_block='almuerzo', status=MealEntry.Status.COMPLETED,
        photo=_tiny_image('meal.jpg'),
    )
    credit_engine.award(
        assigned_customer, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', meal.pk,
        'Almuerzo', status=CreditTransaction.Status.PENDING, review_deadline=frozen_now,
    )

    api_client.force_authenticate(trainer_user)
    resp = api_client.get('/api/trainer/credits/pending-reviews/')

    row = next(r for r in resp.json()['results'] if r['reference_type'] == 'meal_entry')
    assert row['photos'] == [row['photo_url']]
    assert row['photo_url'].endswith('.jpg')
```

> Note: `MealEntry.meal_block` accepts the raw block string (`'almuerzo'`); adjust only if the model requires a specific choice constant — verify against `core_app/models/nutrition_daily_log.py` if the create call errors.

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/views/test_credit_trainer_views.py -k "photos or capture" -v`
Expected: FAIL — rows have no `photos` key (KeyError) and `photo_url` is `None` for `daily_log`.

- [ ] **Step 3: Rewrite the view's `get`**

In `backend/core_app/views/credit_views.py`, add the import near the other model imports at the top of the file:

```python
from core_app.models.monthly_program import ExerciseCapture
```

Replace the body of `TrainerPendingReviewsView.get` (currently `credit_views.py:78-100`) with:

```python
    def get(self, request):
        qs = list(_scope_to_trainer_clients(
            CreditTransaction.objects.filter(
                status=CreditTransaction.Status.PENDING,
            ).select_related('customer'),
            request,
        ))

        meal_ids = [
            int(t.reference_id) for t in qs
            if t.reference_type == 'meal_entry' and t.reference_id
        ]
        meal_photos = {
            str(m.pk): ([m.photo.url] if m.photo else [])
            for m in MealEntry.objects.filter(pk__in=meal_ids)
        }

        workout_ids = [
            int(t.reference_id) for t in qs
            if t.reference_type == 'daily_log' and t.reference_id
        ]
        workout_photos: dict[str, list] = {}
        if workout_ids:
            captures = ExerciseCapture.objects.filter(
                exercise_log__daily_log_id__in=workout_ids,
            ).select_related('exercise_log')
            for cap in captures:
                if not cap.image:
                    continue
                key = str(cap.exercise_log.daily_log_id)
                workout_photos.setdefault(key, []).append(cap.image.url)

        results = []
        for tx in qs:
            row = CreditTransactionSerializer(tx).data
            row['customer_email'] = tx.customer.email
            row['customer_name'] = f'{tx.customer.first_name} {tx.customer.last_name}'.strip()
            if tx.reference_type == 'meal_entry':
                photos = meal_photos.get(tx.reference_id, [])
            elif tx.reference_type == 'daily_log':
                photos = workout_photos.get(tx.reference_id, [])
            else:
                photos = []
            row['photos'] = photos
            row['photo_url'] = photos[0] if photos else None
            results.append(row)
        return Response({'count': len(results), 'results': results})
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/views/test_credit_trainer_views.py -v`
Expected: all PASS (new photo tests + existing pending-review tests).

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/credit_views.py backend/core_app/tests/views/test_credit_trainer_views.py
git commit -m "feat(credits): attach workout-capture photos to pending reviews

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Remove auto-confirm at day close

**Files:**
- Modify: `backend/core_app/services/credit_day_close.py:118-133` (`process_credits_day_close` tail)
- Test: `backend/core_app/tests/services/test_credit_day_close.py`

**Interfaces:**
- Consumes: `process_credits_day_close(today=...)`.
- Produces: PENDING credits past their `review_deadline` stay PENDING; summary no longer has `pending_confirmed`.

- [ ] **Step 1: Write the failing test**

Add to `backend/core_app/tests/services/test_credit_day_close.py`:

```python
@pytest.mark.django_db
def test_overdue_pending_credit_is_not_auto_confirmed(existing_user, frozen_now):
    today = timezone.localdate()
    credit_engine.award(
        existing_user, CreditTransaction.Action.MEAL_PHOTO, 'meal_entry', 1,
        'Almuerzo', status=CreditTransaction.Status.PENDING,
        review_deadline=timezone.now() - timedelta(hours=1),
    )

    process_credits_day_close(today=today)

    tx = CreditTransaction.objects.get(
        customer=existing_user, action=CreditTransaction.Action.MEAL_PHOTO,
    )
    assert tx.status == CreditTransaction.Status.PENDING
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py::test_overdue_pending_credit_is_not_auto_confirmed -v`
Expected: FAIL — the tx is auto-confirmed to `confirmed`.

- [ ] **Step 3: Remove the auto-confirm block**

In `backend/core_app/services/credit_day_close.py`, delete these lines (currently 118-125):

```python
    confirmed = 0
    expired = CreditTransaction.objects.filter(
        status=CreditTransaction.Status.PENDING,
        review_deadline__lte=timezone.now(),
    )
    for tx in expired:
        if credit_engine.confirm_transaction(tx):
            confirmed += 1
```

And change the summary dict (currently 127-133) to drop `pending_confirmed`:

```python
    summary = {
        'evaluated': evaluated,
        'streaks_reset': streaks_reset,
        'no_shows': no_shows,
        'errors': errors,
    }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py::test_overdue_pending_credit_is_not_auto_confirmed -v`
Expected: PASS.

- [ ] **Step 5: Run the day-close file + adjust any assertion on `pending_confirmed`**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/services/test_credit_day_close.py -v`
Expected: all PASS. If a pre-existing test asserted `summary['pending_confirmed']` or relied on auto-confirmation, update that test to reflect that pending credits now stay PENDING (this is the intended behavior change). If no such test exists, no edit is needed.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/services/credit_day_close.py backend/core_app/tests/services/test_credit_day_close.py
git commit -m "feat(credits): stop auto-confirming pending credits at day close

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: `trainerTasksStore`

**Files:**
- Create: `frontend/lib/stores/trainerTasksStore.ts`
- Test: `frontend/app/__tests__/stores/trainerTasksStore.test.ts`

**Interfaces:**
- Produces: `useTrainerTasksStore` with `creditReviews: CreditReview[]`, `loading`, `error`, `fetchPendingCreditReviews()`, `reviewCreditTransaction(txId, 'approve'|'reject', note?) => Promise<boolean>`. Exports type `CreditReview`.
- Consumes: `GET /trainer/credits/pending-reviews/` → `{count, results}`; `POST /trainer/credits/transactions/<id>/review/` body `{decision, note}`.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/__tests__/stores/trainerTasksStore.test.ts`:

```tsx
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn() },
  extractApiError: (_e: unknown, fb: string) => fb,
}));
jest.mock('js-cookie', () => ({ get: () => 'tok', set: jest.fn(), remove: jest.fn() }));

import { api } from '@/lib/services/http';
import { useTrainerTasksStore } from '@/lib/stores/trainerTasksStore';

const mockApi = api as jest.Mocked<typeof api>;

const ROW = {
  id: 7, action: 'workout_day', amount: 10, status: 'pending', description: 'x',
  reference_type: 'daily_log', reference_id: '5', review_deadline: null,
  created_at: '2026-07-10T10:00:00Z', customer_email: 'c@test.com',
  customer_name: 'Cliente', photo_url: '/a.jpg', photos: ['/a.jpg'],
};

beforeEach(() => {
  useTrainerTasksStore.setState({ creditReviews: [], loading: false, error: '' });
  jest.clearAllMocks();
});

test('fetchPendingCreditReviews populates creditReviews', async () => {
  mockApi.get.mockResolvedValue({ data: { count: 1, results: [ROW] } } as never);
  await useTrainerTasksStore.getState().fetchPendingCreditReviews();
  expect(mockApi.get).toHaveBeenCalledWith('/trainer/credits/pending-reviews/', expect.anything());
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(1);
});

test('reviewCreditTransaction approve posts and removes the row', async () => {
  useTrainerTasksStore.setState({ creditReviews: [ROW] as never });
  mockApi.post.mockResolvedValue({ data: {} } as never);
  const ok = await useTrainerTasksStore.getState().reviewCreditTransaction(7, 'approve');
  expect(ok).toBe(true);
  expect(mockApi.post).toHaveBeenCalledWith(
    '/trainer/credits/transactions/7/review/',
    { decision: 'approve', note: undefined },
    expect.anything(),
  );
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(0);
});

test('reviewCreditTransaction failure sets error and returns false', async () => {
  useTrainerTasksStore.setState({ creditReviews: [ROW] as never });
  mockApi.post.mockRejectedValue(new Error('nope'));
  const ok = await useTrainerTasksStore.getState().reviewCreditTransaction(7, 'reject', 'motivo');
  expect(ok).toBe(false);
  expect(useTrainerTasksStore.getState().error).toBeTruthy();
  expect(useTrainerTasksStore.getState().creditReviews).toHaveLength(1);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npm test -- app/__tests__/stores/trainerTasksStore.test.ts`
Expected: FAIL — module `@/lib/stores/trainerTasksStore` not found.

- [ ] **Step 3: Create the store**

Create `frontend/lib/stores/trainerTasksStore.ts`:

```tsx
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface CreditReview {
  id: number;
  action: string;
  amount: number;
  status: string;
  description: string;
  reference_type: string;
  reference_id: string | null;
  review_deadline: string | null;
  created_at: string;
  customer_email: string;
  customer_name: string;
  photo_url: string | null;
  photos: string[];
}

interface TrainerTasksState {
  creditReviews: CreditReview[];
  loading: boolean;
  error: string;
  fetchPendingCreditReviews: () => Promise<void>;
  reviewCreditTransaction: (
    txId: number,
    decision: 'approve' | 'reject',
    note?: string,
  ) => Promise<boolean>;
}

export const useTrainerTasksStore = create<TrainerTasksState>((set) => ({
  creditReviews: [],
  loading: false,
  error: '',
  fetchPendingCreditReviews: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/trainer/credits/pending-reviews/', {
        headers: authHeaders(),
      });
      set({ creditReviews: data.results ?? [], loading: false });
    } catch {
      set({ error: 'No se pudieron cargar las revisiones.', loading: false });
    }
  },
  reviewCreditTransaction: async (txId, decision, note) => {
    try {
      await api.post(
        `/trainer/credits/transactions/${txId}/review/`,
        { decision, note },
        { headers: authHeaders() },
      );
      set((s) => ({ creditReviews: s.creditReviews.filter((r) => r.id !== txId) }));
      return true;
    } catch (err) {
      set({ error: extractApiError(err, 'No se pudo procesar la revisión.') });
      return false;
    }
  },
}));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd frontend && npm test -- app/__tests__/stores/trainerTasksStore.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add frontend/lib/stores/trainerTasksStore.ts frontend/app/__tests__/stores/trainerTasksStore.test.ts
git commit -m "feat(trainer): trainerTasksStore for pending credit reviews

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Hub page + sidebar/mobile nav

**Files:**
- Create: `frontend/app/(app)/trainer/tareas/page.tsx`
- Modify: `frontend/app/components/layouts/TrainerSidebar.tsx`
- Modify: `frontend/app/components/layouts/TrainerMobileBottomNav.tsx`

**Interfaces:**
- Consumes: `useTrainerTasksStore` (`creditReviews`, `loading`, `fetchPendingCreditReviews`, `reviewCreditTransaction`, `CreditReview`); `useStoreStore` (`pendingReviews`, `fetchPendingReviews`, `reviewRedemption`).
- Produces: route `/trainer/tareas` (container `data-testid="trainer-tareas"`), nav entries with a count badge = credit reviews + redemptions.

- [ ] **Step 1: Create the hub page**

Create `frontend/app/(app)/trainer/tareas/page.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useTrainerTasksStore, type CreditReview } from '@/lib/stores/trainerTasksStore';
import { useStoreStore } from '@/lib/stores/storeStore';

function typeLabel(r: CreditReview): string {
  if (r.reference_type === 'daily_log') return 'Entrenamiento';
  if (r.reference_type === 'meal_entry') return 'Comida';
  return 'Actividad';
}

function isOverdue(r: CreditReview): boolean {
  return !!r.review_deadline && new Date(r.review_deadline).getTime() < Date.now();
}

export default function TrainerTasksPage() {
  const { creditReviews, loading, fetchPendingCreditReviews, reviewCreditTransaction } =
    useTrainerTasksStore();
  const { pendingReviews, fetchPendingReviews, reviewRedemption } = useStoreStore();

  const [tab, setTab] = useState<'creditos' | 'canjes'>('creditos');
  const [rejectingId, setRejectingId] = useState<number | null>(null);
  const [note, setNote] = useState('');
  const [deliver, setDeliver] = useState<{ id: number; requiresPhoto: boolean } | null>(null);
  const deliverFileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchPendingCreditReviews();
    fetchPendingReviews();
  }, [fetchPendingCreditReviews, fetchPendingReviews]);

  const confirmReject = async (id: number) => {
    await reviewCreditTransaction(id, 'reject', note.trim() || undefined);
    setRejectingId(null);
    setNote('');
  };

  const openDeliver = (r: { id: number; item_type?: string }) =>
    setDeliver({ id: r.id, requiresPhoto: r.item_type === 'producto' || r.item_type === 'servicio' });

  const confirmDeliver = async () => {
    if (!deliver) return;
    const file = deliverFileRef.current?.files?.[0];
    if (deliver.requiresPhoto && !file) return;
    await reviewRedemption(deliver.id, 'fulfill', undefined, file ?? undefined);
    setDeliver(null);
  };

  return (
    <section className="min-h-screen bg-kore-cream">
      <div className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5" data-testid="trainer-tareas">
        <header className="space-y-1">
          <h1 className="text-2xl font-bold text-kore-wine-dark">Tareas pendientes</h1>
          <p className="text-[13px] text-kore-gray-dark/50">
            Revisa los puntos de tus clientes y las solicitudes de canje.
          </p>
        </header>

        <div className="flex gap-2">
          <button
            onClick={() => setTab('creditos')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold ${
              tab === 'creditos'
                ? 'bg-kore-red text-white'
                : 'bg-white text-kore-gray-dark/60 border border-kore-gray-light/40'
            }`}
          >
            Créditos ({creditReviews.length})
          </button>
          <button
            onClick={() => setTab('canjes')}
            className={`px-4 py-1.5 rounded-full text-[13px] font-semibold ${
              tab === 'canjes'
                ? 'bg-kore-red text-white'
                : 'bg-white text-kore-gray-dark/60 border border-kore-gray-light/40'
            }`}
          >
            Canjes ({pendingReviews.length})
          </button>
        </div>

        {tab === 'creditos' && (
          <div className="space-y-3">
            {creditReviews.length === 0 && !loading && (
              <p className="text-[13px] text-kore-gray-dark/40">No hay créditos por revisar.</p>
            )}
            {creditReviews.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm space-y-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14px] font-semibold text-kore-gray-dark truncate">
                      {r.customer_name || r.customer_email}
                    </p>
                    <p className="text-[11px] text-kore-gray-dark/45">
                      {typeLabel(r)} · +{r.amount} créditos
                    </p>
                  </div>
                  {isOverdue(r) && (
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 shrink-0">
                      Atrasado
                    </span>
                  )}
                </div>

                {r.photos.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {r.photos.map((src, i) => (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        key={i}
                        src={src}
                        alt="evidencia"
                        className="w-24 h-24 object-cover rounded-lg border border-kore-gray-light/30 shrink-0"
                      />
                    ))}
                  </div>
                )}

                {rejectingId === r.id ? (
                  <div className="space-y-2">
                    <textarea
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder="Motivo del rechazo (opcional)"
                      rows={2}
                      data-testid={`reject-note-${r.id}`}
                      className="w-full text-[13px] rounded-lg border border-kore-gray-light/40 p-2"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmReject(r.id)}
                        className="text-[12px] font-bold px-3 py-1.5 rounded-full bg-red-100 text-red-600"
                      >
                        Confirmar rechazo
                      </button>
                      <button
                        onClick={() => {
                          setRejectingId(null);
                          setNote('');
                        }}
                        className="text-[12px] font-semibold px-3 py-1.5 rounded-full text-kore-gray-dark/50"
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <button
                      onClick={() => reviewCreditTransaction(r.id, 'approve')}
                      className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-kore-sage/20 text-kore-sage-deep"
                    >
                      Aprobar
                    </button>
                    <button
                      onClick={() => {
                        setRejectingId(r.id);
                        setNote('');
                      }}
                      className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-red-100 text-red-600"
                    >
                      Rechazar
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {tab === 'canjes' && (
          <div className="space-y-3">
            {pendingReviews.length === 0 && (
              <p className="text-[13px] text-kore-gray-dark/40">No hay canjes pendientes.</p>
            )}
            {pendingReviews.map((r) => (
              <div
                key={r.id}
                className="bg-white rounded-2xl p-4 border border-kore-gray-light/40 shadow-sm flex items-center gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-semibold text-kore-gray-dark truncate">
                    {r.item_name}
                  </p>
                  <p className="text-[11px] text-kore-gray-dark/45">
                    {r.customer_name} · {r.credits_spent} créditos
                  </p>
                </div>
                <button
                  onClick={() => openDeliver(r)}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-kore-sage/20 text-kore-sage-deep"
                >
                  Entregar
                </button>
                <button
                  onClick={() => reviewRedemption(r.id, 'reject', 'No disponible')}
                  className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-red-100 text-red-600"
                >
                  Rechazar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {deliver && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          data-testid="deliver-dialog"
        >
          <div className="bg-white rounded-2xl p-5 w-full max-w-sm space-y-3">
            <p className="text-[14px] font-semibold text-kore-gray-dark">Confirmar entrega</p>
            {deliver.requiresPhoto && (
              <>
                <p className="text-[12px] text-kore-gray-dark/50">
                  Sube una foto que verifique la entrega.
                </p>
                <input
                  ref={deliverFileRef}
                  type="file"
                  accept="image/*"
                  data-testid="deliver-photo-input"
                  className="text-[12px]"
                />
              </>
            )}
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => setDeliver(null)}
                className="text-[12px] font-semibold px-3 py-1.5 rounded-full text-kore-gray-dark/50"
              >
                Cancelar
              </button>
              <button
                onClick={confirmDeliver}
                className="text-[12px] font-bold px-3.5 py-1.5 rounded-full bg-kore-red text-white"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add the sidebar nav item + badge**

In `frontend/app/components/layouts/TrainerSidebar.tsx`:

(a) Near the other hand-rolled icon components (after `StoreIcon`), add a `TasksIcon` using the file's existing `iconProps`:

```tsx
const TasksIcon = (
  <svg {...iconProps}>
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  </svg>
);
```

(b) At the top of the component body (near where `riskDashboard`/`alertCount` are read), add the count wiring:

```tsx
import { useEffect } from 'react';
import { useTrainerTasksStore } from '@/lib/stores/trainerTasksStore';
import { useStoreStore } from '@/lib/stores/storeStore';
// ...
const creditReviewCount = useTrainerTasksStore((s) => s.creditReviews.length);
const fetchCreditReviews = useTrainerTasksStore((s) => s.fetchPendingCreditReviews);
const redemptionCount = useStoreStore((s) => s.pendingReviews.length);
const fetchRedemptions = useStoreStore((s) => s.fetchPendingReviews);
const taskCount = creditReviewCount + redemptionCount;
useEffect(() => {
  fetchCreditReviews();
  fetchRedemptions();
}, [fetchCreditReviews, fetchRedemptions]);
```

> If `useEffect` / these imports already exist in the file, merge rather than duplicate. If the component reads store state via a destructured `useTrainerStore()` object rather than selectors, follow the file's existing convention instead of the selector form above.

(c) Add the nav item to the `items` array (after the `store` item, before `messages`) and include `taskCount` in the `useMemo` dependency array:

```tsx
{ key: 'tasks', label: 'Tareas pendientes', href: '/trainer/tareas', icon: TasksIcon, badge: taskCount > 0 ? taskCount : undefined },
```

- [ ] **Step 3: Add the mobile nav entry**

In `frontend/app/components/layouts/TrainerMobileBottomNav.tsx`, add a `TasksIcon` element (using that file's `iconProps` with `w-5 h-5`) after `StoreIcon`:

```tsx
const TasksIcon = (
  <svg {...iconProps}>
    <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
  </svg>
);
```

And add it to the `moreItems` array (before `support`):

```tsx
{ key: 'tasks', label: 'Tareas', icon: TasksIcon, href: '/trainer/tareas' },
```

- [ ] **Step 4: Typecheck / build**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors in the new/modified files. (Full `npm run build` runs in CI; a local tsc is enough here.)

- [ ] **Step 5: Commit**

```bash
git add frontend/app/\(app\)/trainer/tareas/page.tsx frontend/app/components/layouts/TrainerSidebar.tsx frontend/app/components/layouts/TrainerMobileBottomNav.tsx
git commit -m "feat(trainer): tareas pendientes hub page + nav entries

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Client-detail pending-tasks strip

**Files:**
- Modify: `frontend/app/(app)/trainer/clients/client/page.tsx`

**Interfaces:**
- Consumes: `useTrainerTasksStore` (`creditReviews`, `fetchPendingCreditReviews`); the already-loaded `client` object (has `.email`).
- Produces: a "Tareas pendientes (N)" strip in the client header linking to `/trainer/tareas`.

- [ ] **Step 1: Wire the store + count**

In `frontend/app/(app)/trainer/clients/client/page.tsx`, inside `TrainerClientDetailPage`, after the existing store reads, add:

```tsx
import Link from 'next/link';
import { useTrainerTasksStore } from '@/lib/stores/trainerTasksStore';
// ...
const creditReviews = useTrainerTasksStore((s) => s.creditReviews);
const fetchCreditReviews = useTrainerTasksStore((s) => s.fetchPendingCreditReviews);
useEffect(() => {
  fetchCreditReviews();
}, [fetchCreditReviews]);
const clientTaskCount = creditReviews.filter(
  (r) => r.customer_email && r.customer_email === client?.email,
).length;
```

> `Link` and `useEffect` are likely already imported — merge, don't duplicate.

- [ ] **Step 2: Render the strip**

Inside the header block (the `client && (...)` region, before the tabs grid at `page.tsx:277`), add:

```tsx
{clientTaskCount > 0 && (
  <Link
    href="/trainer/tareas"
    className="inline-flex items-center gap-1.5 text-[12px] font-semibold text-kore-red bg-kore-red/10 rounded-full px-3 py-1.5"
    data-testid="client-pending-tasks"
  >
    Tareas pendientes ({clientTaskCount}) →
  </Link>
)}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: no type errors.

- [ ] **Step 4: Commit**

```bash
git add frontend/app/\(app\)/trainer/clients/client/page.tsx
git commit -m "feat(trainer): pending-tasks strip on client detail

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 7: Flow triplet + E2E spec

**Files:**
- Modify: `frontend/e2e/flow-definitions.json` (add flow, bump version to `1.6.0`)
- Modify: `frontend/e2e/helpers/flow-tags.ts` (add `TRAINER_TASKS`)
- Modify: `docs/USER_FLOW_MAP.md` (add row, bump version to `1.9`)
- Create: `frontend/e2e/trainer/trainer-tasks.spec.ts`

**Interfaces:**
- Consumes: `injectTrainerAuthCookies`, `test`, `expect` from `../fixtures`; `FlowTags`, `RoleTags` from `../helpers/flow-tags`.
- Produces: `@flow:trainer-tasks` coverage.

- [ ] **Step 1: Add the flow tag**

In `frontend/e2e/helpers/flow-tags.ts`, add to the `FlowTags` object:

```tsx
TRAINER_TASKS: ['@flow:trainer-tasks', '@module:trainer', '@priority:P1'],
```

- [ ] **Step 2: Add the flow definition**

In `frontend/e2e/flow-definitions.json`: bump `"version"` to `"1.6.0"`, update `"lastUpdated"` to `"2026-07-10"`, and add under `"flows"`:

```json
"trainer-tasks": {
  "name": "Trainer Task Hub",
  "module": "trainer",
  "priority": "P1",
  "roles": ["trainer"],
  "description": "Review pending credit reviews (meal photos + workout captures) and store redemptions; approve or reject each with a note."
}
```

- [ ] **Step 3: Add the USER_FLOW_MAP row**

In `docs/USER_FLOW_MAP.md`: bump the header version to `1.9`, and under `## Trainer Flows` add:

```md
### trainer-tasks: Trainer Task Hub
- Module: trainer
- Priority: P1
- Route: /trainer/tareas
- Roles: trainer
- Description: Review pending credit reviews (meal photos + workout captures) and store redemptions; approve or reject each with a note.
- E2E Coverage: Covered (frontend/e2e/trainer/trainer-tasks.spec.ts)

**Steps**
1. Open /trainer/tareas after login as trainer.
2. On the Créditos tab, see pending credit reviews with evidence photos.
3. Approve a review (row disappears) or Reject with a note.
4. Switch to the Canjes tab to fulfill or reject store redemptions.

**Branches / Variations**
- Empty states per tab when there is nothing to review.
- Overdue badge when a review is past its review_deadline.
```

- [ ] **Step 4: Write the E2E spec**

Create `frontend/e2e/trainer/trainer-tasks.spec.ts`:

```tsx
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

const PENDING_CREDITS = {
  count: 1,
  results: [
    {
      id: 42,
      action: 'workout_day',
      amount: 10,
      status: 'pending',
      description: 'Completaste tu entrenamiento',
      reference_type: 'daily_log',
      reference_id: '5',
      review_deadline: null,
      created_at: '2026-07-10T10:00:00Z',
      customer_email: 'cliente@test.com',
      customer_name: 'Cliente Uno',
      photos: ['/media/workout_captures/2026/07/cap.jpg'],
      photo_url: '/media/workout_captures/2026/07/cap.jpg',
    },
  ],
};

test.describe('Trainer — tareas pendientes', { tag: [...FlowTags.TRAINER_TASKS, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await page.route('**/api/trainer/store/redemptions/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ count: 0, results: [] }) }),
    );
  });

  test('shows a pending credit with photo and approves it', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING_CREDITS) }),
    );
    await page.route('**/api/trainer/credits/transactions/42/review/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 42, status: 'confirmed' }) }),
    );

    await page.goto('/trainer/tareas');
    await expect(page.getByTestId('trainer-tareas')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Cliente Uno')).toBeVisible();
    await expect(page.getByText('Entrenamiento · +10 créditos')).toBeVisible();

    await page.getByRole('button', { name: 'Aprobar' }).first().click();
    await expect(page.getByText('Cliente Uno')).not.toBeVisible();
  });

  test('rejects a pending credit with a note', async ({ page }) => {
    await page.route('**/api/trainer/credits/pending-reviews/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(PENDING_CREDITS) }),
    );
    await page.route('**/api/trainer/credits/transactions/42/review/', (r) =>
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ id: 42, status: 'rejected' }) }),
    );

    await page.goto('/trainer/tareas');
    await expect(page.getByTestId('trainer-tareas')).toBeVisible({ timeout: 15_000 });

    await page.getByRole('button', { name: 'Rechazar' }).first().click();
    await page.getByTestId('reject-note-42').fill('Foto no válida');
    await page.getByRole('button', { name: 'Confirmar rechazo' }).click();
    await expect(page.getByText('Cliente Uno')).not.toBeVisible();
  });
});
```

- [ ] **Step 5: Run the E2E spec**

Run: `cd frontend && npx playwright test e2e/trainer/trainer-tasks.spec.ts`
Expected: 2 passed. (Requires the dev server per the project's Playwright config; if the config starts it automatically, no extra step. If it fails to reach the page, confirm the route builds via `npx tsc --noEmit` first.)

- [ ] **Step 6: Commit**

```bash
git add frontend/e2e/flow-definitions.json frontend/e2e/helpers/flow-tags.ts docs/USER_FLOW_MAP.md frontend/e2e/trainer/trainer-tasks.spec.ts
git commit -m "test(trainer): E2E + flow triplet for tareas pendientes hub

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Final: finishing the branch

After all tasks pass, use superpowers:finishing-a-development-branch to push and open the PR to `july-release`. Also update the release guides (`docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`) with the new trainer hub, matching the pattern of prior parts, before or as part of the PR.
