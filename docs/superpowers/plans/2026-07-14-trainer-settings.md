# Trainer Settings Panel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give the trainer a panel at `/trainer/configuracion` to set the credit difficulty preset, the activity thresholds, and the reschedule window — and make that one window govern the block, the penalty, and the customer's UI.

**Architecture:** The settings endpoint already exists (`GET`/`PUT /api/credits/settings/`, `IsTrainerRole`) and already reseeds the preset maps when a `PUT` arrives with an empty `action_values`. Three things are missing: `booking_views` must stop hardcoding the reschedule window, the customer-facing `GET /api/credits/values/` must carry it so `SessionDetailModal` stops hardcoding it too, and the whole trainer panel must be built.

**Tech Stack:** Django 6 + DRF (`APIView`, `IsTrainerRole`), Next.js 16 App Router, Zustand 5, Playwright, pytest, Jest.

**Spec:** `docs/superpowers/specs/2026-07-14-trainer-settings-design.md`

## Global Constraints

- Branch: `feat/14072026-trainer-settings`. Never commit to `master`/`july-release`.
- **Do not run pytest / Jest / Playwright locally.** GitHub CI runs them on push. Local verification is limited to `python manage.py check` and `npx tsc --noEmit`. Tests are still written first, in the same commit as the code they cover.
- Run all git commands from the repo root: `git -C /home/cerrotico/work/kore_project ...`.
- Commit messages follow Conventional Commits and end with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Do not put `max-w-*` on `(app)` page containers; trainer pages use `px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5` inside `<section className="min-h-screen bg-kore-cream">`.
- User-facing copy is in Spanish; code, comments and commits in English.
- **The default reschedule window stays 24**, identical to the three constants being removed, so production behaviour does not change until someone moves the knob.
- `reschedule_window_hours` is validated to **0–168**.
- No new migration: every field already exists on `CreditSettings`.

## File Structure

**Backend**
- `core_app/views/booking_views.py` — delete `CANCEL_RESCHEDULE_HOURS`; both guards read the setting.
- `core_app/views/credit_views.py` — `CreditValuesView` payload gains `reschedule_window_hours`.
- `core_app/serializers/credit_serializers.py` — range validation on `reschedule_window_hours`.
- Tests: `core_app/tests/views/test_booking_reschedule_window.py` *(new)*, `core_app/tests/views/test_credit_settings_view.py` *(new)*.

**Frontend**
- `lib/stores/creditValuesStore.ts` — expose `rescheduleWindowHours` (default 24).
- `lib/stores/trainerSettingsStore.ts` *(new)* — the trainer's read/write of the settings.
- `app/components/booking/SessionDetailModal.tsx` — read the window from `creditValuesStore`.
- `app/(app)/trainer/configuracion/page.tsx` *(new)* — the panel.
- `app/components/layouts/TrainerSidebar.tsx`, `app/components/layouts/TrainerMobileBottomNav.tsx` — nav entries.
- `app/__tests__/stores/trainerSettingsStore.test.ts` *(new)*.
- `e2e/trainer/trainer-settings.spec.ts` *(new)*, `e2e/helpers/flow-tags.ts`, `e2e/flow-definitions.json`, `docs/USER_FLOW_MAP.md`.

**Docs**
- `docs/release-july/GUIA_DE_VALIDACION.md`, `docs/release-july/GUIA_QA_STAGING.md`.

---

### Task 1: One reschedule window, read from the settings

**Files:**
- Modify: `backend/core_app/views/booking_views.py` (delete line 25; guards at 172 and 226)
- Test: `backend/core_app/tests/views/test_booking_reschedule_window.py` *(new)*

**Interfaces:**
- Consumes: `credit_engine.get_settings()` → `CreditSettings` with `reschedule_window_hours`.
- Produces: cancel and reschedule reject a customer inside the configured window and quote it in the message. `CANCEL_RESCHEDULE_HOURS` no longer exists.

**Careful:** the existing `test_cancel_within_24h_fails` (`test_booking_views_extended.py:126`) asserts `'24' in response.data['detail']`. With the default still 24, the interpolated message keeps saying 24, so it stays green. Do not change that test.

- [ ] **Step 1: Write the failing tests**

Create `backend/core_app/tests/views/test_booking_reschedule_window.py`:

