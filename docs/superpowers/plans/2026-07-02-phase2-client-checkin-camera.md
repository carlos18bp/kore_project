# Phase 2 Part 2 — Client Check-in, Credit Visibility & Workout Camera Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the enriched 4-question check-in, dynamic "+X créditos" chips fed by engine config, the "Hoy ganas" dashboard block, and the workout camera validation flow (consent gate + random captures + deferred upload), turning on `require_workout_captures`.

**Architecture:** Additive backend (3 nullable MoodEntry fields, one read-only credit-values endpoint, one data migration). Frontend: a `creditValuesStore` every chip reads from; the existing mood modal rewritten as a 4-step tap flow; a self-contained `TodayCreditsCard` reading existing stores; camera logic split into pure testable utils (`workoutCaptures.ts`) + a thin `useWorkoutCaptures` hook wired into the routine player's phase machine.

**Tech Stack:** Django 6 + DRF, Next.js 16 App Router + React 19 + TS, Zustand 5, getUserMedia + canvas + `compressImage`, Jest 30, Playwright.

**Spec:** `docs/superpowers/specs/2026-07-02-phase2-client-checkin-camera-design.md`

## Global Constraints

- Branch: `feat/02072026-phase2-client-checkin-camera` (off `july-release`). Commit after every task.
- Client-facing copy in Spanish, hardcoded in JSX. Camera gate copy VERBATIM: title "Validación de tu rutina", body "Durante tu entrenamiento se tomará un video para validar el cumplimiento de tu rutina y entregarte tus créditos cuando tu entrenador lo valide.", buttons "Activar cámara" / "Entrenar sin validar".
- Credit amounts NEVER hardcoded in UI — always `creditValuesStore.value(action)`; hide the chip while values are not loaded.
- Backend additive only; never edit old migrations. Deterministic tests (`frozen_now` fixture backend; `jest.useFakeTimers({now, doNotFake:[...]})` frontend).
- Local test policy: backend pytest + Jest store/util tests run locally (one file at a time); jsdom component suites and Playwright are verified by CI (they hang/flake in the VM — run Playwright locally only with `./node_modules/.bin/playwright test <file> --workers=1` if needed).
- Design system per `frontend/CLAUDE.md` (chips `rounded-full px-2 py-0.5 text-[10px] font-bold`, cards `rounded-2xl`, no toasts).

---

### Task 1: Backend — MoodEntry check-in fields

**Files:**
- Modify: `backend/core_app/models/mood_entry.py`
- Modify: `backend/core_app/serializers/profile_serializers.py:156-165` (`MoodEntrySerializer`)
- Modify: `backend/core_app/views/auth_views.py:350-371` (`mood_view` POST defaults)
- Create: migration via `makemigrations`
- Test: `backend/core_app/tests/views/test_mood_checkin_fields.py`

**Interfaces:**
- Produces: `MoodEntry.energy_level` (1-5, nullable), `MoodEntry.pain` (bool nullable), `MoodEntry.ready_to_train` (bool nullable); `POST /api/auth/mood/` accepts them as optional keys and echoes them back.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_mood_checkin_fields.py
import pytest


@pytest.mark.django_db
def test_mood_post_accepts_checkin_extras(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {
        'score': 8, 'energy_level': 4, 'pain': False, 'ready_to_train': True,
    }, format='json')
    assert resp.status_code == 201
    data = resp.json()
    assert data['energy_level'] == 4
    assert data['pain'] is False
    assert data['ready_to_train'] is True


@pytest.mark.django_db
def test_mood_post_score_only_still_works(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {'score': 7}, format='json')
    assert resp.status_code == 201
    assert resp.json()['energy_level'] is None


@pytest.mark.django_db
def test_mood_energy_level_out_of_range_rejected(api_client, existing_user):
    api_client.force_authenticate(existing_user)
    resp = api_client.post('/api/auth/mood/', {'score': 7, 'energy_level': 9}, format='json')
    assert resp.status_code == 400
```

Note: the mood endpoint may be `/api/auth/mood/` or `/api/mood/` — check `backend/core_app/urls/auth_urls.py` for the exact prefix and use that in all three tests.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd backend && source venv/bin/activate && pytest core_app/tests/views/test_mood_checkin_fields.py --no-cov -q`
Expected: FAIL (unknown fields ignored / missing in response)

- [ ] **Step 3: Implement**

Add to `MoodEntry` (after `notes`):

```python
    energy_level = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Energy 1 (agotado) to 5 (a tope). Optional check-in extra.',
    )
    pain = models.BooleanField(null=True, blank=True)
    ready_to_train = models.BooleanField(null=True, blank=True)
```

`MoodEntrySerializer`:

```python
        fields = ('id', 'score', 'notes', 'energy_level', 'pain', 'ready_to_train', 'date', 'created_at')
```

and add below `validate_score`:

```python
    def validate_energy_level(self, value):
        if value is not None and (value < 1 or value > 5):
            raise serializers.ValidationError('La energía debe estar entre 1 y 5.')
        return value
```

`mood_view` POST — replace the `defaults` block with:

```python
    defaults = {'score': serializer.validated_data['score']}
    for key in ('notes', 'energy_level', 'pain', 'ready_to_train'):
        if key in serializer.validated_data:
            defaults[key] = serializer.validated_data[key]
```

- [ ] **Step 4: Migrate + run test**

Run: `python manage.py makemigrations core_app && pytest core_app/tests/views/test_mood_checkin_fields.py --no-cov -q`
Expected: migration created; 3 passed

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/models/mood_entry.py backend/core_app/serializers/profile_serializers.py backend/core_app/views/auth_views.py backend/core_app/migrations/ backend/core_app/tests/views/test_mood_checkin_fields.py
git commit -m "feat(checkin): energy/pain/ready fields on MoodEntry"
```

---

### Task 2: Backend — credit values endpoint + captures flag migration

**Files:**
- Modify: `backend/core_app/views/credit_views.py` (append view)
- Modify: `backend/core_app/urls/api_urls.py` (import + path)
- Create: data migration `backend/core_app/migrations/00XX_enable_workout_captures.py` (via `makemigrations core_app --empty`)
- Test: `backend/core_app/tests/views/test_credit_values_view.py`

**Interfaces:**
- Produces: `GET /api/credits/values/` (IsAuthenticated) →
  `{action_values, streak_bonuses, water_goal_glasses, meal_review_days, require_workout_captures}`.
  Deployed `CreditSettings` row flips `require_workout_captures=True`.

- [ ] **Step 1: Write the failing test**

```python
# backend/core_app/tests/views/test_credit_values_view.py
import pytest

from core_app.services import credit_engine


@pytest.mark.django_db
def test_credit_values_returns_config(api_client, existing_user):
    credit_engine.get_settings()  # seed presets
    api_client.force_authenticate(existing_user)
    resp = api_client.get('/api/credits/values/')
    assert resp.status_code == 200
    data = resp.json()
    assert data['action_values']['checkin'] == 5
    assert data['streak_bonuses']['7'] == 50
    assert data['water_goal_glasses'] == 8
    assert 'require_workout_captures' in data


