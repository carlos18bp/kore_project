# Notas semanales de programa y nutrición — Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que el entrenador deje una nota por semana (4 por ciclo de 28 días, con desbloqueo progresivo) en los subtabs Programa y Nutrición de la sección Notas del detalle de cliente.

**Architecture:** Dos modelos nuevos. `ProgramWeekNote` cuelga del `MonthlyProgram` existente (que ya es el ciclo de 28 días). `NutritionWeekNote` usa un `cycle_number` entero por cliente (ciclo sintético, ya que nutrición no tiene ancla). Endpoints `APIView` siguiendo el patrón del proyecto. En el frontend se reescriben dos secciones de `NotesTab.tsx` reutilizando los componentes `Composer`/`HistoryCard` y un helper puro de desbloqueo.

**Tech Stack:** Django 6 + DRF (backend), Next.js 16 + React 19 + TypeScript + Zustand (frontend), pytest / Jest / Playwright (tests).

**Convención de tests del proyecto:** los tests no se corren localmente; CI los ejecuta al hacer push. Cada tarea escribe el test ANTES de la implementación (orden TDD) y lo commitea junto al código; la verificación roja/verde la da CI. `python manage.py check` y `npm run build` sí se pueden correr localmente como smoke checks.

**Rama:** `hotfix/21052026-book-session-30-day-window` (decisión del usuario — se commitea sobre la rama activa).

**Spec de referencia:** `docs/superpowers/specs/2026-05-22-notas-semanales-programa-nutricion-design.md`

---

## Mapa de archivos

**Backend (crear):**
- `backend/core_app/models/program_week_note.py` — modelo `ProgramWeekNote`.
- `backend/core_app/models/nutrition_week_note.py` — modelo `NutritionWeekNote`.
- `backend/core_app/utils/program_weeks.py` — helper `current_week_number`.
- `backend/core_app/views/nutrition_week_note_views.py` — vistas de nutrición.
- `backend/core_app/migrations/00XX_program_nutrition_week_notes.py` — generada.
- `backend/core_app/tests/models/test_program_week_note.py`
- `backend/core_app/tests/models/test_nutrition_week_note.py`
- `backend/core_app/tests/views/test_program_week_note_views.py`
- `backend/core_app/tests/views/test_nutrition_week_note_views.py`

**Backend (modificar):**
- `backend/core_app/models/__init__.py` — registrar modelos.
- `backend/core_app/views/monthly_program_views.py` — vista `UpdateProgramWeekNoteView`, `MonthlyProgramSerializer`, prefetch.
- `backend/core_app/serializers/nutrition_daily_serializers.py` — `get_trainer_nutrition_note`.
- `backend/core_app/urls/api_urls.py` — registrar endpoints.
- `backend/core_app/tests/serializers/test_nutrition_daily_serializers.py` — test del cálculo de semana.

**Frontend (crear):**
- `frontend/lib/weekNotes.ts` — helper puro `computeWeekStates`.
- `frontend/app/__tests__/lib/weekNotes.test.ts`
- `frontend/e2e/trainer/trainer-client-week-notes.spec.ts`

**Frontend (modificar):**
- `frontend/lib/stores/trainerStore.ts` — tipos y métodos nuevos.
- `frontend/lib/stores/programStore.ts` — campo `current_week_note`.
- `frontend/app/components/trainer/NotesTab.tsx` — `LockedWeekCard`, `WeekNotesPanel`, `CycleSelector`, `ProgramaSection`, `NutricionSection`.
- `frontend/app/(app)/mi-programa/page.tsx` — render de `current_week_note`.

---

## Task 1: Modelo `ProgramWeekNote`

**Files:**
- Create: `backend/core_app/models/program_week_note.py`
- Modify: `backend/core_app/models/__init__.py`
- Test: `backend/core_app/tests/models/test_program_week_note.py`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/core_app/tests/models/test_program_week_note.py`:

```python
"""Tests del modelo ProgramWeekNote."""
from datetime import date

import pytest
from django.db import IntegrityError

from core_app.models import MonthlyProgram, ProgramWeekNote, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='pwn-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def program(customer):
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=2, goal='muscle_gain',
        start_date=date(2026, 5, 1), end_date=date(2026, 5, 28),
    )


def test_create_program_week_note(program):
    note = ProgramWeekNote.objects.create(program=program, week_number=1, notes='Semana 1')
    assert note.pk is not None
    assert note.program_id == program.pk
    assert note.notes == 'Semana 1'


def test_program_week_note_unique_per_week(program):
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='a')
    with pytest.raises(IntegrityError):
        ProgramWeekNote.objects.create(program=program, week_number=1, notes='b')


def test_program_week_notes_related_name(program):
    ProgramWeekNote.objects.create(program=program, week_number=2, notes='x')
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='y')
    weeks = list(program.week_notes.values_list('week_number', flat=True))
    assert weeks == [1, 2]  # ordering = ['week_number']
```

- [ ] **Step 2: Crear el modelo**

Crear `backend/core_app/models/program_week_note.py`:

```python
from django.db import models

from core_app.models.base import TimestampedModel
from core_app.models.monthly_program import MonthlyProgram


class ProgramWeekNote(TimestampedModel):
    """Nota semanal del entrenador (semana 1–4) dentro de un MonthlyProgram de 28 días."""

    program = models.ForeignKey(
        MonthlyProgram,
        on_delete=models.CASCADE,
        related_name='week_notes',
    )
    week_number = models.PositiveSmallIntegerField()  # 1–4
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['week_number']
        unique_together = [('program', 'week_number')]

    def __str__(self):
        return f'{self.program} — semana {self.week_number}'
```

- [ ] **Step 3: Registrar el modelo en `__init__.py`**

En `backend/core_app/models/__init__.py`, después de la línea
`from .monthly_program import MonthlyProgram, ProgramDay, ProgramExercise, DailyLog, ExerciseLog`
añadir:

```python
from .program_week_note import ProgramWeekNote
```

Y en la lista `__all__`, después de `'ExerciseLog',` añadir:

```python
    'ProgramWeekNote',
```

- [ ] **Step 4: Verificar** — `cd backend && source venv/bin/activate && python manage.py check` debe pasar sin errores. El test corre en CI (`pytest core_app/tests/models/test_program_week_note.py -v`).

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/models/program_week_note.py backend/core_app/models/__init__.py backend/core_app/tests/models/test_program_week_note.py
git commit -m "feat: añade modelo ProgramWeekNote para notas semanales del programa"
```

---

## Task 2: Modelo `NutritionWeekNote`

**Files:**
- Create: `backend/core_app/models/nutrition_week_note.py`
- Modify: `backend/core_app/models/__init__.py`
- Test: `backend/core_app/tests/models/test_nutrition_week_note.py`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/core_app/tests/models/test_nutrition_week_note.py`:

```python
"""Tests del modelo NutritionWeekNote."""
from datetime import date

import pytest
from django.db import IntegrityError

from core_app.models import NutritionWeekNote, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nwn-customer@test.com', password='pass',
        first_name='C', last_name='Two', role=User.Role.CUSTOMER,
    )


def test_create_nutrition_week_note(customer):
    note = NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='Semana 1',
    )
    assert note.pk is not None
    assert note.cycle_number == 1