```python
"""The reschedule/cancel window is whatever CreditSettings says — not a constant."""

from datetime import timedelta

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import Booking, Package, Subscription, TrainerProfile, User
from core_app.models.credit import CreditSettings


@pytest.fixture
def window_48(db):
    settings_obj = CreditSettings.load()
    settings_obj.reschedule_window_hours = 48
    settings_obj.save(update_fields=['reschedule_window_hours'])
    return settings_obj


@pytest.fixture
def package(db):
    return Package.objects.create(title='Plan', sessions_count=4, price=100000)


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='window-customer@kore.com', password='p',
        first_name='Ana', last_name='Cliente', role=User.Role.CUSTOMER,
    )


def _booking(customer, package, hours_out, trainer=None):
    start = timezone.now() + timedelta(hours=hours_out)
    Subscription.objects.create(
        customer=customer, package=package, sessions_total=4,
        starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30),
        status=Subscription.Status.ACTIVE,
    )
    return Booking.objects.create(
        customer=customer, package=package, trainer=trainer,
        starts_at=start, ends_at=start + timedelta(hours=1),
        status=Booking.Status.CONFIRMED,
    )


@pytest.mark.django_db
def test_cancel_inside_the_configured_window_is_rejected(api_client, customer, package, window_48):
    # 30h out: allowed under the old hardcoded 24h, rejected under the configured 48h.
    booking = _booking(customer, package, hours_out=30)
    api_client.force_authenticate(user=customer)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert '48' in response.data['detail']


@pytest.mark.django_db
def test_cancel_outside_the_configured_window_is_allowed(api_client, customer, package, window_48):
    booking = _booking(customer, package, hours_out=60)
    api_client.force_authenticate(user=customer)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_200_OK
    booking.refresh_from_db()
    assert booking.status == Booking.Status.CANCELED


@pytest.mark.django_db
def test_reschedule_inside_the_configured_window_is_rejected(api_client, customer, package, window_48):
    booking = _booking(customer, package, hours_out=30)
    api_client.force_authenticate(user=customer)
    new_start = (timezone.now() + timedelta(days=7)).isoformat()

    response = api_client.post(
        reverse('booking-reschedule', args=[booking.pk]),
        {'new_starts_at': new_start}, format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST
    assert '48' in response.data['detail']


@pytest.mark.django_db
def test_the_trainer_still_bypasses_the_window(api_client, customer, package, window_48, db):
    trainer_user = User.objects.create_user(
        email='window-trainer@kore.com', password='p',
        first_name='Tina', last_name='Trainer', role=User.Role.TRAINER,
    )
    profile = TrainerProfile.objects.create(user=trainer_user)
    booking = _booking(customer, package, hours_out=2, trainer=profile)
    api_client.force_authenticate(user=trainer_user)

    response = api_client.post(reverse('booking-cancel', args=[booking.pk]))

    assert response.status_code == status.HTTP_200_OK
```

- [ ] **Step 2: Delete the constant**

In `backend/core_app/views/booking_views.py`, delete line 25:

```python
CANCEL_RESCHEDULE_HOURS = 24
```

and add a helper right below the imports, next to `_is_trainer_owner`:

```python
def _reschedule_window_hours() -> int:
    """The single window that blocks a late cancel/reschedule AND triggers the
    credit penalty (`credit_engine.on_reschedule` reads the same field)."""
    from core_app.services import credit_engine
    return credit_engine.get_settings().reschedule_window_hours
```

- [ ] **Step 3: Read the setting in the cancel guard**

In the `cancel` action, replace:

```python
        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
                return Response(
                    {'detail': f'No puedes cancelar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
```

with:

```python
        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            window = _reschedule_window_hours()
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=window):
                return Response(
                    {'detail': f'No puedes cancelar con menos de {window} horas de anticipación.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
```

- [ ] **Step 4: Read the setting in the reschedule guard**

In the `reschedule` action, replace:

```python
        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=CANCEL_RESCHEDULE_HOURS):
                return Response(
                    {'detail': f'No puedes reprogramar con menos de {CANCEL_RESCHEDULE_HOURS} horas de anticipación.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
```

with:

```python
        bypass_window = is_admin_user(request.user) or _is_trainer_owner(request.user, booking)
        if not bypass_window:
            window = _reschedule_window_hours()
            time_until = booking.starts_at - timezone.now()
            if time_until < timedelta(hours=window):
                return Response(
                    {'detail': f'No puedes reprogramar con menos de {window} horas de anticipación.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
```

- [ ] **Step 5: Verify the constant is gone**

Run: `cd backend && grep -rn "CANCEL_RESCHEDULE_HOURS" core_app/ --include=*.py`
Expected: no output.

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/views/booking_views.py backend/core_app/tests/views/test_booking_reschedule_window.py
git -C /home/cerrotico/work/kore_project commit -m "feat(booking): the reschedule window comes from CreditSettings, not a constant

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 2: Expose the window to the customer, and bound it

**Files:**
- Modify: `backend/core_app/views/credit_views.py` (`CreditValuesView.get`, ~line 165)
- Modify: `backend/core_app/serializers/credit_serializers.py` (`CreditSettingsSerializer`)
- Test: `backend/core_app/tests/views/test_credit_settings_view.py` *(new)*

**Interfaces:**
- Consumes: `CreditSettings`.
- Produces: `GET /api/credits/values/` payload gains `reschedule_window_hours: int`. `PUT /api/credits/settings/` rejects a `reschedule_window_hours` outside 0–168 with a 400. Tasks 3 and 5 consume the new field.

- [ ] **Step 1: Write the failing tests**

Create `backend/core_app/tests/views/test_credit_settings_view.py`:

```python
"""The customer reads the reschedule window; only the trainer writes the settings."""

import pytest
from django.urls import reverse
from rest_framework import status

from core_app.models import TrainerProfile, User
from core_app.models.credit import CreditSettings
from core_app.services import credit_engine


@pytest.fixture
def trainer_user(db):
    user = User.objects.create_user(
        email='settings-trainer@kore.com', password='p',
        first_name='Tina', last_name='Trainer', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=user)
    return user


@pytest.mark.django_db
def test_credit_values_exposes_the_reschedule_window(api_client, existing_user):
    settings_obj = credit_engine.get_settings()
    settings_obj.reschedule_window_hours = 36
    settings_obj.save(update_fields=['reschedule_window_hours'])
    api_client.force_authenticate(user=existing_user)

    response = api_client.get(reverse('credits-values'))

    assert response.status_code == status.HTTP_200_OK
    assert response.data['reschedule_window_hours'] == 36


@pytest.mark.django_db
def test_a_customer_cannot_write_the_settings(api_client, existing_user):
    api_client.force_authenticate(user=existing_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 12}, format='json',
    )

    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_the_trainer_updates_the_window(api_client, trainer_user):
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 48}, format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    assert CreditSettings.load().reschedule_window_hours == 48


@pytest.mark.django_db
def test_an_absurd_window_is_rejected(api_client, trainer_user):
    # Without a ceiling, a typo would freeze everyone's booking for weeks.
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'), {'reschedule_window_hours': 200}, format='json',
    )

    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_changing_the_difficulty_reseeds_the_action_values(api_client, trainer_user):
    credit_engine.get_settings()  # seed the medium preset
    api_client.force_authenticate(user=trainer_user)

    response = api_client.put(
        reverse('credits-settings'),
        {'difficulty': 'hard', 'action_values': {}, 'streak_bonuses': {}},
        format='json',
    )

    assert response.status_code == status.HTTP_200_OK
    settings_obj = CreditSettings.load()
    assert settings_obj.difficulty == 'hard'
    assert settings_obj.action_values['workout_day'] == 10  # the hard preset
```

- [ ] **Step 2: Add the field to the customer payload**

In `backend/core_app/views/credit_views.py`, inside `CreditValuesView.get`, add the window to the response:

```python
    def get(self, request):
        settings_obj = credit_engine.get_settings()
        return Response({
            'action_values': settings_obj.action_values,
            'streak_bonuses': settings_obj.streak_bonuses,
            'water_goal_glasses': settings_obj.water_goal_glasses,
            'meal_review_days': settings_obj.meal_review_days,
            'require_workout_captures': settings_obj.require_workout_captures,
            # The client's SessionDetailModal gates its cancel/reschedule buttons
            # on this, so it must be the same number booking_views enforces.
            'reschedule_window_hours': settings_obj.reschedule_window_hours,
        })
```

- [ ] **Step 3: Bound the window in the serializer**

In `backend/core_app/serializers/credit_serializers.py`, add the validator to `CreditSettingsSerializer`:

```python
class CreditSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = CreditSettings
        fields = (
            'difficulty', 'action_values', 'streak_bonuses',
            'training_day_threshold', 'nutrition_min_meals', 'water_goal_glasses',
            'meal_review_days', 'reschedule_window_hours', 'require_workout_captures',
        )

    def validate_reschedule_window_hours(self, value):
        # PositiveSmallIntegerField would happily take 32767: a typo of "480"
        # would freeze every customer's booking for 20 days.
        if not 0 <= value <= 168:
            raise serializers.ValidationError('La ventana debe estar entre 0 y 168 horas (una semana).')
        return value
```

- [ ] **Step 4: Verify**

Run: `cd backend && source venv/bin/activate && python manage.py check`
Expected: `System check identified no issues`.

- [ ] **Step 5: Commit**

```bash
git -C /home/cerrotico/work/kore_project add backend/core_app/views/credit_views.py backend/core_app/serializers/credit_serializers.py backend/core_app/tests/views/test_credit_settings_view.py
git -C /home/cerrotico/work/kore_project commit -m "feat(credits): expose the reschedule window to clients and bound it to 0-168h

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 3: The customer's modal stops hardcoding 24h

**Files:**
- Modify: `frontend/lib/stores/creditValuesStore.ts`
- Modify: `frontend/app/components/booking/SessionDetailModal.tsx` (line 14 and its three usages)

**Interfaces:**
- Consumes: `reschedule_window_hours` from `GET /credits/values/` (Task 2).
- Produces: `useCreditValuesStore().rescheduleWindowHours: number` (defaults to 24).

**Careful:** the existing test `SessionDetailModal.test.tsx:113` ("disables buttons when booking is within 24h") does not mock this store. The default of 24 is what keeps it green — do not remove it, and do not change that test.

- [ ] **Step 1: Add the field to the store**

In `frontend/lib/stores/creditValuesStore.ts`, add to the `CreditValuesState` type, after `waterGoalGlasses`:

```ts
  rescheduleWindowHours: number;
```

add the default in the store body, after `waterGoalGlasses: 8,`:

```ts
  rescheduleWindowHours: 24,
```

and read it in `fetchValues`, inside the `set({...})` call:

```ts
        rescheduleWindowHours: data.reschedule_window_hours ?? 24,
```

The `?? 24` fallback matters: if the request fails the store keeps 24, which is what the backend enforces by default, so the buttons never enable on something the API will reject.

- [ ] **Step 2: Read the window in the modal**

In `frontend/app/components/booking/SessionDetailModal.tsx`, delete line 14:

```tsx
const CANCEL_HOURS = 24;
```

add the store import next to the existing one:

```tsx
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
```

and inside the component, right after `const { loading, error, cancelBooking } = useBookingStore();`:

```tsx
  // The same window booking_views enforces; 24 until /credits/values/ answers.
  const cancelHours = useCreditValuesStore((s) => s.rescheduleWindowHours);
  const fetchValues = useCreditValuesStore((s) => s.fetchValues);

  useEffect(() => {
    fetchValues();
  }, [fetchValues]);
```

Add `useEffect` to the existing `react` import (it currently imports `useCallback, useState`).

Then replace the three usages of `CANCEL_HOURS` with `cancelHours`:

```tsx
  const canModify = booking.status !== 'canceled' && hoursUntil >= cancelHours;