@pytest.mark.django_db
def test_credit_values_requires_auth(api_client):
    assert api_client.get('/api/credits/values/').status_code == 401
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pytest core_app/tests/views/test_credit_values_view.py --no-cov -q`
Expected: FAIL — 404 (route missing)

- [ ] **Step 3: Implement the view + route**

Append to `backend/core_app/views/credit_views.py`:

```python
class CreditValuesView(APIView):
    """Read-only credit configuration for any authenticated user.

    Feeds the dynamic "+X créditos" chips in the client UI; exposes no
    trainer-only data.
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        settings_obj = credit_engine.get_settings()
        return Response({
            'action_values': settings_obj.action_values,
            'streak_bonuses': settings_obj.streak_bonuses,
            'water_goal_glasses': settings_obj.water_goal_glasses,
            'meal_review_days': settings_obj.meal_review_days,
            'require_workout_captures': settings_obj.require_workout_captures,
        })
```

In `api_urls.py`: add `CreditValuesView` to the `credit_views` import block and, in the credits path group:

```python
    path('credits/values/', CreditValuesView.as_view(), name='credits-values'),
```

- [ ] **Step 4: Data migration**

Run: `python manage.py makemigrations core_app --empty -n enable_workout_captures`, then fill it:

```python
from django.db import migrations


def enable_workout_captures(apps, schema_editor):
    CreditSettings = apps.get_model('core_app', 'CreditSettings')
    CreditSettings.objects.filter(pk=1).update(require_workout_captures=True)


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '00XX_previous'),  # keep the auto-generated dependency
    ]

    operations = [
        migrations.RunPython(enable_workout_captures, migrations.RunPython.noop),
    ]
```

Append to the test file:

```python
import importlib

from django.apps import apps as django_apps

from core_app.models.credit import CreditSettings


@pytest.mark.django_db
def test_enable_workout_captures_migration_flips_existing_row():
    CreditSettings.load()
    # Adjust the module name to the generated migration number.
    mod = importlib.import_module('core_app.migrations.00XX_enable_workout_captures'.replace('00XX', MIGRATION_NUM))
    mod.enable_workout_captures(django_apps, None)
    assert CreditSettings.load().require_workout_captures is True
```

where `MIGRATION_NUM` is a module-level constant string set to the generated number (e.g. `'0060'`).

- [ ] **Step 5: Run tests, migrate dev DB, commit**

Run: `pytest core_app/tests/views/test_credit_values_view.py --no-cov -q && python manage.py migrate --noinput`
Expected: 3 passed; migration applied

```bash
git add backend/core_app/views/credit_views.py backend/core_app/urls/api_urls.py backend/core_app/migrations/ backend/core_app/tests/views/test_credit_values_view.py
git commit -m "feat(credits): public credit-values endpoint + enable workout captures"
```

---

### Task 3: `creditValuesStore`

**Files:**
- Create: `frontend/lib/stores/creditValuesStore.ts`
- Test: `frontend/app/__tests__/stores/creditValuesStore.test.ts`

**Interfaces:**
- Produces: `useCreditValuesStore` with `{actionValues, streakBonuses, waterGoalGlasses, requireWorkoutCaptures, loaded, fetchValues()}` and helper selector `value(action: string): number | null` (null while not loaded — callers hide the chip).

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/creditValuesStore.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

describe('creditValuesStore', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useCreditValuesStore.setState({
      actionValues: {}, streakBonuses: {}, waterGoalGlasses: 8,
      requireWorkoutCaptures: false, loaded: false,
    });
  });

  it('fetches values once and exposes them via value()', async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: {
      action_values: { checkin: 5, workout_day: 15 },
      streak_bonuses: { '7': 50 },
      water_goal_glasses: 8,
      meal_review_days: 3,
      require_workout_captures: true,
    } });
    await useCreditValuesStore.getState().fetchValues();
    const s = useCreditValuesStore.getState();
    expect(s.loaded).toBe(true);
    expect(s.value('checkin')).toBe(5);
    expect(s.requireWorkoutCaptures).toBe(true);
    await s.fetchValues(); // second call is a no-op
    expect(api.get).toHaveBeenCalledTimes(1);
  });

  it('value() returns null while not loaded', () => {
    expect(useCreditValuesStore.getState().value('checkin')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd frontend && npx jest app/__tests__/stores/creditValuesStore.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement**

```typescript
// frontend/lib/stores/creditValuesStore.ts
import { create } from 'zustand';
import Cookies from 'js-cookie';
import { api } from '@/lib/services/http';

type CreditValuesState = {
  actionValues: Record<string, number>;
  streakBonuses: Record<string, number>;
  waterGoalGlasses: number;
  requireWorkoutCaptures: boolean;
  loaded: boolean;
  fetchValues: () => Promise<void>;
  value: (action: string) => number | null;
};

function authHeaders() {
  const token = Cookies.get('kore_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export const useCreditValuesStore = create<CreditValuesState>((set, get) => ({
  actionValues: {},
  streakBonuses: {},
  waterGoalGlasses: 8,
  requireWorkoutCaptures: false,
  loaded: false,

  fetchValues: async () => {
    if (get().loaded) return;
    try {
      const { data } = await api.get('/credits/values/', { headers: authHeaders() });
      set({
        actionValues: data.action_values ?? {},
        streakBonuses: data.streak_bonuses ?? {},
        waterGoalGlasses: data.water_goal_glasses ?? 8,
        requireWorkoutCaptures: !!data.require_workout_captures,
        loaded: true,
      });
    } catch {
      // Chips simply stay hidden; retry next session.
    }
  },

  value: (action: string) => {
    const s = get();
    if (!s.loaded) return null;
    const v = s.actionValues[action];
    return typeof v === 'number' ? v : null;
  },
}));
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/stores/creditValuesStore.test.ts`
Expected: 2 passed

```bash
git add frontend/lib/stores/creditValuesStore.ts frontend/app/__tests__/stores/creditValuesStore.test.ts
git commit -m "feat(credits): creditValuesStore for dynamic +X chips"
```

---

### Task 4: `profileStore.submitMood` extras

**Files:**
- Modify: `frontend/lib/stores/profileStore.ts` (`TodayMood` type ~line 21, `submitMood` signature ~line 77 and impl ~line 213)
- Test: `frontend/app/__tests__/stores/profileStore.moodExtras.test.ts`

**Interfaces:**
- Produces: `export type MoodExtras = { energy_level?: number; pain?: boolean; ready_to_train?: boolean }`; `submitMood(score, notes?, extras?)`; `TodayMood` gains the three nullable fields.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/stores/profileStore.moodExtras.test.ts
jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { api } from '@/lib/services/http';
import { useProfileStore } from '@/lib/stores/profileStore';

describe('profileStore.submitMood extras', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useProfileStore.setState({ todayMood: null, profile: null });
  });

  it('posts the check-in extras alongside score', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: {
      score: 8, notes: '', date: '2026-07-15',
      energy_level: 4, pain: false, ready_to_train: true,
    } });
    const res = await useProfileStore.getState().submitMood(8, undefined, {
      energy_level: 4, pain: false, ready_to_train: true,
    });
    expect(api.post).toHaveBeenCalledWith('/auth/mood/', {
      score: 8, energy_level: 4, pain: false, ready_to_train: true,
    }, expect.any(Object));
    expect(res.success).toBe(true);
    expect(useProfileStore.getState().todayMood?.energy_level).toBe(4);
  });

  it('score-only call keeps the old payload shape', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { score: 7, notes: '', date: '2026-07-15' } });
    await useProfileStore.getState().submitMood(7);
    expect(api.post).toHaveBeenCalledWith('/auth/mood/', { score: 7 }, expect.any(Object));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest app/__tests__/stores/profileStore.moodExtras.test.ts`
Expected: FAIL (extras arg ignored / payload mismatch)

- [ ] **Step 3: Implement**

`TodayMood` type:

```typescript
export type TodayMood = {
  score: number;
  notes: string;
  date: string;
  energy_level?: number | null;
  pain?: boolean | null;
  ready_to_train?: boolean | null;
};

export type MoodExtras = {
  energy_level?: number;
  pain?: boolean;
  ready_to_train?: boolean;
};
```

Signature in the state type:

```typescript
  submitMood: (score: number, notes?: string, extras?: MoodExtras) => Promise<{ success: boolean; error?: string }>;
```

Implementation:

```typescript
  submitMood: async (score, notes, extras) => {
    try {
      const payload: { score: number; notes?: string } & MoodExtras = { score, ...extras };
      if (notes !== undefined) payload.notes = notes;
      const { data } = await api.post<TodayMood>('/auth/mood/', payload, {
        headers: authHeaders(),
      });
      set({ todayMood: data });
      const current = get().profile;
      if (current) {
        set({ profile: { ...current, today_mood: data } });
      }
      return { success: true };
    } catch {
      return { success: false, error: 'No se pudo registrar tu estado anímico.' };
    }
  },
```

- [ ] **Step 4: Run test, commit**

Run: `npx jest app/__tests__/stores/profileStore.moodExtras.test.ts`
Expected: 2 passed

```bash
git add frontend/lib/stores/profileStore.ts frontend/app/__tests__/stores/profileStore.moodExtras.test.ts
git commit -m "feat(checkin): submitMood accepts energy/pain/ready extras"
```

---

### Task 5: Enriched 4-step check-in modal

**Files:**
- Modify: `frontend/app/components/profile/MoodCheckIn.tsx` (replace the question body; keep visibility/gating logic lines 19-63 intact)
- Test: `frontend/app/__tests__/components/profile/MoodCheckIn.steps.test.tsx` (CI-verified)

**Interfaces:**
- Consumes: `submitMood(score, notes?, extras?)` (Task 4), `useCreditValuesStore` (Task 3).
- Produces: same component contract (global modal, no props).

- [ ] **Step 1: Rewrite the modal body**

Keep everything from the top of the file through `const handleDismiss` unchanged, plus these state changes: replace `const [score, setScore]`/`notes` block with:

```tsx
  const [step, setStep] = useState(0); // 0 ánimo · 1 energía · 2 dolor · 3 listo
  const [score, setScore] = useState<number | null>(null);
  const [energy, setEnergy] = useState<number | null>(null);
  const [pain, setPain] = useState<boolean | null>(null);
  const [notes, setNotes] = useState('');
```

Add near the top of the component:

```tsx
  const { value: creditValue, fetchValues } = useCreditValuesStore();
  useEffect(() => { fetchValues(); }, [fetchValues]);
  const checkinCredits = creditValue('checkin');
```

with the import `import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';`.

Submit handler:

```tsx
  const handleSubmit = async (readyAnswer: boolean) => {
    if (score === null) return;
    setSubmitting(true);
    await submitMood(score, notes || undefined, {
      ...(energy !== null ? { energy_level: energy } : {}),
      ...(pain !== null ? { pain } : {}),
      ready_to_train: readyAnswer,
    });
    setShowConfirmation(true);
    setTimeout(() => {
      setAutoVisible(false);
      if (moodModalOpen) closeMoodModal();
    }, 2000);
  };
```

Replace the question JSX (the `<>...</>` after `showConfirmation ? ... :`) with the step flow — header with progress dots + credit chip, one question per step, tap auto-advances:

```tsx
            <>
              <div className="text-center mb-5">
                <div className="flex items-center justify-center gap-1.5 mb-3">
                  {[0, 1, 2, 3].map((i) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-6 bg-kore-red' : i < step ? 'w-1.5 bg-kore-red/40' : 'w-1.5 bg-kore-gray-light'}`} />
                  ))}
                </div>
                <h2 className="font-heading text-lg font-semibold text-kore-gray-dark mb-1">
                  {step === 0 && '¿Cómo te sientes hoy?'}
                  {step === 1 && '¿Cuánta energía tienes?'}
                  {step === 2 && '¿Tienes algún dolor o molestia?'}
                  {step === 3 && '¿Listo para entrenar hoy?'}
                </h2>
                {checkinCredits !== null && (
                  <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-red/10 text-kore-red">
                    Check-in de hoy · +{checkinCredits} créditos
                  </span>
                )}
              </div>

              {step === 0 && (
                <div className="mb-4">
                  <div className="flex items-center justify-center gap-1.5 flex-wrap mb-2">
                    {Array.from({ length: 10 }, (_, i) => i + 1).map((n) => (
                      <button
                        key={n}
                        type="button"
                        onClick={() => { setScore(n); setTimeout(() => setStep(1), 250); }}
                        className={`w-8 h-8 rounded-full text-xs font-bold transition-all duration-150 cursor-pointer ${
                          n === score
                            ? getScoreColor(n) + ' ring-2 ring-offset-1 ring-current scale-110'
                            : 'bg-kore-cream/60 text-kore-gray-dark/40 hover:bg-kore-cream hover:text-kore-gray-dark/70'
                        }`}
                      >
                        {n}
                      </button>
                    ))}
                  </div>
                  {score !== null && (
                    <p className="text-center text-sm font-medium text-kore-gray-dark/60">{SCORE_LABELS[score]}</p>
                  )}
                </div>
              )}

              {step === 1 && (
                <div className="mb-4 flex items-center justify-center gap-2">
                  {[
                    { n: 1, label: 'Agotado' }, { n: 2, label: 'Bajo' }, { n: 3, label: 'Normal' },
                    { n: 4, label: 'Bien' }, { n: 5, label: 'A tope' },
                  ].map(({ n, label }) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => { setEnergy(n); setTimeout(() => setStep(2), 250); }}
                      className={`flex flex-col items-center gap-1 px-2.5 py-2 rounded-xl text-[11px] font-semibold transition-all ${
                        energy === n ? 'bg-kore-red/10 text-kore-red ring-1 ring-kore-red/30' : 'bg-kore-cream/60 text-kore-gray-dark/50 hover:bg-kore-cream'
                      }`}
                    >
                      <span className="text-base font-bold">{n}</span>
                      {label}
                    </button>
                  ))}
                </div>
              )}

              {step === 2 && (
                <div className="mb-4 flex items-center justify-center gap-3">
                  <button type="button" onClick={() => { setPain(false); setTimeout(() => setStep(3), 250); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${pain === false ? 'bg-green-100 text-green-700 ring-1 ring-green-300' : 'bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream'}`}>
                    Sin dolor
                  </button>
                  <button type="button" onClick={() => { setPain(true); setTimeout(() => setStep(3), 250); }}
                    className={`flex-1 py-3 rounded-xl text-sm font-semibold transition-all ${pain === true ? 'bg-red-100 text-red-600 ring-1 ring-red-300' : 'bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream'}`}>
                    Tengo dolor
                  </button>
                </div>
              )}

              {step === 3 && (
                <div className="mb-4 space-y-3">
                  {pain === true && (
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Cuéntale a tu entrenador dónde te duele (opcional)"
                      rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-kore-gray-light/50 bg-kore-cream/30 text-sm text-kore-gray-dark placeholder:text-kore-gray-dark/30 focus:outline-none focus:ring-2 focus:ring-kore-red/20 resize-none"
                    />
                  )}
                  <div className="flex items-center justify-center gap-3">
                    <button type="button" disabled={submitting} onClick={() => handleSubmit(true)}
                      className="flex-1 py-3 bg-gradient-to-r from-kore-red to-kore-burgundy text-white font-heading font-semibold text-sm rounded-xl hover:shadow-lg transition-all duration-300 disabled:opacity-70">
                      {submitting ? 'Guardando...' : '¡Listo para entrenar!'}
                    </button>
                    <button type="button" disabled={submitting} onClick={() => handleSubmit(false)}
                      className="flex-1 py-3 rounded-xl text-sm font-semibold bg-kore-cream/60 text-kore-gray-dark/60 hover:bg-kore-cream transition-all disabled:opacity-70">
                      Hoy no
                    </button>
                  </div>
                </div>
              )}

              <button
                onClick={handleDismiss}
                className="w-full mt-2 text-xs text-kore-gray-dark/40 hover:text-kore-gray-dark/60 transition-colors text-center"
              >
                Ahora no
              </button>
            </>
```

The confirmation block: guard `score` being nullable (`{score ?? '—'}` and `SCORE_LABELS[score ?? 7]`), keep the rest.

- [ ] **Step 2: Write the component test** (CI runs it; skip locally)

```tsx
// frontend/app/__tests__/components/profile/MoodCheckIn.steps.test.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn(), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));
jest.mock('next/image', () => ({ __esModule: true, default: () => null }));

import { api } from '@/lib/services/http';
import { useAuthStore } from '@/lib/stores/authStore';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import MoodCheckIn from '@/app/components/profile/MoodCheckIn';

describe('MoodCheckIn 4-step flow', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    sessionStorage.clear();
    useAuthStore.setState({ hydrated: true, user: { id: 1, profile_completed: true } } as never);
    useProfileStore.setState({
      todayMood: null, moodModalOpen: true,
      profile: { customer_profile: { profile_completed: true } },
      fetchProfile: async () => {},
    } as never);
    useCreditValuesStore.setState({ actionValues: { checkin: 5 }, loaded: true } as never);
  });

  it('walks the 4 steps and submits score + extras', async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { score: 8, notes: '', date: 'x', energy_level: 4, pain: false, ready_to_train: true } });
    render(<MoodCheckIn />);
    expect(screen.getByText(/\+5 créditos/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: '8' }));
    await screen.findByText('¿Cuánta energía tienes?');
    fireEvent.click(screen.getByRole('button', { name: /Bien/ }));
    await screen.findByText('¿Tienes algún dolor o molestia?');
    fireEvent.click(screen.getByRole('button', { name: 'Sin dolor' }));
    await screen.findByText('¿Listo para entrenar hoy?');
    fireEvent.click(screen.getByRole('button', { name: '¡Listo para entrenar!' }));

    await waitFor(() => expect(api.post).toHaveBeenCalledWith('/auth/mood/', {
      score: 8, energy_level: 4, pain: false, ready_to_train: true,
    }, expect.any(Object)));
  });
});
```

Note: `fetchProfile` is stubbed via `setState` so the modal's mount effect doesn't hit the API; `moodModalOpen: true` forces visibility.

- [ ] **Step 3: Typecheck, commit**

Run: `npx tsc --noEmit`
Expected: clean (component test runs in CI)

```bash
git add frontend/app/components/profile/MoodCheckIn.tsx frontend/app/__tests__/components/profile/MoodCheckIn.steps.test.tsx
git commit -m "feat(checkin): 4-step tap check-in modal with dynamic credit chip"
```

---

### Task 6: "Hoy ganas" dashboard block

**Files:**
- Create: `frontend/app/components/dashboard/TodayCreditsCard.tsx`
- Modify: `frontend/app/(app)/dashboard/page.tsx` (mount mobile before `<ProgressTabsCard ...>` at ~line 1772; desktop before `<ProgressTabsCard />` at ~line 1980; add import)
- Test: `frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx` (CI-verified)

**Interfaces:**
- Consumes: `useProfileStore` (todayMood, openMoodModal), `useNutritionDailyStore` (todayLog), `useProgramStore` (todayData), `useCreditValuesStore`.
- Produces: `<TodayCreditsCard />` (no props; self-fetching where store data is missing).

- [ ] **Step 1: Implement the component**

```tsx
// frontend/app/components/dashboard/TodayCreditsCard.tsx
'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { Check, ChevronRight } from 'lucide-react';
import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';

function Chip({ amount, suffix }: { amount: number | null; suffix?: string }) {
  if (amount === null) return null;
  return (
    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-kore-red/10 text-kore-red flex-shrink-0">
      +{amount}{suffix ?? ''}
    </span>
  );
}

function Row({ label, detail, done, chip, href, onClick }: {
  label: string; detail: string; done: boolean;
  chip: React.ReactNode; href?: string; onClick?: () => void;
}) {
  const body = (
    <>
      <span className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${done ? 'bg-kore-sage/25 text-kore-sage-deep' : 'bg-kore-cream text-kore-gray-dark/30'}`}>
        {done ? <Check className="w-3.5 h-3.5" strokeWidth={2} /> : <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />}
      </span>
      <span className="flex-1 min-w-0 text-left">
        <span className="block text-[13px] font-semibold text-kore-gray-dark truncate">{label}</span>
        <span className="block text-[11px] text-kore-gray-dark/45 truncate">{detail}</span>
      </span>
      {chip}
    </>
  );
  const cls = 'w-full flex items-center gap-3 px-2 py-2 rounded-xl hover:bg-kore-cream/50 transition-colors';
  if (onClick) return <button type="button" onClick={onClick} className={cls}>{body}</button>;
  return <Link href={href ?? '#'} className={cls}>{body}</Link>;
}

export default function TodayCreditsCard() {
  const { todayMood, openMoodModal } = useProfileStore();
  const { todayLog, fetchTodayLog } = useNutritionDailyStore();
  const { todayData, fetchTodayData } = useProgramStore();
  const { value, waterGoalGlasses, fetchValues, loaded } = useCreditValuesStore();

  useEffect(() => { fetchValues(); }, [fetchValues]);
  useEffect(() => { if (!todayLog) fetchTodayLog(); }, [todayLog, fetchTodayLog]);
  useEffect(() => { if (!todayData) fetchTodayData(); }, [todayData, fetchTodayData]);

  const glasses = todayLog?.water_glasses?.length ?? 0;
  const mealsWithPhoto = (todayLog?.meal_entries ?? []).filter((m) => m.status === 'completed' && m.photo).length;
  const exerciseLogs = todayData?.daily_log?.exercise_logs ?? [];
  const exercisesDone = exerciseLogs.filter((e) => e.status === 'completed').length;

  return (
    <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm" data-testid="today-credits-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-kore-gray-dark/50 mb-2 px-2">
        Hoy ganas
      </p>
      <div className="space-y-0.5">
        <Row
          label="Check-in diario"
          detail={todayMood ? 'Completado' : 'Cuéntanos cómo estás'}
          done={!!todayMood}
          chip={<Chip amount={value('checkin')} />}
          onClick={todayMood ? undefined : openMoodModal}
          href={todayMood ? '#' : undefined}
        />
        <Row
          label="Hidratación"
          detail={`${glasses}/${waterGoalGlasses} vasos`}
          done={loaded && glasses >= waterGoalGlasses}
          chip={<Chip amount={value('water_goal')} />}
          href="/my-nutrition"
        />
        <Row
          label="Comidas con foto"
          detail={`${mealsWithPhoto}/5 registradas`}
          done={mealsWithPhoto >= 5}
          chip={<Chip amount={value('meal_photo')} suffix=" c/u" />}
          href="/my-nutrition"
        />
        <Row
          label="Rutina de hoy"
          detail={exerciseLogs.length === 0 ? 'Sin rutina hoy' : exercisesDone === exerciseLogs.length ? 'Completada · en validación' : `${exercisesDone}/${exerciseLogs.length} ejercicios`}
          done={exerciseLogs.length > 0 && exercisesDone === exerciseLogs.length}
          chip={<Chip amount={value('workout_day')} />}
          href="/mi-programa/rutina"
        />
      </div>
    </div>
  );
}
```

Mount it: in `dashboard/page.tsx` add `import TodayCreditsCard from '@/app/components/dashboard/TodayCreditsCard';` and insert `<TodayCreditsCard />`:
- MOBILE: immediately before the `{/* Mi progreso + Resumen mensual */}` comment (line ~1771).
- DESKTOP: immediately before the `<ProgressTabsCard />` at ~line 1980 (inside the same column container — mirror the sibling wrappers, check indentation there).

- [ ] **Step 2: Component test** (CI)

```tsx
// frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx
import { render, screen } from '@testing-library/react';

jest.mock('js-cookie', () => ({ get: jest.fn(() => 'tok'), set: jest.fn(), remove: jest.fn() }));
jest.mock('@/lib/services/http', () => ({
  api: { get: jest.fn().mockResolvedValue({ data: null }), post: jest.fn(), patch: jest.fn(), delete: jest.fn(), put: jest.fn() },
  getWithRetry: jest.fn(),
  extractApiError: jest.fn((_e: unknown, fb: string) => fb),
}));

import { useProfileStore } from '@/lib/stores/profileStore';
import { useNutritionDailyStore } from '@/lib/stores/nutritionDailyStore';
import { useProgramStore } from '@/lib/stores/programStore';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
import TodayCreditsCard from '@/app/components/dashboard/TodayCreditsCard';

describe('TodayCreditsCard', () => {
  beforeEach(() => {
    useProfileStore.setState({ todayMood: { score: 8, notes: '', date: 'x' } } as never);
    useNutritionDailyStore.setState({
      todayLog: {
        id: 1, date: 'x', is_closed: false,
        water_glasses: [{}, {}],
        meal_entries: [
          { id: 1, status: 'completed', photo: 'a.jpg' },
          { id: 2, status: 'not_done', photo: null },
        ],
      },
      fetchTodayLog: async () => {},
    } as never);
    useProgramStore.setState({
      todayData: { program_day: {}, daily_log: { id: 1, exercise_logs: [
        { id: 1, status: 'completed' }, { id: 2, status: 'not_done' },
      ] } },
      fetchTodayData: async () => {},
    } as never);
    useCreditValuesStore.setState({
      actionValues: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
      waterGoalGlasses: 8, loaded: true, fetchValues: async () => {},
    } as never);
  });

  it('renders the four rows with dynamic chips and states', () => {
    render(<TodayCreditsCard />);
    expect(screen.getByText('Hoy ganas')).toBeInTheDocument();
    expect(screen.getByText('Completado')).toBeInTheDocument();      // check-in done
    expect(screen.getByText('2/8 vasos')).toBeInTheDocument();
    expect(screen.getByText('1/5 registradas')).toBeInTheDocument();
    expect(screen.getByText('1/2 ejercicios')).toBeInTheDocument();
    expect(screen.getByText('+15')).toBeInTheDocument();             // workout chip
  });
});
```

- [ ] **Step 3: Typecheck, commit**

Run: `npx tsc --noEmit`
Expected: clean

```bash
git add frontend/app/components/dashboard/TodayCreditsCard.tsx "frontend/app/(app)/dashboard/page.tsx" frontend/app/__tests__/components/dashboard/TodayCreditsCard.test.tsx
git commit -m "feat(credits): Hoy ganas dashboard block with dynamic chips"
```

---

### Task 7: Capture utils + `programStore.uploadExerciseCapture`

**Files:**
- Create: `frontend/lib/utils/workoutCaptures.ts`
- Modify: `frontend/lib/stores/programStore.ts` (action after `updateExerciseStatus` + signature in state type)
- Test: `frontend/app/__tests__/utils/workoutCaptures.test.ts`

**Interfaces:**
- Produces:
  - `scheduleCaptureOffsets(count: number, windowMs: number, rng?: () => number): number[]` — `count` offsets in `[3000, windowMs - 1000]`, sorted.
  - `createUploadQueue(uploader: (item: CaptureItem) => Promise<boolean>): { enqueue(item: CaptureItem): void; flush(): Promise<void>; pendingCount(): number }` — sequential uploads, one silent retry per item, drops after second failure. `CaptureItem = { logId: number; exLogId: number; file: File }`.
  - `programStore.uploadExerciseCapture(logId: number, exLogId: number, file: File): Promise<boolean>`.

- [ ] **Step 1: Write the failing test**

```typescript
// frontend/app/__tests__/utils/workoutCaptures.test.ts
import { scheduleCaptureOffsets, createUploadQueue, type CaptureItem } from '@/lib/utils/workoutCaptures';

describe('scheduleCaptureOffsets', () => {
  it('returns sorted offsets inside the window using the provided rng', () => {
    const seq = [0.1, 0.9, 0.5];
    let i = 0;
    const rng = () => seq[i++ % seq.length];
    const offsets = scheduleCaptureOffsets(3, 60_000, rng);
    expect(offsets).toHaveLength(3);
    expect([...offsets]).toEqual([...offsets].sort((a, b) => a - b));
    for (const o of offsets) {
      expect(o).toBeGreaterThanOrEqual(3000);
      expect(o).toBeLessThanOrEqual(59_000);
    }
  });

  it('clamps tiny windows to a single early offset range', () => {
    const offsets = scheduleCaptureOffsets(2, 5000, () => 0.5);
    for (const o of offsets) {
      expect(o).toBeGreaterThanOrEqual(1000);
      expect(o).toBeLessThanOrEqual(4000);
    }
  });
});

describe('createUploadQueue', () => {
  const item = (n: number): CaptureItem => ({ logId: 1, exLogId: n, file: new File(['x'], `${n}.jpg`) });

  it('uploads sequentially and retries a failure once', async () => {
    const calls: number[] = [];
    let failedOnce = false;
    const uploader = jest.fn(async (it: CaptureItem) => {
      calls.push(it.exLogId);
      if (it.exLogId === 2 && !failedOnce) { failedOnce = true; return false; }
      return true;
    });
    const q = createUploadQueue(uploader);
    q.enqueue(item(1));
    q.enqueue(item(2));
    q.enqueue(item(3));
    await q.flush();
    expect(calls).toEqual([1, 2, 2, 3]); // 2 retried once
    expect(q.pendingCount()).toBe(0);
  });

  it('drops an item after the retry also fails', async () => {
    const uploader = jest.fn(async () => false);
    const q = createUploadQueue(uploader);
    q.enqueue(item(9));
    await q.flush();
    expect(uploader).toHaveBeenCalledTimes(2);
    expect(q.pendingCount()).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx jest app/__tests__/utils/workoutCaptures.test.ts`
Expected: FAIL — module not found

- [ ] **Step 3: Implement the utils**

```typescript
// frontend/lib/utils/workoutCaptures.ts
/**
 * Pure helpers for the workout camera validation flow.
 * The capture timing is intentionally unpredictable for the client:
 * offsets are random within the exercise execution window.
 */

export type CaptureItem = { logId: number; exLogId: number; file: File };

export function scheduleCaptureOffsets(
  count: number,
  windowMs: number,
  rng: () => number = Math.random,
): number[] {
  const min = windowMs >= 10_000 ? 3000 : 1000;
  const max = Math.max(min + 500, windowMs - 1000);
  const offsets = Array.from({ length: count }, () => min + rng() * (max - min));
  return offsets.map(Math.round).sort((a, b) => a - b);
}

export function createUploadQueue(uploader: (item: CaptureItem) => Promise<boolean>) {
  const queue: { item: CaptureItem; attempts: number }[] = [];
  let running: Promise<void> | null = null;

  async function pump(): Promise<void> {
    while (queue.length > 0) {
      const entry = queue[0];
      const ok = await uploader(entry.item);
      if (ok || entry.attempts >= 1) {
        queue.shift();
      } else {
        entry.attempts += 1;
      }
    }
    running = null;
  }

  return {
    enqueue(item: CaptureItem) {
      queue.push({ item, attempts: 0 });
      if (!running) running = pump();
    },
    async flush() {
      if (running) await running;
    },
    pendingCount: () => queue.length,
  };
}
```

Add to `programStore.ts` (state type, next to `updateExerciseStatus`):

```typescript
  uploadExerciseCapture: (logId: number, exLogId: number, file: File) => Promise<boolean>;
```

and the action after `updateExerciseStatus`:

```typescript
  uploadExerciseCapture: async (logId, exLogId, file) => {
    try {
      const form = new FormData();
      form.append('image', file);
      await api.post(`/my-program/logs/${logId}/exercises/${exLogId}/captures/`, form, {
        headers: authHeaders(),
      });
      return true;
    } catch {
      return false;
    }
  },
```

- [ ] **Step 4: Run tests, commit**

Run: `npx jest app/__tests__/utils/workoutCaptures.test.ts`
Expected: 4 passed

```bash
git add frontend/lib/utils/workoutCaptures.ts frontend/lib/stores/programStore.ts frontend/app/__tests__/utils/workoutCaptures.test.ts
git commit -m "feat(credits): capture scheduling utils, upload queue and capture upload action"
```

---

### Task 8: `useWorkoutCaptures` hook + routine player integration

**Files:**
- Create: `frontend/lib/hooks/useWorkoutCaptures.ts`
- Modify: `frontend/app/(app)/mi-programa/rutina/page.tsx` (consent gate, hidden video, indicator, credit chips)

**Interfaces:**
- Consumes: `scheduleCaptureOffsets`, `createUploadQueue`, `programStore.uploadExerciseCapture`, `compressImage` (`lib/utils/compressImage.ts`), `useCreditValuesStore.requireWorkoutCaptures`.
- Produces: `useWorkoutCaptures({ active, logId, exLogId, windowMs })` → `{ videoRef, permission: 'unknown' | 'granted' | 'denied' | 'unsupported', requestPermission(): Promise<boolean>, releaseStream(): void, capturing: boolean }`. `localStorage` key `kore_workout_camera` ∈ `granted | denied`.

- [ ] **Step 1: Implement the hook**

```typescript
// frontend/lib/hooks/useWorkoutCaptures.ts
'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useProgramStore } from '@/lib/stores/programStore';
import { compressImage } from '@/lib/utils/compressImage';
import { createUploadQueue, scheduleCaptureOffsets } from '@/lib/utils/workoutCaptures';

export type CameraPermission = 'unknown' | 'granted' | 'denied' | 'unsupported';

const STORAGE_KEY = 'kore_workout_camera';

type Args = {
  active: boolean;          // rule on + consent granted + phase === 'execute'
  logId: number | null;
  exLogId: number | null;
  windowMs: number;         // expected execution window for the current set
};

export function useWorkoutCaptures({ active, logId, exLogId, windowMs }: Args) {
  const uploadExerciseCapture = useProgramStore((s) => s.uploadExerciseCapture);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timeoutsRef = useRef<number[]>([]);
  const [permission, setPermission] = useState<CameraPermission>(() => {
    if (typeof window === 'undefined') return 'unknown';
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored === 'granted' || stored === 'denied' ? stored : 'unknown';
  });
  const [capturing, setCapturing] = useState(false);

  const queue = useMemo(
    () => createUploadQueue((item) => uploadExerciseCapture(item.logId, item.exLogId, item.file)),
    [uploadExerciseCapture],
  );

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
      setPermission('unsupported');
      return false;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'user' } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => undefined);
      }
      localStorage.setItem(STORAGE_KEY, 'granted');
      setPermission('granted');
      return true;
    } catch {
      localStorage.setItem(STORAGE_KEY, 'denied');
      setPermission('denied');
      return false;
    }
  }, []);

  const releaseStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const captureFrame = useCallback(async () => {
    const video = videoRef.current;
    if (!video || !streamRef.current || logId === null || exLogId === null) return;
    if (video.readyState < 2 || video.videoWidth === 0) return;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d')?.drawImage(video, 0, 0);
    const blob: Blob | null = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', 0.85));
    if (!blob) return;
    const raw = new File([blob], `capture-${exLogId}-${queueStamp()}.jpg`, { type: 'image/jpeg' });
    const compressed = await compressImage(raw).catch(() => raw);
    queue.enqueue({ logId, exLogId, file: compressed });
  }, [logId, exLogId, queue]);

  // Re-acquire the stream on mount when consent was previously granted.
  useEffect(() => {
    if (permission === 'granted' && !streamRef.current) {
      void requestPermission();
    }
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      releaseStream();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Schedule random captures while an exercise set is executing.
  useEffect(() => {
    if (!active || permission !== 'granted' || exLogId === null) return;
    const count = 2 + (Math.random() < 0.5 ? 1 : 0);
    const offsets = scheduleCaptureOffsets(count, windowMs);
    setCapturing(true);
    timeoutsRef.current = offsets.map((ms) => window.setTimeout(() => void captureFrame(), ms));
    return () => {
      timeoutsRef.current.forEach(clearTimeout);
      timeoutsRef.current = [];
      setCapturing(false);
      void queue.flush();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, permission, exLogId]);

  return { videoRef, permission, requestPermission, releaseStream, capturing };
}

let stampCounter = 0;
function queueStamp() {
  stampCounter += 1;
  return `${stampCounter}`;
}
```

- [ ] **Step 2: Wire the routine player** (`rutina/page.tsx`)

Imports:

```tsx
import { useWorkoutCaptures } from '@/lib/hooks/useWorkoutCaptures';
import { useCreditValuesStore } from '@/lib/stores/creditValuesStore';
```

Inside `RutinaPage` (after the existing store line ~92):

```tsx
  const { value: creditValue, requireWorkoutCaptures, fetchValues } = useCreditValuesStore();
  useEffect(() => { fetchValues(); }, [fetchValues]);

  const [gateOpen, setGateOpen] = useState(false);
  const executeWindowMs = ((pe?.duration_seconds ?? 45) + 15) * 1000;
  const captures = useWorkoutCaptures({
    active: phase === 'execute' && requireWorkoutCaptures,
    logId: todayData?.daily_log?.id ?? null,
    exLogId: currentLog?.id ?? null,
    windowMs: executeWindowMs,
  });

  // First visit with the rule active and no stored decision → consent gate.
  useEffect(() => {
    if (requireWorkoutCaptures && captures.permission === 'unknown') setGateOpen(true);
  }, [requireWorkoutCaptures, captures.permission]);
```

NOTE: `pe`/`currentLog` are declared at ~line 117 — place this block AFTER them.

Consent gate — render before the loading check returns (inside the component's JSX flow, right after the `if (todayLoading || !todayData)` block so `todayData` exists; guard with `gateOpen &&`):

```tsx
  if (gateOpen) {
    return (
      <RutinaShell>
        <div className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-5">
          <div className="text-5xl">🎥</div>
          <h2 className="font-heading text-[24px] font-semibold" style={{ color: '#FFF8EC' }}>
            Validación de tu rutina
          </h2>
          <p className="text-[14px] max-w-sm" style={{ color: '#FFE9DC', opacity: 0.8 }}>
            Durante tu entrenamiento se tomará un video para validar el cumplimiento de tu rutina
            y entregarte tus créditos cuando tu entrenador lo valide.
          </p>
          {creditValue('workout_day') !== null && (
            <span className="text-[11px] font-bold px-3 py-1 rounded-full bg-emerald-500/15 text-emerald-300">
              +{creditValue('workout_day')} créditos por rutina validada
            </span>
          )}
          <div className="flex flex-col gap-3 w-full max-w-xs mt-2">
            <button
              onClick={async () => { await captures.requestPermission(); setGateOpen(false); }}
              className="bg-[#E00000] hover:bg-[#C20000] text-white font-semibold px-8 py-3.5 rounded-2xl transition-colors active:scale-95 text-[14px]"
            >
              Activar cámara
            </button>
            <button
              onClick={() => { localStorage.setItem('kore_workout_camera', 'denied'); setGateOpen(false); }}
              className="text-[13px] py-2" style={{ color: '#FFE9DC', opacity: 0.6 }}
            >
              Entrenar sin validar
            </button>
          </div>
        </div>
      </RutinaShell>
    );
  }
```

(Deny path: setting `localStorage` then closing keeps `permission` as the hook read it on mount; on the next mount it reads `denied`. To reflect it immediately, `captures.permission` may still read `unknown` this session — acceptable: the gate simply won't reopen because `gateOpen` is false.)

Hidden video + indicator + denied notice — inside the `execute` phase JSX (locate the `phase === 'execute'` render block ~line 386) add at its top:

```tsx
          <video ref={captures.videoRef} muted playsInline className="fixed w-px h-px opacity-0 pointer-events-none" />
          {captures.capturing && (
            <span className="fixed top-6 right-5 z-20 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-red-500/15 text-red-300">
              <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
              Validando rutina
            </span>
          )}
          {requireWorkoutCaptures && captures.permission === 'denied' && (
            <button
              onClick={() => setGateOpen(true)}
              className="fixed top-6 right-5 z-20 text-[10px] font-bold px-2.5 py-1 rounded-full bg-amber-500/15 text-amber-300"
            >
              Sin validación · no suma créditos
            </button>
          )}
```

Credit chips: in the INTRO phase meta area (near the sets/reps info, ~line 340s) add:

```tsx
          {requireWorkoutCaptures && creditValue('workout_day') !== null && (
            <span className="inline-block mt-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-300">
              +{creditValue('workout_day')} al validar tu entrenador
            </span>
          )}
```

and in the COMPLETE phase (after the stats boxes, ~line 254):

```tsx
          {requireWorkoutCaptures && captures.permission === 'granted' && creditValue('workout_day') !== null && (
            <p className="text-[12px] mb-6" style={{ color: '#FFE9DC', opacity: 0.7 }}>
              📸 Rutina en validación · +{creditValue('workout_day')} créditos cuando tu entrenador la apruebe
            </p>
          )}
```

- [ ] **Step 3: Typecheck + manual verification**

Run: `npx tsc --noEmit`
Expected: clean

Manual (dev servers up): as `customer1@kore.com` open `http://192.168.56.10:3000/mi-programa/rutina` → consent gate appears (rule was enabled by the Task 2 migration) → "Activar cámara" prompts the browser → during an exercise the "Validando rutina" pulse shows → captures appear in `backend` media dir (`ls backend/media/workout_captures/`).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/hooks/useWorkoutCaptures.ts "frontend/app/(app)/mi-programa/rutina/page.tsx"
git commit -m "feat(credits): workout camera flow — consent gate, random captures, deferred upload"
```

---

### Task 9: E2E + flow triplet + validation guide

**Files:**
- Modify: `frontend/e2e/app/profile-mood-entry.spec.ts` (4-step flow)
- Modify: `frontend/e2e/app/dashboard.spec.ts` ("Hoy ganas" block)
- Modify: `frontend/e2e/program/mi-programa-rutina.spec.ts` (consent gate grant/deny)
- Modify: `frontend/e2e/flow-definitions.json` (v1.0.8 + `program-workout-captures`)
- Modify: `frontend/e2e/helpers/flow-tags.ts`
- Modify: `docs/USER_FLOW_MAP.md`
- Modify: `docs/release-july/GUIA_DE_VALIDACION.md` (Parte 2 section)

**Interfaces:**
- Consumes: existing spec fixtures/mocks — READ each spec's mock helpers before editing and mirror them. All specs need a `**/api/credits/values/**` route mock:

```typescript
const CREDIT_VALUES = {
  action_values: { checkin: 5, water_goal: 10, meal_photo: 5, workout_day: 15 },
  streak_bonuses: { '3': 20, '7': 50 },
  water_goal_glasses: 8, meal_review_days: 3, require_workout_captures: true,
};
await page.route('**/api/credits/values/**', (route) =>
  route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(CREDIT_VALUES) }));
```

- [ ] **Step 1: Mood spec** — update the existing assertions that submit directly after picking a score: the flow is now score → energía → dolor → listo. Add:

```typescript
  test('completes the 4-step check-in and posts extras', async ({ page }) => {
    // reuse the file's auth + profile mocks; add CREDIT_VALUES route (above)
    let moodPayload: Record<string, unknown> | null = null;
    await page.route('**/api/auth/mood/', async (route) => {
      if (route.request().method() === 'POST') {
        moodPayload = route.request().postDataJSON();
        return route.fulfill({ status: 201, contentType: 'application/json',
          body: JSON.stringify({ score: 8, notes: '', date: '2026-07-15', energy_level: 4, pain: false, ready_to_train: true }) });
      }
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ mood: null }) });
    });
    await page.goto('/dashboard');
    await expect(page.getByText('¿Cómo te sientes hoy?')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/\+5 créditos/)).toBeVisible();
    await page.getByRole('button', { name: '8', exact: true }).click();
    await page.getByRole('button', { name: /Bien/ }).click();
    await page.getByRole('button', { name: 'Sin dolor' }).click();
    await page.getByRole('button', { name: '¡Listo para entrenar!' }).click();
    await expect(page.getByText('Registrado. ¡Gracias!')).toBeVisible();
    expect(moodPayload).toMatchObject({ score: 8, energy_level: 4, pain: false, ready_to_train: true });
  });
```

Fix any existing test in the file that assumed single-step submit (walk the extra steps or assert only step 1 UI).

- [ ] **Step 2: Dashboard spec** — add CREDIT_VALUES route to the file's mock helper and:

```typescript
  test('shows the Hoy ganas block with credit chips', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page.getByTestId('today-credits-card').first()).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Hoy ganas').first()).toBeVisible();
    await expect(page.getByText('Check-in diario').first()).toBeVisible();
  });
```

(`.first()` because the card renders in both mobile and desktop layouts.)

- [ ] **Step 3: Rutina spec** — grant/deny consent gate. Mock `getUserMedia` BEFORE navigation:

```typescript
  test('camera consent gate: grant shows capture indicator path', async ({ page }) => {
    // file's existing today-program mocks + CREDIT_VALUES route with require_workout_captures: true
    await page.addInitScript(() => {
      const fakeTrack = { stop: () => undefined, kind: 'video' };
      // @ts-expect-error test stub
      navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [fakeTrack], getVideoTracks: () => [fakeTrack] });
      localStorage.removeItem('kore_workout_camera');
    });
    await page.goto('/mi-programa/rutina');
    await expect(page.getByText('Validación de tu rutina')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/se tomará un video/)).toBeVisible();
    await page.getByRole('button', { name: 'Activar cámara' }).click();
    await expect(page.getByText('Validación de tu rutina')).not.toBeVisible();
  });

  test('camera consent gate: deny keeps the routine usable', async ({ page }) => {
    await page.addInitScript(() => localStorage.removeItem('kore_workout_camera'));
    await page.goto('/mi-programa/rutina');
    await expect(page.getByText('Validación de tu rutina')).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Entrenar sin validar' }).click();
    await expect(page.getByText('Validación de tu rutina')).not.toBeVisible();
  });
```

- [ ] **Step 4: Flow triplet** — `flow-definitions.json`: version `1.0.8`, `lastUpdated` today, new flow:

```json
    "program-workout-captures": {
      "name": "Workout Camera Validation",
      "module": "program",
      "priority": "P2",
      "roles": ["customer"],
      "description": "Consent gate and random camera captures during the routine that validate workout-day credits."
    },
```

`flow-tags.ts` (next to the other program flows):

```typescript
  PROGRAM_WORKOUT_CAPTURES: ['@flow:program-workout-captures', '@module:program', '@priority:P2'],
```

Tag the two new rutina tests with a nested describe using `FlowTags.PROGRAM_WORKOUT_CAPTURES`. `USER_FLOW_MAP.md`: add steps/branches to `profile-mood-entry` (4 steps + credit chip), `customer-dashboard`/dashboard entry ("Hoy ganas" block) and a new `### program-workout-captures` entry following the existing format (Route `/mi-programa/rutina`, steps: gate → activar/denegar → indicador durante ejercicio → chip en completado).

- [ ] **Step 5: Validation guide** — append the "Parte 2" section to `docs/release-july/GUIA_DE_VALIDACION.md` following the 5-block format (¿Qué es? / Antes de empezar / Paso a paso / Cómo sabes que funcionó / Si algo no sale), covering: el check-in de 4 preguntas con su "+X", el bloque "Hoy ganas", y la validación por cámara de la rutina (activar, entrenar, ver "Validando rutina", y el aviso si se niega el permiso). Update the "Próximas secciones" list (remove Parte 2).

- [ ] **Step 6: Run the three spec files serialized, commit**

Run: `./node_modules/.bin/playwright test e2e/app/profile-mood-entry.spec.ts e2e/app/dashboard.spec.ts --workers=1` and `./node_modules/.bin/playwright test e2e/program/mi-programa-rutina.spec.ts --workers=1`
Expected: PASS (CI re-verifies)

```bash
git add frontend/e2e/ docs/USER_FLOW_MAP.md docs/release-july/GUIA_DE_VALIDACION.md
git commit -m "test(credits): e2e for 4-step check-in, Hoy ganas block and camera gate + flows"
```

---

### Task 10: Wrap-up — audit, push, PR

- [ ] **Step 1**: invoke the `e2e-user-flows-check` skill for the touched flows; close any P1/P2 gap it reports.
- [ ] **Step 2**: `cd frontend && npx tsc --noEmit` (clean) and `cd backend && python manage.py check && python manage.py makemigrations core_app --check --dry-run` (no issues, no pending migrations).
- [ ] **Step 3**: `git push -u origin feat/02072026-phase2-client-checkin-camera`, create the PR to base `july-release` titled `feat(credits): Phase 2 Part 2 — client check-in, credit visibility & workout camera`, summarizing the four features + the sleep/mobility descope note. CI runs everything. Report the PR URL.