def test_nutrition_week_note_unique_per_cycle_week(customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='a',
    )
    with pytest.raises(IntegrityError):
        NutritionWeekNote.objects.create(
            customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
            week_number=1, notes='b',
        )


def test_nutrition_week_note_ordering(customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=2, notes='x',
    )
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=2, cycle_start=date(2026, 5, 29),
        week_number=1, notes='y',
    )
    rows = list(NutritionWeekNote.objects.values_list('cycle_number', 'week_number'))
    assert rows == [(2, 1), (1, 2)]  # ordering = ['-cycle_number', 'week_number']
```

- [ ] **Step 2: Crear el modelo**

Crear `backend/core_app/models/nutrition_week_note.py`:

```python
from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionWeekNote(TimestampedModel):
    """Nota semanal de nutrición (semana 1–4) dentro de un ciclo sintético.

    Nutrición no tiene un modelo de ciclo de 28 días, así que el ciclo se
    identifica con un entero ``cycle_number`` por cliente.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nutrition_week_notes',
        limit_choices_to={'role': 'customer'},
    )
    cycle_number = models.PositiveSmallIntegerField()  # ≥ 1, por cliente
    cycle_start = models.DateField()
    week_number = models.PositiveSmallIntegerField()  # 1–4
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-cycle_number', 'week_number']
        unique_together = [('customer', 'cycle_number', 'week_number')]

    def __str__(self):
        return f'{self.customer} — ciclo {self.cycle_number} semana {self.week_number}'
```

- [ ] **Step 3: Registrar el modelo en `__init__.py`**

En `backend/core_app/models/__init__.py`, después de la línea
`from .weekly_nutrition_plan import WeeklyNutritionPlan, WeeklyPlanDay, WeeklyPlanMeal`
añadir:

```python
from .nutrition_week_note import NutritionWeekNote
```

Y en `__all__`, después de `'WeeklyPlanMeal',` añadir:

```python
    'NutritionWeekNote',
```

- [ ] **Step 4: Verificar** — `python manage.py check` pasa. Test corre en CI.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/models/nutrition_week_note.py backend/core_app/models/__init__.py backend/core_app/tests/models/test_nutrition_week_note.py
git commit -m "feat: añade modelo NutritionWeekNote para notas semanales de nutrición"
```

---

## Task 3: Migración

**Files:**
- Create: `backend/core_app/migrations/00XX_program_nutrition_week_notes.py` (generada)

- [ ] **Step 1: Generar la migración**

```bash
cd backend && source venv/bin/activate && python manage.py makemigrations core_app
```

Expected: crea un archivo de migración con `CreateModel` para `ProgramWeekNote` y `NutritionWeekNote`. Anotar el nombre real del archivo generado.

- [ ] **Step 2: Aplicar la migración**

```bash
python manage.py migrate core_app
```

Expected: `Applying core_app.00XX_... OK`.

- [ ] **Step 3: Verificar que no quedan migraciones pendientes**

```bash
python manage.py makemigrations core_app --check --dry-run
```

Expected: `No changes detected`.

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/migrations/
git commit -m "feat: migración para ProgramWeekNote y NutritionWeekNote"
```

---

## Task 4: Util de semana + endpoint de notas semanales del programa

**Files:**
- Create: `backend/core_app/utils/program_weeks.py`
- Modify: `backend/core_app/views/monthly_program_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_program_week_note_views.py`

- [ ] **Step 1: Crear el helper de cálculo de semana**

Crear `backend/core_app/utils/program_weeks.py`:

```python
"""Cálculo del índice de semana (1–4) dentro de un ciclo de 28 días."""
from django.utils import timezone


def current_week_number(start_date, today=None):
    """Devuelve la semana 1–4 vigente hoy para un ciclo que arranca en start_date.

    Antes del inicio → 1. Después del día 28 → 4.
    """
    if today is None:
        today = timezone.localdate()
    delta_days = (today - start_date).days
    if delta_days < 0:
        return 1
    week = delta_days // 7 + 1
    return min(max(week, 1), 4)
```

- [ ] **Step 2: Escribir el test que falla**

Crear `backend/core_app/tests/views/test_program_week_note_views.py`:

```python
"""Tests de UpdateProgramWeekNoteView (PATCH .../week-notes/<week>/)."""
from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import MonthlyProgram, ProgramWeekNote, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    return User.objects.create_user(
        email='pwnv-trainer@test.com', password='pass',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='pwnv-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


@pytest.fixture
def program(customer):
    return MonthlyProgram.objects.create(
        customer=customer, fitness_level=2, goal='muscle_gain',
        start_date=date(2026, 5, 1), end_date=date(2026, 5, 28),
    )


def test_patch_creates_week_note(api_client, trainer, program):
    api_client.force_authenticate(trainer)
    url = f'/api/monthly-programs/{program.pk}/week-notes/1/'
    resp = api_client.patch(url, {'notes': 'Foco fuerza'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['week_number'] == 1
    assert resp.data['notes'] == 'Foco fuerza'
    assert ProgramWeekNote.objects.filter(program=program, week_number=1).exists()


def test_patch_updates_existing_week_note(api_client, trainer, program):
    ProgramWeekNote.objects.create(program=program, week_number=2, notes='viejo')
    api_client.force_authenticate(trainer)
    url = f'/api/monthly-programs/{program.pk}/week-notes/2/'
    resp = api_client.patch(url, {'notes': 'nuevo'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['notes'] == 'nuevo'
    assert ProgramWeekNote.objects.filter(program=program, week_number=2).count() == 1


def test_patch_rejects_week_out_of_range(api_client, trainer, program):
    api_client.force_authenticate(trainer)
    resp = api_client.patch(
        f'/api/monthly-programs/{program.pk}/week-notes/5/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_forbidden_for_customer(api_client, customer, program):
    api_client.force_authenticate(customer)
    resp = api_client.patch(
        f'/api/monthly-programs/{program.pk}/week-notes/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN
```

- [ ] **Step 3: Añadir la vista**

En `backend/core_app/views/monthly_program_views.py`, después de la clase
`UpdateProgramNoteView` (termina en la línea `return Response({'id': program.pk, 'trainer_notes': program.trainer_notes})`), añadir:

```python
class UpdateProgramWeekNoteView(APIView):
    """PATCH — el entrenador hace upsert de una nota semanal (semana 1–4) de un MonthlyProgram."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, program_id, week_number):
        if not (is_admin_user(request.user) or request.user.role == 'trainer'):
            return Response({'detail': 'Forbidden.'}, status=status.HTTP_403_FORBIDDEN)

        if week_number < 1 or week_number > 4:
            return Response(
                {'detail': 'week_number must be between 1 and 4.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        try:
            program = MonthlyProgram.objects.get(pk=program_id)
        except MonthlyProgram.DoesNotExist:
            return Response({'detail': 'Program not found.'}, status=status.HTTP_404_NOT_FOUND)

        from core_app.models.program_week_note import ProgramWeekNote
        note, _ = ProgramWeekNote.objects.update_or_create(
            program=program,
            week_number=week_number,
            defaults={'notes': request.data.get('notes', '') or ''},
        )
        return Response({
            'id': note.pk,
            'program_id': program.pk,
            'week_number': note.week_number,
            'notes': note.notes,
            'updated_at': note.updated_at.isoformat(),
        })
```

- [ ] **Step 4: Registrar la URL**

En `backend/core_app/urls/api_urls.py`:

1. En el bloque de import `from core_app.views.monthly_program_views import (`, añadir `UpdateProgramWeekNoteView,` en orden alfabético (después de `UpdateProgramNoteView,`).
2. Después de la línea
`    path('monthly-programs/<int:program_id>/note/', UpdateProgramNoteView.as_view(), name='monthly-program-note'),`
añadir:

```python
    path('monthly-programs/<int:program_id>/week-notes/<int:week_number>/', UpdateProgramWeekNoteView.as_view(), name='monthly-program-week-note'),
```

- [ ] **Step 5: Verificar** — `python manage.py check` pasa. Tests corren en CI.

- [ ] **Step 6: Commit**

```bash
git add backend/core_app/utils/program_weeks.py backend/core_app/views/monthly_program_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_program_week_note_views.py
git commit -m "feat: endpoint PATCH para notas semanales del programa"
```

---

## Task 5: `MonthlyProgramSerializer` — `week_notes` y `current_week_note`

**Files:**
- Modify: `backend/core_app/views/monthly_program_views.py`
- Test: `backend/core_app/tests/views/test_program_week_note_views.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `backend/core_app/tests/views/test_program_week_note_views.py`:

```python
def test_customer_program_list_embeds_week_notes(api_client, trainer, program, customer):
    ProgramWeekNote.objects.create(program=program, week_number=1, notes='Semana uno')
    api_client.force_authenticate(trainer)
    resp = api_client.get(f'/api/monthly-programs/customer/{customer.pk}/')
    assert resp.status_code == status.HTTP_200_OK
    prog = resp.data[0]
    assert 'week_notes' in prog
    assert prog['week_notes'] == [
        {'week_number': 1, 'notes': 'Semana uno', 'updated_at': prog['week_notes'][0]['updated_at']}
    ]
    assert 'current_week_note' in prog
```

- [ ] **Step 2: Modificar el serializer**

En `backend/core_app/views/monthly_program_views.py`, reemplazar la clase
`MonthlyProgramSerializer` completa (actualmente líneas ~66–76) por:

```python
class MonthlyProgramSerializer(serializers.ModelSerializer):
    days = ProgramDaySerializer(many=True, read_only=True)
    week_notes = serializers.SerializerMethodField()
    current_week_note = serializers.SerializerMethodField()

    class Meta:
        model = MonthlyProgram
        fields = (
            'id', 'customer_id', 'fitness_level', 'goal',
            'start_date', 'end_date', 'status', 'trainer_notes',
            'week_notes', 'current_week_note',
            'approved_at', 'created_at', 'days',
        )
        read_only_fields = fields

    def get_week_notes(self, obj):
        return [
            {
                'week_number': n.week_number,
                'notes': n.notes,
                'updated_at': n.updated_at.isoformat(),
            }
            for n in obj.week_notes.all()
        ]

    def get_current_week_note(self, obj):
        from core_app.utils.program_weeks import current_week_number
        week = current_week_number(obj.start_date)
        note = next(
            (n for n in obj.week_notes.all() if n.week_number == week),
            None,
        )
        return note.notes if note and note.notes else None
```

- [ ] **Step 3: Añadir `prefetch_related('week_notes')` a las 3 querysets**

En el mismo archivo, añadir `'week_notes'` al `prefetch_related` de:

1. `ProgramDetailView.get` — cambiar
   `MonthlyProgram.objects.prefetch_related('days__exercises__exercise')`
   por
   `MonthlyProgram.objects.prefetch_related('days__exercises__exercise', 'week_notes')`.
2. `CustomerProgramListView.get` — cambiar
   `.prefetch_related('days__exercises__exercise')`
   por
   `.prefetch_related('days__exercises__exercise', 'week_notes')`.
3. `MyProgramView.get` — cambiar
   `.prefetch_related('days__exercises__exercise')`
   por
   `.prefetch_related('days__exercises__exercise', 'week_notes')`.

- [ ] **Step 4: Verificar** — `python manage.py check` pasa. Tests corren en CI.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/monthly_program_views.py backend/core_app/tests/views/test_program_week_note_views.py
git commit -m "feat: expone week_notes y current_week_note en MonthlyProgramSerializer"
```

---

## Task 6: Vistas y URLs de notas semanales de nutrición

**Files:**
- Create: `backend/core_app/views/nutrition_week_note_views.py`
- Modify: `backend/core_app/urls/api_urls.py`
- Test: `backend/core_app/tests/views/test_nutrition_week_note_views.py`

- [ ] **Step 1: Escribir el test que falla**

Crear `backend/core_app/tests/views/test_nutrition_week_note_views.py`:

```python
"""Tests de las vistas de NutritionWeekNote."""
from datetime import date

import pytest
from rest_framework import status
from rest_framework.test import APIClient

from core_app.models import NutritionWeekNote, User


@pytest.fixture
def api_client():
    return APIClient()


@pytest.fixture
def trainer(db):
    return User.objects.create_user(
        email='nwnv-trainer@test.com', password='pass',
        first_name='T', last_name='One', role=User.Role.TRAINER,
    )


@pytest.fixture
def customer(db):
    return User.objects.create_user(
        email='nwnv-customer@test.com', password='pass',
        first_name='C', last_name='One', role=User.Role.CUSTOMER,
    )


def test_patch_creates_cycle_1_week_1(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    url = f'/api/nutrition-week-notes/customer/{customer.pk}/1/1/'
    resp = api_client.patch(url, {'notes': 'Hidratación', 'cycle_start': '2026-05-01'}, format='json')
    assert resp.status_code == status.HTTP_200_OK
    assert resp.data['cycle_number'] == 1
    assert resp.data['week_number'] == 1
    assert resp.data['cycle_start'] == '2026-05-01'


def test_list_returns_all_notes(api_client, trainer, customer):
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=date(2026, 5, 1),
        week_number=1, notes='a')
    api_client.force_authenticate(trainer)
    resp = api_client.get(f'/api/nutrition-week-notes/customer/{customer.pk}/')
    assert resp.status_code == status.HTTP_200_OK
    assert len(resp.data) == 1
    assert resp.data[0]['notes'] == 'a'


def test_patch_rejects_cycle_skip(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    # No existe ciclo todavía → max = 0 → solo se permite ciclo 1
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/3/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_rejects_week_out_of_range(api_client, trainer, customer):
    api_client.force_authenticate(trainer)
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/1/9/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_400_BAD_REQUEST


def test_patch_forbidden_for_customer(api_client, customer):
    api_client.force_authenticate(customer)
    resp = api_client.patch(
        f'/api/nutrition-week-notes/customer/{customer.pk}/1/1/', {'notes': 'x'}, format='json')
    assert resp.status_code == status.HTTP_403_FORBIDDEN
```

- [ ] **Step 2: Crear el archivo de vistas**

Crear `backend/core_app/views/nutrition_week_note_views.py`:

```python
"""Vistas del entrenador para NutritionWeekNote (notas semanales de nutrición)."""
from datetime import date

from django.db.models import Max
from django.utils import timezone
from rest_framework import status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from core_app.models import NutritionWeekNote, User
from core_app.permissions import IsTrainerRole


def _serialize_note(n):
    return {
        'id': n.id,
        'cycle_number': n.cycle_number,
        'cycle_start': n.cycle_start.isoformat(),
        'week_number': n.week_number,
        'notes': n.notes,
        'updated_at': n.updated_at.isoformat(),
    }


class CustomerNutritionWeekNoteListView(APIView):
    """GET /api/nutrition-week-notes/customer/<customer_id>/ — todas las notas del cliente."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def get(self, request, customer_id):
        notes = NutritionWeekNote.objects.filter(customer_id=customer_id)
        return Response([_serialize_note(n) for n in notes])


class UpdateNutritionWeekNoteView(APIView):
    """PATCH /api/nutrition-week-notes/customer/<customer_id>/<cycle>/<week>/ — upsert."""

    permission_classes = [IsAuthenticated, IsTrainerRole]

    def patch(self, request, customer_id, cycle_number, week_number):
        if week_number < 1 or week_number > 4:
            return Response(
                {'detail': 'week_number must be between 1 and 4.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        if cycle_number < 1:
            return Response(
                {'detail': 'cycle_number must be >= 1.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        if not User.objects.filter(pk=customer_id, role='customer').exists():
            return Response({'detail': 'Customer not found.'}, status=status.HTTP_404_NOT_FOUND)

        current_max = (
            NutritionWeekNote.objects.filter(customer_id=customer_id)
            .aggregate(m=Max('cycle_number'))['m'] or 0
        )
        if cycle_number > current_max + 1:
            return Response(
                {'detail': 'cycle_number skips ahead.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        existing = NutritionWeekNote.objects.filter(
            customer_id=customer_id, cycle_number=cycle_number,
        ).first()
        if existing:
            cycle_start = existing.cycle_start
        else:
            raw = request.data.get('cycle_start')
            try:
                cycle_start = date.fromisoformat(raw) if raw else timezone.localdate()
            except (ValueError, TypeError):
                return Response(
                    {'detail': 'Invalid cycle_start format (use YYYY-MM-DD).'},
                    status=status.HTTP_400_BAD_REQUEST,
                )

        note, _ = NutritionWeekNote.objects.update_or_create(
            customer_id=customer_id,
            cycle_number=cycle_number,
            week_number=week_number,
            defaults={
                'notes': request.data.get('notes', '') or '',
                'cycle_start': cycle_start,
            },
        )
        return Response(_serialize_note(note))
```

- [ ] **Step 3: Registrar las URLs**

En `backend/core_app/urls/api_urls.py`:

1. Después del bloque de import de `nutrition_plan_views` (termina con `)`), añadir una línea nueva:

```python
from core_app.views.nutrition_week_note_views import (
    CustomerNutritionWeekNoteListView,
    UpdateNutritionWeekNoteView,
)
```

2. Después de la línea
`    path('nutrition-plans/<int:plan_id>/days/<int:day_id>/meals/<int:meal_id>/', EditPlanMealView.as_view(), name='nutrition-plan-edit-meal'),`
añadir:

```python
    path('nutrition-week-notes/customer/<int:customer_id>/', CustomerNutritionWeekNoteListView.as_view(), name='nutrition-week-note-list'),
    path('nutrition-week-notes/customer/<int:customer_id>/<int:cycle_number>/<int:week_number>/', UpdateNutritionWeekNoteView.as_view(), name='nutrition-week-note-update'),
```

- [ ] **Step 4: Verificar** — `python manage.py check` pasa. Tests corren en CI.

- [ ] **Step 5: Commit**

```bash
git add backend/core_app/views/nutrition_week_note_views.py backend/core_app/urls/api_urls.py backend/core_app/tests/views/test_nutrition_week_note_views.py
git commit -m "feat: endpoints de notas semanales de nutrición"
```

---

## Task 7: `get_trainer_nutrition_note` → nota de nutrición vigente

**Files:**
- Modify: `backend/core_app/serializers/nutrition_daily_serializers.py`
- Test: `backend/core_app/tests/serializers/test_nutrition_daily_serializers.py`

- [ ] **Step 1: Escribir el test que falla**

Añadir al final de `backend/core_app/tests/serializers/test_nutrition_daily_serializers.py`:

```python
def test_trainer_nutrition_note_uses_current_nutrition_week(db):
    """get_trainer_nutrition_note devuelve la nota de la semana de nutrición vigente."""
    from datetime import date, timedelta
    from core_app.models import NutritionDailyLog, NutritionWeekNote, User
    from core_app.serializers.nutrition_daily_serializers import NutritionDailyLogSerializer

    customer = User.objects.create_user(
        email='tnn-customer@test.com', password='pass',
        first_name='C', last_name='N', role=User.Role.CUSTOMER,
    )
    today = date.today()
    cycle_start = today - timedelta(days=8)  # día 9 → semana 2
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=cycle_start,
        week_number=1, notes='Semana 1 nutrición')
    NutritionWeekNote.objects.create(
        customer=customer, cycle_number=1, cycle_start=cycle_start,
        week_number=2, notes='Semana 2 nutrición')
    log = NutritionDailyLog.objects.create(customer=customer, date=today)

    data = NutritionDailyLogSerializer(log).data
    assert data['trainer_nutrition_note'] == 'Semana 2 nutrición'
```

- [ ] **Step 2: Modificar el método del serializer**

En `backend/core_app/serializers/nutrition_daily_serializers.py`, reemplazar el método
`get_trainer_nutrition_note` (actualmente líneas ~101–103) por:

```python
    def get_trainer_nutrition_note(self, obj):
        from core_app.models.nutrition_week_note import NutritionWeekNote
        from core_app.utils.program_weeks import current_week_number

        latest = (
            NutritionWeekNote.objects
            .filter(customer=obj.customer)
            .order_by('-cycle_number')
            .first()
        )
        if latest is None:
            return None
        week = current_week_number(latest.cycle_start)
        note = NutritionWeekNote.objects.filter(
            customer=obj.customer,
            cycle_number=latest.cycle_number,
            week_number=week,
        ).first()
        return note.notes or None if note else None
```

- [ ] **Step 3: Verificar** — `python manage.py check` pasa. Tests corren en CI.

- [ ] **Step 4: Commit**

```bash
git add backend/core_app/serializers/nutrition_daily_serializers.py backend/core_app/tests/serializers/test_nutrition_daily_serializers.py
git commit -m "feat: la nota de nutrición del cliente usa la semana de nutrición vigente"
```

---

## Task 8: `trainerStore` — tipos y métodos

**Files:**
- Modify: `frontend/lib/stores/trainerStore.ts`

- [ ] **Step 1: Añadir los tipos**

En `frontend/lib/stores/trainerStore.ts`, reemplazar el tipo `ClientMonthlyProgram` (actualmente líneas ~337–347) por:

```typescript
export type ProgramWeekNote = {
  week_number: number;
  notes: string;
  updated_at: string;
};

export type ClientMonthlyProgram = {
  id: number;
  start_date: string;
  end_date: string;
  status: string;
  goal: string;
  fitness_level: number;
  trainer_notes: string;
  week_notes: ProgramWeekNote[];
  approved_at: string | null;
  is_paused: boolean;
};

export type ClientNutritionWeekNote = {
  id: number;
  cycle_number: number;
  cycle_start: string;
  week_number: number;
  notes: string;
  updated_at: string;
};
```

- [ ] **Step 2: Declarar el estado y los métodos en el tipo `TrainerState`**

En el bloque `// ── Notes hub: monthly programs ──` del tipo `TrainerState` (líneas ~324–328), reemplazar la línea
`  updateMonthlyProgramNote: (customerId: number, programId: number, notes: string) => Promise<void>;`
por:

```typescript
  updateMonthlyProgramNote: (customerId: number, programId: number, notes: string) => Promise<void>;
  updateProgramWeekNote: (customerId: number, programId: number, weekNumber: number, notes: string) => Promise<void>;

  // ── Notes hub: nutrition week notes ──
  clientNutritionWeekNotes: Record<number, ClientNutritionWeekNote[]>;
  nutritionWeekNotesLoading: boolean;
  fetchClientNutritionWeekNotes: (customerId: number) => Promise<void>;
  updateNutritionWeekNote: (customerId: number, cycleNumber: number, weekNumber: number, notes: string, cycleStart?: string) => Promise<void>;
```

- [ ] **Step 3: Inicializar el estado nuevo**

En el objeto que pasa `create<TrainerState>`, después de la línea
`  weeklyPlansLoading: false,` añadir:

```typescript
  clientNutritionWeekNotes: {},
  nutritionWeekNotesLoading: false,
```

- [ ] **Step 4: Añadir los métodos**

En el mismo archivo, justo después del método `updateMonthlyProgramNote` (termina en `},` antes de `fetchClientWeeklyPlans`), añadir:

```typescript
  updateProgramWeekNote: async (customerId, programId, weekNumber, notes) => {
    await api.patch(
      `/monthly-programs/${programId}/week-notes/${weekNumber}/`,
      { notes },
      { headers: authHeaders() },
    );
    set((s) => ({
      clientMonthlyPrograms: {
        ...s.clientMonthlyPrograms,
        [customerId]: (s.clientMonthlyPrograms[customerId] ?? []).map((p) => {
          if (p.id !== programId) return p;
          const others = (p.week_notes ?? []).filter((w) => w.week_number !== weekNumber);
          const next = [...others, { week_number: weekNumber, notes, updated_at: new Date().toISOString() }];
          next.sort((a, b) => a.week_number - b.week_number);
          return { ...p, week_notes: next };
        }),
      },
    }));
  },

  fetchClientNutritionWeekNotes: async (customerId) => {
    set({ nutritionWeekNotesLoading: true });
    try {
      const { data } = await api.get(`/nutrition-week-notes/customer/${customerId}/`, { headers: authHeaders() });
      const notes = (data ?? []) as ClientNutritionWeekNote[];
      set((s) => ({
        clientNutritionWeekNotes: { ...s.clientNutritionWeekNotes, [customerId]: notes },
        nutritionWeekNotesLoading: false,
      }));
    } catch {
      set({ nutritionWeekNotesLoading: false });
    }
  },

  updateNutritionWeekNote: async (customerId, cycleNumber, weekNumber, notes, cycleStart) => {
    const { data } = await api.patch(
      `/nutrition-week-notes/customer/${customerId}/${cycleNumber}/${weekNumber}/`,
      { notes, ...(cycleStart ? { cycle_start: cycleStart } : {}) },
      { headers: authHeaders() },
    );
    set((s) => {
      const rest = (s.clientNutritionWeekNotes[customerId] ?? []).filter(
        (n) => !(n.cycle_number === cycleNumber && n.week_number === weekNumber),
      );
      return {
        clientNutritionWeekNotes: {
          ...s.clientNutritionWeekNotes,
          [customerId]: [...rest, data as ClientNutritionWeekNote],
        },
      };
    });
  },
```

- [ ] **Step 5: Verificar** — desde `frontend/`, `npx tsc --noEmit` no debe reportar errores nuevos en `trainerStore.ts`.

- [ ] **Step 6: Commit**

```bash
git add frontend/lib/stores/trainerStore.ts
git commit -m "feat: métodos de notas semanales en trainerStore"
```

---

## Task 9: Helper puro `computeWeekStates` + test unit

**Files:**
- Create: `frontend/lib/weekNotes.ts`
- Test: `frontend/app/__tests__/lib/weekNotes.test.ts`

- [ ] **Step 1: Escribir el test que falla**

Crear `frontend/app/__tests__/lib/weekNotes.test.ts`:

```typescript
import { computeWeekStates } from '@/lib/weekNotes';

describe('computeWeekStates', () => {
  it('semana 1 activa y el resto bloqueado cuando no hay notas', () => {
    const states = computeWeekStates({});
    expect(states).toEqual([
      { week: 1, state: 'active' },
      { week: 2, state: 'locked' },
      { week: 3, state: 'locked' },
      { week: 4, state: 'locked' },
    ]);
  });

  it('al completar la semana 1 se desbloquea la 2', () => {
    const states = computeWeekStates({ 1: 'Nota semana uno' });
    expect(states[0]).toEqual({ week: 1, state: 'done' });
    expect(states[1]).toEqual({ week: 2, state: 'active' });
    expect(states[2]).toEqual({ week: 3, state: 'locked' });
  });

  it('una nota en blanco no cuenta como completada', () => {
    const states = computeWeekStates({ 1: '   ' });
    expect(states[0]).toEqual({ week: 1, state: 'active' });
    expect(states[1]).toEqual({ week: 2, state: 'locked' });
  });

  it('todas las semanas completadas quedan en done', () => {
    const states = computeWeekStates({ 1: 'a', 2: 'b', 3: 'c', 4: 'd' });
    expect(states.every((s) => s.state === 'done')).toBe(true);
  });
});
```

- [ ] **Step 2: Crear el helper**

Crear `frontend/lib/weekNotes.ts`:

```typescript
export type WeekState = 'done' | 'active' | 'locked';

export type WeekSlot = { week: number; state: WeekState };

/**
 * Calcula el estado de las 4 semanas de un ciclo a partir de las notas guardadas.
 * - done:   la semana tiene contenido no vacío.
 * - active: la semana está vacía y (es la 1 o la anterior tiene contenido).
 * - locked: la semana está vacía y la anterior también.
 */
export function computeWeekStates(notesByWeek: Record<number, string>): WeekSlot[] {
  const hasContent = (w: number) => {
    const value = notesByWeek[w];
    return !!(value && value.trim());
  };
  return [1, 2, 3, 4].map((week) => {
    if (hasContent(week)) return { week, state: 'done' as WeekState };
    if (week === 1 || hasContent(week - 1)) return { week, state: 'active' as WeekState };
    return { week, state: 'locked' as WeekState };
  });
}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` sin errores. Test corre en CI (`npm test -- app/__tests__/lib/weekNotes.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/weekNotes.ts frontend/app/__tests__/lib/weekNotes.test.ts
git commit -m "feat: helper computeWeekStates para desbloqueo progresivo de semanas"
```

---

## Task 10: NotesTab — `LockedWeekCard`, `WeekNotesPanel`, `CycleSelector`

**Files:**
- Modify: `frontend/app/components/trainer/NotesTab.tsx`

- [ ] **Step 1: Añadir el import del helper y del icono**

En `frontend/app/components/trainer/NotesTab.tsx`, en los imports del tope del archivo añadir:

```typescript
import { Lock } from 'lucide-react';
import { computeWeekStates } from '@/lib/weekNotes';
```

Y en la línea de import de `trainerStore` (línea ~10), añadir `type ClientNutritionWeekNote` a la lista de tipos importados:

```typescript
import { useTrainerStore, type ClientSession, type ClientMonthlyProgram, type ClientWeeklyPlan, type ClientNutritionWeekNote, type TrainerMessageItem } from '@/lib/stores/trainerStore';
```

- [ ] **Step 2: Añadir `LockedWeekCard`**

En `NotesTab.tsx`, justo después del componente `HistoryCard` (termina en su `}` de cierre, antes del comentario `// ─── Section with composer + paginated history ──`), añadir:

```tsx
// ─── Locked week card ───────────────────────────────────────
function LockedWeekCard({ week, range }: { week: number; range: string }) {
  return (
    <div style={{
      background: 'rgba(103,15,34,0.03)',
      borderRadius: 18,
      border: `1px dashed ${T.borderMed}`,
      padding: '14px 16px',
      minHeight: 120,
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      gap: 8,
    }}>
      <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, fontWeight: 700, letterSpacing: '0.16em', textTransform: 'uppercase', color: T.textSoft }}>
        Semana {week}{range ? ` · ${range}` : ''}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <Lock size={13} color={T.textSoft} strokeWidth={2} />
        <span style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 11, color: T.textSoft, fontStyle: 'italic' }}>
          Se desbloquea al guardar la semana anterior.
        </span>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Añadir `WeekNotesPanel`**

Justo después de `LockedWeekCard`, añadir:

```tsx
// ─── Panel de 4 semanas (compartido programa/nutrición) ──────
function WeekNotesPanel({ notesByWeek, cycleStartISO, onSave }: {
  notesByWeek: Record<number, string>;
  cycleStartISO: string | null;
  onSave: (week: number, notes: string) => Promise<void>;
}) {
  const [editingWeek, setEditingWeek] = useState<number | null>(null);
  const states = computeWeekStates(notesByWeek);
  const activeWeek = states.find(s => s.state === 'active')?.week ?? null;
  const composerWeek = editingWeek ?? activeWeek;

  function weekRange(week: number): string {
    if (!cycleStartISO) return '';
    const start = new Date(cycleStartISO + 'T12:00:00');
    start.setDate(start.getDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    const fmt = (d: Date) => d.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' });
    return `${fmt(start)} → ${fmt(end)}`;
  }

  return (
    <div className={GRID_CLASS}>
      {[1, 2, 3, 4].map(w => {
        const slot = states.find(s => s.week === w)!;
        const range = weekRange(w);

        if (w === composerWeek) {
          return (
            <Composer
              key={w}
              kicker={`Semana ${w} de 4`}
              title={`Nota de la semana ${w}`}
              meta={range}
              notes={notesByWeek[w] ?? ''}
              placeholder={`Observaciones del entrenador para la semana ${w}…`}
              rows={6}
              onSave={async (notes) => { await onSave(w, notes); setEditingWeek(null); }}
            />
          );
        }
        if (slot.state === 'done' || slot.state === 'active') {
          return (
            <HistoryCard
              key={w}
              kicker={`Semana ${w}`}
              title={range || `Semana ${w}`}
              snippet={notesByWeek[w] ?? ''}
              onClick={() => setEditingWeek(w)}
            />
          );
        }
        return <LockedWeekCard key={w} week={w} range={range} />;
      })}
    </div>
  );
}

// ─── Selector de ciclo (lista de pills) ──────────────────────
function CycleSelector({ items, selectedId, onSelect }: {
  items: { id: number; label: string; sub: string }[];
  selectedId: number;
  onSelect: (id: number) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {items.map(it => {
        const isActive = it.id === selectedId;
        return (
          <button
            key={it.id}
            type="button"
            onClick={() => onSelect(it.id)}
            style={{
              padding: '8px 14px', borderRadius: 14, cursor: 'pointer',
              border: `1px solid ${isActive ? T.borderMed : T.border}`,
              background: isActive ? 'rgba(103,15,34,0.06)' : 'rgba(255,255,255,0.55)',
              textAlign: 'left',
            }}
          >
            <div style={{ fontFamily: 'Cinzel, serif', fontSize: 12, fontWeight: 600, color: T.wine }}>
              {it.label}
            </div>
            <div style={{ fontFamily: 'Montserrat, sans-serif', fontSize: 9, color: T.textSoft, textTransform: 'uppercase', letterSpacing: '0.1em', marginTop: 2 }}>
              {it.sub}
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 4: Verificar** — `npx tsc --noEmit`. Habrá errores en `ProgramaSection`/`NutricionSection` (aún sin actualizar) que se resuelven en Task 11 y 12; los componentes nuevos en sí no deben tener errores.

- [ ] **Step 5: Commit**

```bash
git add frontend/app/components/trainer/NotesTab.tsx
git commit -m "feat: componentes WeekNotesPanel, LockedWeekCard y CycleSelector"
```

---

## Task 11: NotesTab — reescribir `ProgramaSection`

**Files:**
- Modify: `frontend/app/components/trainer/NotesTab.tsx`

- [ ] **Step 1: Reemplazar `ProgramaSection`**

En `NotesTab.tsx`, reemplazar la función `ProgramaSection` completa (desde `// ─── Programa ───` hasta el `}` de cierre de la función, actualmente líneas ~756–797) por:

```tsx
// ─── Programa ────────────────────────────────────────────────
function ProgramaSection({ clientId }: { clientId: number }) {
  const { clientMonthlyPrograms, monthlyProgramsLoading, fetchClientMonthlyPrograms, updateProgramWeekNote } = useTrainerStore();
  const programs = clientMonthlyPrograms[clientId] ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);

  useEffect(() => {
    if (!clientMonthlyPrograms[clientId] && !monthlyProgramsLoading) fetchClientMonthlyPrograms(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (programs.length > 0 && selectedId === null) setSelectedId(programs[0].id);
  }, [programs, selectedId]);

  if (monthlyProgramsLoading && programs.length === 0) return <Spinner />;

  if (programs.length === 0) {
    return (
      <div className="space-y-2">
        <p style={labelStyle}>Ciclos de 28 días</p>
        <EmptyState
          title="Sin programas de entrenamiento"
          description="Cuando se genere el primer programa de 28 días, aparecerá aquí."
        />
      </div>
    );
  }

  const selected = programs.find(p => p.id === selectedId) ?? programs[0];
  const notesByWeek: Record<number, string> = {};
  (selected.week_notes ?? []).forEach(n => { notesByWeek[n.week_number] = n.notes; });

  return (
    <div className="space-y-3">
      <p style={labelStyle}>Ciclos de 28 días</p>
      <CycleSelector
        items={programs.map(p => ({
          id: p.id,
          label: formatDateRange(p.start_date, p.end_date),
          sub: `${p.status}${p.is_paused ? ' · pausado' : ''} · ${p.goal}`,
        }))}
        selectedId={selected.id}
        onSelect={setSelectedId}
      />
      <WeekNotesPanel
        notesByWeek={notesByWeek}
        cycleStartISO={selected.start_date}
        onSave={(week, notes) => updateProgramWeekNote(clientId, selected.id, week, notes)}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit` no debe reportar errores en `ProgramaSection`. (`updateMonthlyProgramNote` puede quedar declarado pero sin uso aquí; sigue existiendo en el store y en otras superficies — no se elimina.)

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/trainer/NotesTab.tsx
git commit -m "feat: subtab Programa con notas semanales y desbloqueo progresivo"
```

---

## Task 12: NotesTab — reescribir `NutricionSection`

**Files:**
- Modify: `frontend/app/components/trainer/NotesTab.tsx`

- [ ] **Step 1: Reemplazar `NutricionSection`**

En `NotesTab.tsx`, reemplazar la función `NutricionSection` completa (desde `// ─── Nutrición ───` hasta su `}` de cierre, actualmente líneas ~799–875) por:

```tsx
// ─── Nutrición ───────────────────────────────────────────────
function NutricionSection({ clientId }: { clientId: number }) {
  const { clientNutritionWeekNotes, nutritionWeekNotesLoading, fetchClientNutritionWeekNotes, updateNutritionWeekNote } = useTrainerStore();
  const { entries: habits, fetchClientEntries: fetchHabits, approveEntry } = useNutritionStore();
  const allNotes = clientNutritionWeekNotes[clientId] ?? [];
  const [selectedCycle, setSelectedCycle] = useState<number | null>(null);

  useEffect(() => {
    if (!clientNutritionWeekNotes[clientId] && !nutritionWeekNotesLoading) fetchClientNutritionWeekNotes(clientId);
    fetchHabits(clientId);
  }, [clientId]); // eslint-disable-line react-hooks/exhaustive-deps

  const savedCycles = Array.from(new Set(allNotes.map(n => n.cycle_number))).sort((a, b) => b - a);
  const maxCycle = savedCycles.length ? savedCycles[0] : 0;

  useEffect(() => {
    if (selectedCycle === null) setSelectedCycle(maxCycle >= 1 ? maxCycle : 1);
  }, [maxCycle, selectedCycle]);

  const cycle = selectedCycle ?? 1;
  const cycleNotes = allNotes.filter(n => n.cycle_number === cycle);
  const notesByWeek: Record<number, string> = {};
  cycleNotes.forEach(n => { notesByWeek[n.week_number] = n.notes; });
  const cycleStartISO = cycleNotes[0]?.cycle_start ?? null;

  // "Nuevo ciclo" se habilita cuando el ciclo más reciente tiene las 4 semanas con contenido.
  const latestCycleNotes = allNotes.filter(n => n.cycle_number === maxCycle);
  const latestComplete = maxCycle >= 1 && [1, 2, 3, 4].every(w =>
    latestCycleNotes.some(n => n.week_number === w && n.notes.trim()));

  // Pills a mostrar: ciclos guardados + el ciclo seleccionado aunque sea nuevo (sin notas todavía).
  const displayCycles = Array.from(new Set([...savedCycles, cycle])).sort((a, b) => b - a);
  const todayISO = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      <div className="space-y-3">
        <p style={labelStyle}>Notas por semana · ciclo de 28 días</p>

        {nutritionWeekNotesLoading && allNotes.length === 0 ? (
          <Spinner />
        ) : (
          <>
            <div className="flex flex-wrap gap-2 items-center">
              {displayCycles.map(c => {
                const isActive = c === cycle;
                const cStart = allNotes.find(n => n.cycle_number === c)?.cycle_start ?? null;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCycle(c)}
                    style={{
                      padding: '8px 14px', borderRadius: 14, cursor: 'pointer',
                      border: `1px solid ${isActive ? T.borderMed : T.border}`,
                      background: isActive ? 'rgba(103,15,34,0.06)' : 'rgba(255,255,255,0.55)',
                      fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
                      letterSpacing: '0.08em', color: T.wine,
                    }}
                  >
                    Ciclo {c}{cStart ? ` · ${formatDateShort(cStart)}` : ''}
                  </button>
                );
              })}
              {latestComplete && (
                <button
                  type="button"
                  onClick={() => setSelectedCycle(maxCycle + 1)}
                  style={{
                    padding: '8px 14px', borderRadius: 14, cursor: 'pointer',
                    border: `1px dashed ${T.borderMed}`, background: 'transparent',
                    fontFamily: 'Montserrat, sans-serif', fontSize: 11, fontWeight: 700,
                    letterSpacing: '0.08em', color: T.textMed,
                  }}
                >
                  + Nuevo ciclo
                </button>
              )}
            </div>

            <WeekNotesPanel
              notesByWeek={notesByWeek}
              cycleStartISO={cycleStartISO}
              onSave={(week, notes) => updateNutritionWeekNote(clientId, cycle, week, notes, cycleStartISO ?? todayISO)}
            />
          </>
        )}
      </div>

      <PaginatedSection<NutritionHabit>
        sectionLabel="Evaluación de hábitos nutricionales"
        items={habits}
        renderComposer={(h) => (
          <Composer
            kicker={h.trainer_approved_at ? '✓ Aprobada' : 'Pendiente de aprobación'}
            title="Hábitos del cliente"
            meta={`Registrada el ${formatDate(h.created_at)}`}
            notes={h.trainer_notes ?? ''}
            placeholder="Notas y observaciones sobre los hábitos del cliente…"
            rows={5}
            onSave={async (notes) => { await approveEntry(clientId, h.id, notes); }}
          />
        )}
        renderHistory={(h, onSelect) => (
          <HistoryCard
            key={h.id}
            kicker={h.trainer_approved_at ? '✓ Aprobada' : 'Pendiente'}
            title={formatDate(h.created_at)}
            meta={h.habit_category ? `Score · ${h.habit_category}` : undefined}
            snippet={h.trainer_notes ?? ''}
            onClick={onSelect}
            onDelete={async () => { await approveEntry(clientId, h.id, ''); }}
          />
        )}
        emptyTitle="Sin registros de hábitos"
        emptyDescription="El cliente aún no ha registrado sus hábitos nutricionales."
      />
    </div>
  );
}
```

- [ ] **Step 2: Verificar** — `npx tsc --noEmit` sin errores. El tipo `ClientWeeklyPlan` y los métodos `fetchClientWeeklyPlans`/`updateWeeklyPlanNote` quedan sin uso en este archivo pero **no se eliminan** del store (siguen usados por otras superficies de nutrición). Si `tsc` o el linter marca el import `type ClientWeeklyPlan` como no usado en `NotesTab.tsx`, quitar solo ese nombre del import de `trainerStore` en la línea ~10.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/components/trainer/NotesTab.tsx
git commit -m "feat: subtab Nutrición con ciclos y notas semanales"
```

---

## Task 13: Vista del cliente — `mi-programa` usa `current_week_note`

**Files:**
- Modify: `frontend/lib/stores/programStore.ts`
- Modify: `frontend/app/(app)/mi-programa/page.tsx`

- [ ] **Step 1: Añadir el campo al tipo del store**

En `frontend/lib/stores/programStore.ts`, en el tipo `MonthlyProgram` (donde está `trainer_notes: string;`, línea ~45), añadir debajo:

```typescript
  current_week_note: string | null;
```

- [ ] **Step 2: Cambiar el render en `mi-programa`**

En `frontend/app/(app)/mi-programa/page.tsx`, en el bloque que renderiza la nota del entrenador (actualmente líneas ~267–279):

- Cambiar la condición `{activeProgram.trainer_notes && (` por `{activeProgram.current_week_note && (`.
- Cambiar el texto del label de `Nota del entrenador` por `Nota de la semana`.
- Cambiar `{activeProgram.trainer_notes}` por `{activeProgram.current_week_note}`.

El bloque resultante:

```tsx
            {activeProgram.current_week_note && (
              <div className="bg-white/70 backdrop-blur-sm rounded-2xl p-4 border border-white/60 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-7 h-7 rounded-full bg-kore-red/10 flex items-center justify-center">
                    <svg className="w-3.5 h-3.5 text-kore-red" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 01.865-.501 48.172 48.172 0 003.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0012 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018z" />
                    </svg>
                  </div>
                  <p className="text-[10.5px] font-semibold text-kore-gray-dark/50 uppercase tracking-[0.14em]">Nota de la semana</p>
                </div>
                <p className="text-sm text-kore-gray-dark/70 leading-relaxed">{activeProgram.current_week_note}</p>
              </div>
            )}
```

- [ ] **Step 3: Verificar** — `npx tsc --noEmit` sin errores. `npm run build` debe completar el static export.

- [ ] **Step 4: Commit**

```bash
git add frontend/lib/stores/programStore.ts "frontend/app/(app)/mi-programa/page.tsx"
git commit -m "feat: el cliente ve la nota de la semana vigente en mi-programa"
```

---

## Task 14: Test E2E del flujo de desbloqueo

**Files:**
- Create: `frontend/e2e/trainer/trainer-client-week-notes.spec.ts`

- [ ] **Step 1: Escribir el test E2E**

Crear `frontend/e2e/trainer/trainer-client-week-notes.spec.ts`:

```typescript
import { test, expect, injectTrainerAuthCookies } from '../fixtures';
import type { Page } from '@playwright/test';

/**
 * E2E del subtab Programa → notas semanales en el detalle de cliente del entrenador.
 * Verifica el desbloqueo progresivo: la semana 1 es editable, la 2 está bloqueada,
 * y tras guardar la semana 1 la 2 se desbloquea.
 */
test.describe('Trainer Client — Notas semanales del programa', () => {

  const baseProgram = {
    id: 7,
    customer_id: 1,
    fitness_level: 2,
    goal: 'muscle_gain',
    start_date: '2026-05-01',
    end_date: '2026-05-28',
    status: 'published',
    trainer_notes: '',
    week_notes: [] as { week_number: number; notes: string; updated_at: string }[],
    current_week_note: null,
    approved_at: '2026-05-01T10:00:00Z',
    created_at: '2026-05-01T10:00:00Z',
    is_paused: false,
    days: [],
  };

  async function setupMocks(page: Page, weekNotes = baseProgram.week_notes) {
    await page.route('**/api/trainer/dashboard-stats/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ total_clients: 1, today_sessions: 0, upcoming_sessions: [] }) }));
    await page.route('**/api/trainer/my-clients/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }));
    await page.route('**/api/trainer/my-clients/1/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, first_name: 'Gustavo', last_name: 'Perez', email: 'g@test.com', role: 'customer' }) }));
    await page.route('**/api/monthly-programs/customer/1/', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify([{ ...baseProgram, week_notes: weekNotes }]) }));
    // PATCH de la nota semanal
    await page.route('**/api/monthly-programs/7/week-notes/**', (route) => {
      const url = route.request().url();
      const week = Number(url.split('/week-notes/')[1].replace(/\//g, ''));
      const body = JSON.parse(route.request().postData() || '{}');
      route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ id: 1, program_id: 7, week_number: week, notes: body.notes, updated_at: '2026-05-22T10:00:00Z' }) });
    });
  }

  test('la semana 2 está bloqueada hasta guardar la semana 1', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    // Abrir la sección Notas y el subtab Programa
    await page.getByRole('button', { name: 'Notas' }).click();
    await page.getByRole('button', { name: 'Programa' }).click();

    await expect(page.getByText('Ciclos de 28 días')).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText('Semana 1 de 4')).toBeVisible();
    await expect(page.getByText('Se desbloquea al guardar la semana anterior.').first()).toBeVisible();
  });

  test('tras guardar la semana 1 se desbloquea la semana 2', async ({ page }) => {
    await injectTrainerAuthCookies(page);
    await setupMocks(page);
    await page.goto('/trainer/clients/client?id=1');

    await page.getByRole('button', { name: 'Notas' }).click();
    await page.getByRole('button', { name: 'Programa' }).click();
    await expect(page.getByText('Semana 1 de 4')).toBeVisible({ timeout: 15_000 });

    await page.getByPlaceholder(/semana 1/i).fill('Foco en técnica de sentadilla');
    await page.getByRole('button', { name: 'Guardar' }).click();

    // La semana 2 pasa a ser el composer activo
    await expect(page.getByText('Semana 2 de 4')).toBeVisible({ timeout: 10_000 });
  });
});
```

- [ ] **Step 2: Verificar** — el test corre en CI (`npx playwright test e2e/trainer/trainer-client-week-notes.spec.ts`). Si los `getByRole('button', { name: 'Notas' })` no resuelven (el tab usa otro elemento), ajustar el locator inspeccionando `app/(app)/trainer/clients/client/page.tsx` para ver cómo se renderiza la pestaña "Notas" del sidebar y el subtab.

- [ ] **Step 3: Commit**

```bash
git add frontend/e2e/trainer/trainer-client-week-notes.spec.ts
git commit -m "test: E2E del desbloqueo progresivo de notas semanales"
```

---

## Task 15: Verificación final

**Files:** ninguno (verificación e integración).

- [ ] **Step 1: Build del frontend**

```bash
cd frontend && npm run build
```

Expected: el static export se genera sin errores de tipo ni de compilación.

- [ ] **Step 2: Check del backend**

```bash
cd backend && source venv/bin/activate && python manage.py check && python manage.py makemigrations core_app --check --dry-run
```

Expected: `System check identified no issues` y `No changes detected`.

- [ ] **Step 3: Auditoría de flujos E2E**

Invocar la skill `e2e-user-flows-check` (regla de `CLAUDE.md`: cambio en flujo de usuario del frontend). Revisar que el flujo de notas semanales quede cubierto y reportar brechas.

- [ ] **Step 4: Push**

```bash
git push
```

Reportar la URL del PR existente de la rama `hotfix/21052026-book-session-30-day-window` (o la de "Create a pull request" si el push imprime una).

---

## Self-review (cobertura del spec)

- **§3.1 `ProgramWeekNote`** → Task 1. **§3.2 `NutritionWeekNote`** → Task 2. **§3.3 campo deprecado** → `MonthlyProgram.trainer_notes` se conserva; ninguna tarea lo borra.
- **§4.1 endpoint programa + listado embebido** → Task 4 (PATCH) + Task 5 (`week_notes` en el serializer).
- **§4.2 endpoints nutrición** → Task 6. **§4.3 validaciones** (rango semana, salto de ciclo) → Tasks 4 y 6.
- **§5.1 regla de desbloqueo** → Task 9 (`computeWeekStates`). **§5.2 subtab Programa** → Task 11. **§5.3 subtab Nutrición** → Task 12. **§5.4 store** → Task 8.
- **§6.1 `mi-programa`** → Tasks 5 (`current_week_note`) + 13. **§6.2 `trainer_nutrition_note`** → Task 7.
- **§7 pruebas** → tests en Tasks 1, 2, 4, 5, 6, 7 (backend), 9 (frontend unit), 14 (E2E).
- **§8 fuera de alcance** → respetado: sin migración de datos viejos, sin notificaciones, sin tocar generadores.