```

```tsx
                No se puede modificar a menos de {cancelHours}h de la sesión
```

```tsx
                title={!canModify ? `No se puede reprogramar a menos de ${cancelHours}h` : ''}
```

```tsx
                title={!canModify ? `No se puede cancelar a menos de ${cancelHours}h` : ''}
```

- [ ] **Step 3: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 4: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/lib/stores/creditValuesStore.ts frontend/app/components/booking/SessionDetailModal.tsx
git -C /home/cerrotico/work/kore_project commit -m "feat(booking): the session modal reads the reschedule window from the API

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 4: `trainerSettingsStore`

**Files:**
- Create: `frontend/lib/stores/trainerSettingsStore.ts`
- Test: `frontend/app/__tests__/stores/trainerSettingsStore.test.ts`

**Interfaces:**
- Consumes: `GET`/`PUT /api/credits/settings/`.
- Produces: `useTrainerSettingsStore` with `{ settings: TrainerSettings | null, loading, saving, error, fetchSettings(), updateSettings(patch: Partial<TrainerSettings>) => Promise<boolean> }` where

  ```ts
  type TrainerSettings = {
    difficulty: 'easy' | 'medium' | 'hard';
    action_values: Record<string, number>;
    streak_bonuses: Record<string, number>;
    training_day_threshold: number;
    nutrition_min_meals: number;
    water_goal_glasses: number;
    meal_review_days: number;
    reschedule_window_hours: number;
    require_workout_captures: boolean;
  };
  ```

  Task 5 consumes these names.

- [ ] **Step 1: Write the failing test**

Create `frontend/app/__tests__/stores/trainerSettingsStore.test.ts`:

```ts
import { api } from '@/lib/services/http';
import { useTrainerSettingsStore } from '@/lib/stores/trainerSettingsStore';

jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), put: jest.fn() },
  extractApiError: (_err: unknown, fallback: string) => fallback,
}));
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'token') }));

const mockApi = api as unknown as { get: jest.Mock; put: jest.Mock };

const SETTINGS = {
  difficulty: 'medium' as const,
  action_values: { workout_day: 15, meal_photo: 5 },
  streak_bonuses: { '3': 20 },
  training_day_threshold: 0.7,
  nutrition_min_meals: 3,
  water_goal_glasses: 8,
  meal_review_days: 3,
  reschedule_window_hours: 24,
  require_workout_captures: true,
};

beforeEach(() => {
  jest.clearAllMocks();
  useTrainerSettingsStore.setState({
    settings: null, loading: false, saving: false, error: '',
  });
});

test('fetchSettings stores the configuration', async () => {
  mockApi.get.mockResolvedValue({ data: SETTINGS });

  await useTrainerSettingsStore.getState().fetchSettings();

  expect(mockApi.get).toHaveBeenCalledWith('/credits/settings/', expect.anything());
  expect(useTrainerSettingsStore.getState().settings?.difficulty).toBe('medium');
  expect(useTrainerSettingsStore.getState().loading).toBe(false);
});

test('updateSettings PUTs the patch and keeps the response', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockResolvedValue({
    data: { ...SETTINGS, reschedule_window_hours: 48 },
  });

  const ok = await useTrainerSettingsStore.getState().updateSettings({
    reschedule_window_hours: 48,
  });

  expect(ok).toBe(true);
  expect(mockApi.put).toHaveBeenCalledWith(
    '/credits/settings/',
    { reschedule_window_hours: 48 },
    expect.anything(),
  );
  expect(useTrainerSettingsStore.getState().settings?.reschedule_window_hours).toBe(48);
});

test('changing the difficulty sends empty maps so the backend reseeds them', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockResolvedValue({
    data: { ...SETTINGS, difficulty: 'hard', action_values: { workout_day: 10 } },
  });

  await useTrainerSettingsStore.getState().updateSettings({
    difficulty: 'hard',
    action_values: {},
    streak_bonuses: {},
  });

  expect(mockApi.put).toHaveBeenCalledWith(
    '/credits/settings/',
    { difficulty: 'hard', action_values: {}, streak_bonuses: {} },
    expect.anything(),
  );
  expect(useTrainerSettingsStore.getState().settings?.action_values.workout_day).toBe(10);
});

test('updateSettings surfaces an error and returns false on failure', async () => {
  useTrainerSettingsStore.setState({ settings: SETTINGS });
  mockApi.put.mockRejectedValue(new Error('boom'));

  const ok = await useTrainerSettingsStore.getState().updateSettings({
    reschedule_window_hours: 200,
  });

  expect(ok).toBe(false);
  expect(useTrainerSettingsStore.getState().error).not.toBe('');
  expect(useTrainerSettingsStore.getState().saving).toBe(false);
});
```

- [ ] **Step 2: Write the store**

Create `frontend/lib/stores/trainerSettingsStore.ts`:

```ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api, extractApiError } from '@/lib/services/http';

export type Difficulty = 'easy' | 'medium' | 'hard';

export type TrainerSettings = {
  difficulty: Difficulty;
  action_values: Record<string, number>;
  streak_bonuses: Record<string, number>;
  training_day_threshold: number;
  nutrition_min_meals: number;
  water_goal_glasses: number;
  meal_review_days: number;
  reschedule_window_hours: number;
  require_workout_captures: boolean;
};

type TrainerSettingsState = {
  settings: TrainerSettings | null;
  loading: boolean;
  saving: boolean;
  error: string;

  fetchSettings: () => Promise<void>;
  updateSettings: (patch: Partial<TrainerSettings>) => Promise<boolean>;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useTrainerSettingsStore = create<TrainerSettingsState>((set) => ({
  settings: null,
  loading: false,
  saving: false,
  error: '',

  fetchSettings: async () => {
    set({ loading: true, error: '' });
    try {
      const { data } = await api.get('/credits/settings/', { headers: authHeaders() });
      set({ settings: data as TrainerSettings, loading: false });
    } catch {
      set({ error: 'No se pudo cargar la configuración.', loading: false });
    }
  },

  // Sending `action_values: {}` alongside a new difficulty is what makes the
  // backend reseed the preset — that emptiness is the signal, not an oversight.
  updateSettings: async (patch) => {
    set({ saving: true, error: '' });
    try {
      const { data } = await api.put('/credits/settings/', patch, { headers: authHeaders() });
      set({ settings: data as TrainerSettings, saving: false });
      return true;
    } catch (err) {
      set({
        error: extractApiError(err, 'No se pudo guardar la configuración.'),
        saving: false,
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
git -C /home/cerrotico/work/kore_project add frontend/lib/stores/trainerSettingsStore.ts frontend/app/__tests__/stores/trainerSettingsStore.test.ts
git -C /home/cerrotico/work/kore_project commit -m "feat(trainer): trainerSettingsStore for the credit configuration

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 5: The `/trainer/configuracion` page and its nav entries

**Files:**
- Create: `frontend/app/(app)/trainer/configuracion/page.tsx`
- Modify: `frontend/app/components/layouts/TrainerSidebar.tsx`
- Modify: `frontend/app/components/layouts/TrainerMobileBottomNav.tsx`

**Interfaces:**
- Consumes: `useTrainerSettingsStore` (Task 4).
- Produces: the testids Task 6 asserts on — `trainer-settings`, `difficulty-{easy|medium|hard}`, `difficulty-confirm`, `reschedule-window`, `settings-save`.

- [ ] **Step 1: Write the page**

Create `frontend/app/(app)/trainer/configuracion/page.tsx`:

```tsx
'use client';

import { useEffect, useState } from 'react';
import {
  useTrainerSettingsStore,
  type Difficulty,
  type TrainerSettings,
} from '@/lib/stores/trainerSettingsStore';

const DIFFICULTIES: Array<{ key: Difficulty; label: string; hint: string }> = [
  { key: 'easy', label: 'Fácil', hint: 'Más puntos por acción. Para arrancar y enganchar.' },
  { key: 'medium', label: 'Medio', hint: 'El equilibrio por defecto.' },
  { key: 'hard', label: 'Difícil', hint: 'Menos puntos, penalizaciones más altas.' },
];

const ACTION_LABEL: Record<string, string> = {
  physical_test_passed: 'Test físico aprobado',
  session_attended: 'Asistir a la sesión',
  session_rated: 'Calificar la sesión',
  workout_day: 'Día de entrenamiento',
  meal_photo: 'Comida con foto',
  checkin: 'Check-in diario',
  water_goal: 'Meta de agua',
  no_show_penalty: 'No asistir (penalización)',
  late_reschedule_penalty: 'Reprogramar tarde (penalización)',
};

export default function TrainerSettingsPage() {
  const settings = useTrainerSettingsStore((s) => s.settings);
  const loading = useTrainerSettingsStore((s) => s.loading);
  const saving = useTrainerSettingsStore((s) => s.saving);
  const error = useTrainerSettingsStore((s) => s.error);
  const fetchSettings = useTrainerSettingsStore((s) => s.fetchSettings);
  const updateSettings = useTrainerSettingsStore((s) => s.updateSettings);

  const [form, setForm] = useState<Partial<TrainerSettings>>({});
  const [pendingDifficulty, setPendingDifficulty] = useState<Difficulty | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  useEffect(() => {
    if (settings) setForm(settings);
  }, [settings]);

  const field = <K extends keyof TrainerSettings>(key: K): TrainerSettings[K] | undefined =>
    (form[key] ?? settings?.[key]) as TrainerSettings[K] | undefined;

  const confirmDifficulty = async () => {
    if (!pendingDifficulty) return;
    // Empty maps are the signal the backend uses to reseed them from the preset.
    await updateSettings({
      difficulty: pendingDifficulty,
      action_values: {},
      streak_bonuses: {},
    });
    setPendingDifficulty(null);
  };

  const saveRules = async () => {
    const ok = await updateSettings({
      training_day_threshold: Number(field('training_day_threshold')),
      nutrition_min_meals: Number(field('nutrition_min_meals')),
      water_goal_glasses: Number(field('water_goal_glasses')),
      meal_review_days: Number(field('meal_review_days')),
      require_workout_captures: !!field('require_workout_captures'),
      reschedule_window_hours: Number(field('reschedule_window_hours')),
    });
    setSaved(ok);
  };

  const actionValues = settings?.action_values ?? {};

  return (
    <section className="min-h-screen bg-kore-cream">
      <div
        data-testid="trainer-settings"
        className="px-5 xl:px-10 pt-20 xl:pt-8 pb-24 space-y-5"
      >
        <h1 className="text-lg font-bold text-kore-gray-dark">Configuración</h1>

        {error && <p className="text-sm font-semibold text-kore-red">{error}</p>}
        {loading && <p className="text-sm text-kore-gray-dark/50">Cargando…</p>}

        {/* ── Dificultad ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Dificultad</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Define cuántos puntos otorga cada acción y cuánto pesan las penalizaciones.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-2">
            {DIFFICULTIES.map((d) => {
              const active = field('difficulty') === d.key;
              return (
                <button
                  key={d.key}
                  type="button"
                  data-testid={`difficulty-${d.key}`}
                  onClick={() => !active && setPendingDifficulty(d.key)}
                  className={`rounded-xl p-3 text-left border transition-colors ${
                    active
                      ? 'bg-kore-red text-white border-transparent'
                      : 'bg-white/60 text-kore-gray-dark/50 border-kore-gray-light/40'
                  }`}
                >
                  <span className="block text-sm font-bold">{d.label}</span>
                  <span className="block text-[11px] leading-snug mt-1 opacity-80">{d.hint}</span>
                </button>
              );
            })}
          </div>

          {!!Object.keys(actionValues).length && (
            <ul className="divide-y divide-kore-gray-light/40">
              {Object.entries(actionValues).map(([action, value]) => (
                <li key={action} className="flex items-center justify-between py-2">
                  <span className="text-xs text-kore-gray-dark/80">
                    {ACTION_LABEL[action] ?? action}
                  </span>
                  <span
                    className={`text-xs font-bold ${
                      value < 0 ? 'text-kore-red' : 'text-kore-gray-dark'
                    }`}
                  >
                    {value > 0 ? `+${value}` : value}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* ── Reglas de actividad ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-4">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Reglas de actividad</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Qué tiene que cumplir el cliente para que el día cuente.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Umbral de entrenamiento (%)
              </span>
              <input
                type="number"
                min={0}
                max={100}
                value={Math.round((Number(field('training_day_threshold')) || 0) * 100)}
                onChange={(e) =>
                  setForm((f) => ({
                    ...f,
                    training_day_threshold: Number(e.target.value) / 100,
                  }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Comidas mínimas
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('nutrition_min_meals')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, nutrition_min_meals: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Meta de agua (vasos)
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('water_goal_glasses')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, water_goal_glasses: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>

            <label className="block">
              <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
                Días de revisión de comidas
              </span>
              <input
                type="number"
                min={0}
                value={Number(field('meal_review_days')) || 0}
                onChange={(e) =>
                  setForm((f) => ({ ...f, meal_review_days: Number(e.target.value) }))
                }
                className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
              />
            </label>
          </div>

          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={!!field('require_workout_captures')}
              onChange={(e) =>
                setForm((f) => ({ ...f, require_workout_captures: e.target.checked }))
              }
            />
            <span className="text-sm text-kore-gray-dark/80">
              Exigir fotos de cámara para acreditar el entrenamiento
            </span>
          </label>
        </div>

        {/* ── Reagendamiento ── */}
        <div className="bg-white rounded-2xl p-5 border border-kore-gray-light/40 shadow-sm space-y-3">
          <div>
            <h2 className="text-sm font-bold text-kore-gray-dark">Reagendamiento</h2>
            <p className="text-xs text-kore-gray-dark/50">
              Con menos de estas horas de anticipación, el cliente <strong>no puede</strong>{' '}
              cancelar ni reprogramar. Si lo hace justo en el límite, se le aplica la penalización
              de puntos. Tú y los administradores siempre pueden hacerlo.
            </p>
          </div>

          <label className="block max-w-[200px]">
            <span className="block text-xs font-semibold text-kore-gray-dark/50 mb-1">
              Horas de anticipación
            </span>
            <input
              type="number"
              min={0}
              max={168}
              data-testid="reschedule-window"
              value={Number(field('reschedule_window_hours')) || 0}
              onChange={(e) =>
                setForm((f) => ({ ...f, reschedule_window_hours: Number(e.target.value) }))
              }
              className="w-full rounded-xl border border-kore-gray-light/60 p-2.5 text-sm"
            />
          </label>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            data-testid="settings-save"
            onClick={saveRules}
            disabled={saving || loading}
            className="bg-kore-red text-white rounded-xl px-4 py-3 text-sm font-medium hover:bg-kore-red-dark transition-colors disabled:opacity-50"
          >
            {saving ? 'Guardando…' : 'Guardar cambios'}
          </button>
          {saved && <span className="text-sm text-kore-sage-deep font-semibold">Guardado</span>}
        </div>
      </div>

      {pendingDifficulty && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md space-y-4">
            <h3 className="text-base font-bold text-kore-gray-dark">Cambiar la dificultad</h3>
            <p className="text-sm text-kore-gray-dark/80 leading-relaxed">
              Se reescribirán los puntos de cada acción y los bonos de racha con los del preset{' '}
              <strong>{DIFFICULTIES.find((d) => d.key === pendingDifficulty)?.label}</strong>. Los
              puntos que ya ganaron tus clientes no cambian.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPendingDifficulty(null)}
                className="px-4 py-2 text-sm text-kore-gray-dark/50"
              >
                Cancelar
              </button>
              <button
                type="button"
                data-testid="difficulty-confirm"
                onClick={confirmDifficulty}
                disabled={saving}
                className="bg-kore-red text-white rounded-xl px-4 py-2 text-sm font-medium disabled:opacity-50"
              >
                {saving ? 'Aplicando…' : 'Aplicar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Add the sidebar entry**

In `frontend/app/components/layouts/TrainerSidebar.tsx`, add the icon next to the other inline SVG icons:

```tsx
const SettingsIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
```

and the nav item at the end of the `Operación` group, after `messages`:

```tsx
          { key: 'settings', label: 'Configuración', href: '/trainer/configuracion', icon: SettingsIcon },
```

- [ ] **Step 3: Add the mobile nav entry**

In `frontend/app/components/layouts/TrainerMobileBottomNav.tsx`, add the same `SettingsIcon` next to the other icons:

```tsx
const SettingsIcon = (
  <svg {...iconProps}>
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.6 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9v.09a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
);
```

and the entry to `moreItems`, before `support`:

```tsx
    { key: 'settings', label: 'Configuración', icon: SettingsIcon, href: '/trainer/configuracion' },
```

- [ ] **Step 4: Typecheck**

Run: `cd frontend && npx tsc --noEmit`
Expected: exit 0, no output.

- [ ] **Step 5: Commit**

```bash
git -C /home/cerrotico/work/kore_project add "frontend/app/(app)/trainer/configuracion" frontend/app/components/layouts/TrainerSidebar.tsx frontend/app/components/layouts/TrainerMobileBottomNav.tsx
git -C /home/cerrotico/work/kore_project commit -m "feat(trainer): settings page (difficulty, activity rules, reschedule window)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 6: E2E spec and the flow triplet

**Files:**
- Create: `frontend/e2e/trainer/trainer-settings.spec.ts`
- Modify: `frontend/e2e/helpers/flow-tags.ts`
- Modify: `frontend/e2e/flow-definitions.json`
- Modify: `docs/USER_FLOW_MAP.md`

**Interfaces:**
- Consumes: the testids from Task 5, `injectTrainerAuthCookies` from `e2e/fixtures.ts`.
- Produces: the `trainer-settings` flow, registered in all three files.

The three triplet files always change together and both versions get bumped — CI's `e2e-flow-definitions-sync` job checks it.

- [ ] **Step 1: Add the flow tag**

In `frontend/e2e/helpers/flow-tags.ts`, add next to the other trainer flows:

```ts
  TRAINER_SETTINGS: ['@flow:trainer-settings', '@module:trainer', '@priority:P2'],
```

- [ ] **Step 2: Register the flow definition**

In `frontend/e2e/flow-definitions.json`, bump `"version"` to `"1.9.0"` and `"lastUpdated"` to `"2026-07-14"`, then add to the `"flows"` object:

```json
    "trainer-settings": {
      "name": "Trainer Settings Panel",
      "module": "trainer",
      "priority": "P2",
      "roles": ["trainer"],
      "description": "Configure the credit economy at /trainer/configuracion: pick the difficulty preset (reseeding the per-action values behind a confirmation), set the activity thresholds, and set the reschedule window that blocks late cancels and triggers the penalty.",
      "coverage": "covered"
    },
```

Edit the JSON **by hand**: rewriting it with a script reformats every array in the file and buries the real change in a 300-line diff.

- [ ] **Step 3: Document the flow**

In `docs/USER_FLOW_MAP.md`, bump `Version` to `2.2` and `Last Updated` to `2026-07-14`, then add this section at the top of `## Trainer Flows`, matching the file's bullet style:

```markdown
### trainer-settings: Trainer Settings Panel
- Module: trainer
- Priority: P2
- Route: /trainer/configuracion
- Roles: trainer
- Coverage: **Covered** (`e2e/trainer/trainer-settings.spec.ts`)
- Description: The trainer configures the credit economy: difficulty preset, activity thresholds, and the reschedule window.

**Steps**
1. The trainer opens **Configuración** from the sidebar (or *Más* on mobile). `GET /api/credits/settings/` loads the current values.
2. **Dificultad**: picking another preset opens a confirmation, then `PUT /api/credits/settings/` with `{difficulty, action_values: {}, streak_bonuses: {}}` — the empty maps are what make the backend reseed the per-action values. A read-only table shows what each action grants.
3. **Reglas de actividad**: training-day threshold, minimum meals, water goal, meal review days, require-captures toggle.
4. **Reagendamiento**: the window in hours (0–168). This single number blocks a late cancel/reschedule in `booking_views`, triggers the `late_reschedule_penalty` in `credit_engine.on_reschedule`, and gates the buttons in the customer's `SessionDetailModal` (which reads it from `GET /api/credits/values/`).

**Branches / Variations**
- Trainers and admins bypass the reschedule window entirely.
- A window outside 0–168 is rejected with a 400.
- Changing the difficulty does not touch credits customers already earned; the ledger is append-only.
```

- [ ] **Step 4: Write the E2E spec**

Create `frontend/e2e/trainer/trainer-settings.spec.ts`:

```ts
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import { FlowTags, RoleTags } from '../helpers/flow-tags';

/**
 * @flow:trainer-settings
 * The trainer configures the credit economy: difficulty preset and the
 * reschedule window that governs the block, the penalty and the client's UI.
 */

const SETTINGS = {
  difficulty: 'medium',
  action_values: { workout_day: 15, meal_photo: 5, no_show_penalty: -40 },
  streak_bonuses: { '3': 20, '7': 50 },
  training_day_threshold: 0.7,
  nutrition_min_meals: 3,
  water_goal_glasses: 8,
  meal_review_days: 3,
  reschedule_window_hours: 24,
  require_workout_captures: true,
};

test.describe('Trainer — configuración', { tag: [...FlowTags.TRAINER_SETTINGS, RoleTags.TRAINER] }, () => {
  test.use({ viewport: { width: 1440, height: 900 } });

  test.beforeEach(async ({ page }) => {
    await injectTrainerAuthCookies(page);
  });

  test('switching the difficulty asks for confirmation and reseeds the values', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    await page.route('**/api/credits/settings/', (r) => {
      if (r.request().method() === 'PUT') {
        put = r.request().postDataJSON();
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...SETTINGS, difficulty: 'hard', action_values: { workout_day: 10 } }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS),
      });
    });

    await page.goto('/trainer/configuracion');
    await expect(page.getByTestId('trainer-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Día de entrenamiento')).toBeVisible();

    await page.getByTestId('difficulty-hard').click();

    // The reseed is destructive, so it is stated before it happens.
    await expect(page.getByText('Se reescribirán los puntos', { exact: false })).toBeVisible();
    await page.getByTestId('difficulty-confirm').click();

    expect(put).toMatchObject({ difficulty: 'hard', action_values: {}, streak_bonuses: {} });
  });

  test('saves the reschedule window', async ({ page }) => {
    let put: Record<string, unknown> | null = null;
    await page.route('**/api/credits/settings/', (r) => {
      if (r.request().method() === 'PUT') {
        put = r.request().postDataJSON();
        return r.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ ...SETTINGS, reschedule_window_hours: 48 }),
        });
      }
      return r.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(SETTINGS),
      });
    });

    await page.goto('/trainer/configuracion');
    await expect(page.getByTestId('trainer-settings')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId('reschedule-window')).toHaveValue('24');

    await page.getByTestId('reschedule-window').fill('48');
    await page.getByTestId('settings-save').click();

    await expect(page.getByText('Guardado')).toBeVisible();
    expect(put).toMatchObject({ reschedule_window_hours: 48 });
  });
});
```

- [ ] **Step 5: Validate the JSON**

Run: `cd frontend && python3 -c "import json; d=json.load(open('e2e/flow-definitions.json')); print(d['version'], 'trainer-settings' in d['flows'])"`
Expected: `1.9.0 True`

Run: `git -C /home/cerrotico/work/kore_project diff --stat frontend/e2e/flow-definitions.json`
Expected: roughly 10 insertions, 2 deletions. A diff of hundreds of lines means the file got reformatted — revert and edit by hand.

- [ ] **Step 6: Commit**

```bash
git -C /home/cerrotico/work/kore_project add frontend/e2e/trainer/trainer-settings.spec.ts frontend/e2e/helpers/flow-tags.ts frontend/e2e/flow-definitions.json docs/USER_FLOW_MAP.md
git -C /home/cerrotico/work/kore_project commit -m "test(trainer): E2E + flow triplet for the settings panel

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task 7: Release guides

**Files:**
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md`
- Modify: `docs/release-july/GUIA_QA_STAGING.md`

**Interfaces:**
- Consumes: the behaviour shipped in Tasks 1–6.
- Produces: nothing consumed by later tasks.

- [ ] **Step 1: Add the validation-guide entry**

In `docs/release-july/GUIA_DE_VALIDACION.md`, add a `## Parte 10 — Configuración del entrenador` section before the `## Próximas secciones` block, with a `### Funcionalidad 15 (entrenador): Dificultad, reglas y reagendamiento` block in the same five-heading voice as its neighbours (¿Qué es y para qué sirve? / Antes de empezar / Paso a paso / Cómo sabes que funcionó / Si algo no sale como esperabas).

State plainly: changing the difficulty **rewrites the points of every action** (the already-earned points do not change); the reschedule hours are **one** number that blocks the client's late cancel/reschedule, applies the penalty, and greys out the buttons in the client's app; and the trainer and the admin can always cancel regardless.

Then update the trailing "Próximas secciones" line to leave only `analítica y KPIs`.

- [ ] **Step 2: Add the QA-staging entry**

In `docs/release-july/GUIA_QA_STAGING.md`, add a `### 3.14 Entrenador — Configuración (Parte 10)` subsection after `3.13`, listing: the panel loads from `GET /api/credits/settings/`; changing the preset sends `action_values: {}` and the backend reseeds (check `CreditSettings.load().action_values` in the shell); a window of 200 is rejected with 400; **setting the window to 48 makes a client's cancel of a session 30h out fail with a message quoting 48**, and the client's session modal greys out its buttons at the same 48h (it reads `reschedule_window_hours` from `GET /api/credits/values/`); the trainer and the admin still cancel inside the window.

- [ ] **Step 3: Commit**

```bash
git -C /home/cerrotico/work/kore_project add docs/release-july/GUIA_DE_VALIDACION.md docs/release-july/GUIA_QA_STAGING.md
git -C /home/cerrotico/work/kore_project commit -m "docs(release): trainer settings panel in validation + QA guides

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Finishing

After all tasks are committed:

1. Run the `e2e-user-flows-check` skill (a frontend user flow changed: a new trainer page, plus the customer's session modal now gates on a server value).
2. Use `superpowers:finishing-a-development-branch` to push and open the PR against **`july-release`** (not `master`).
3. Report the PR URL.
