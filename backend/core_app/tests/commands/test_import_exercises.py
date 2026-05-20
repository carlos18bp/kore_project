"""Tests for import_exercises --csv corruption filtering and cleanup."""

import textwrap
from datetime import date
from io import StringIO

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command

from core_app.models.exercise import Exercise
from core_app.models.monthly_program import MonthlyProgram, ProgramDay, ProgramExercise


CSV_HEADER = (
    'Ejercicio,Estado,Patrón,Tipo,Implementación principal,'
    'Músculos primarios trabajados,Músculos secundarios trabajados,'
    'Plano,Explicación del ejercicio,URL de YouTube\n'
)


def _write_csv(tmp_path, body: str):
    path = tmp_path / 'exs.csv'
    path.write_text(CSV_HEADER + textwrap.dedent(body), encoding='utf-8')
    return str(path)


@pytest.mark.django_db
def test_corrupt_rows_are_skipped(tmp_path):
    """Rows with URLs in muscle columns must be filtered, not imported."""
    csv_path = _write_csv(tmp_path, '''\
        Push Up,hecho,Empujar,Peso corporal,Ninguno,Pectorales,Tríceps,Sagital,Explicación,https://www.youtube.com/watch?v=abc12345
        Bad Row,hecho,Empujar,Peso corporal,Ninguno,Tríceps https://www.youtube.com/watch?v=xxx,Bíceps,Sagital,Texto,https://www.youtube.com/watch?v=bad11111
    ''')
    out = StringIO()
    call_command('import_exercises', '--csv', csv_path, stdout=out)

    assert Exercise.objects.filter(name='Push Up').exists()
    assert not Exercise.objects.filter(name='Bad Row').exists()
    assert 'corrupt rows ignored: 1' in out.getvalue()


@pytest.mark.django_db
def test_oversized_muscles_skipped(tmp_path):
    """Rows where muscles field exceeds 120 chars are flagged as corrupt."""
    huge = 'x' * 200
    csv_path = _write_csv(tmp_path, f'''\
        Mega Muscle,hecho,Empujar,Peso corporal,Ninguno,{huge},Bíceps,Sagital,Texto,https://www.youtube.com/watch?v=zzz99999
    ''')
    call_command('import_exercises', '--csv', csv_path, stdout=StringIO())
    assert not Exercise.objects.filter(name='Mega Muscle').exists()


@pytest.mark.django_db
def test_clean_row_does_not_get_overwritten_by_corrupt_duplicate(tmp_path):
    """When clean + corrupt rows share a name, only the clean one survives.

    Regression for the bug introduced by widening primary_muscles to TextField
    without filtering malformed CSV rows: the corrupt row's name fallback
    overwrote a previously-imported clean record.
    """
    csv_path = _write_csv(tmp_path, '''\
        Flexión Escapular,hecho,Empujar,Peso corporal,Banco,Tríceps,Triceps,Sagital,Explicación limpia,https://www.youtube.com/watch?v=clean111
        Flexión Escapular,hecho,Empujar,Peso corporal,Banco,Tríceps https://www.youtube.com/watch?v=clean111 Abdominales,piernas rectas,Sagital,Texto basura,https://www.youtube.com/watch?v=dirty222
    ''')
    call_command('import_exercises', '--csv', csv_path, stdout=StringIO())

    rec = Exercise.objects.get(name='Flexión Escapular')
    assert rec.youtube_url == 'https://www.youtube.com/watch?v=clean111'
    assert 'http' not in rec.primary_muscles
    assert 'http' not in rec.secondary_muscles


@pytest.mark.django_db
def test_cleanup_corrupt_flag_removes_polluted_records(tmp_path):
    """`--cleanup-corrupt` deletes records left over from prior broken imports."""
    Exercise.objects.create(
        name='Legacy Bad',
        primary_muscles='Tríceps https://www.youtube.com/watch?v=xxx Abdominales',
        youtube_url='https://www.youtube.com/watch?v=legacy11',
    )
    Exercise.objects.create(
        name='Legacy Long',
        primary_muscles='x' * 200,
        youtube_url='https://www.youtube.com/watch?v=legacy22',
    )
    Exercise.objects.create(
        name='Legacy Good',
        primary_muscles='Pectorales',
        youtube_url='https://www.youtube.com/watch?v=legacy33',
    )

    csv_path = _write_csv(tmp_path, '')  # empty payload, only cleanup runs
    call_command('import_exercises', '--csv', csv_path, '--cleanup-corrupt', stdout=StringIO())

    assert not Exercise.objects.filter(name='Legacy Bad').exists()
    assert not Exercise.objects.filter(name='Legacy Long').exists()
    assert Exercise.objects.filter(name='Legacy Good').exists()


@pytest.mark.django_db
def test_cleanup_corrupt_skips_program_exercise_referenced_rows(tmp_path):
    """Corrupt rows referenced by ProgramExercise (PROTECT FK) survive and warn.

    Regression for the production bug where blanket Exercise.delete() raised
    ProtectedError atomically, leaving the entire cleanup as a no-op.
    """
    User = get_user_model()
    customer = User.objects.create_user(email='c@test.local', password='x', role='customer')

    protected = Exercise.objects.create(
        name='Protected Bad',
        primary_muscles='Tríceps https://youtu.be/abc Abdominales',
        youtube_url='https://www.youtube.com/watch?v=protect1',
    )
    Exercise.objects.create(
        name='Orphan Bad',
        primary_muscles='Pectorales https://youtu.be/xyz Tríceps',
        youtube_url='https://www.youtube.com/watch?v=orphan11',
    )
    Exercise.objects.create(
        name='Clean Exercise',
        primary_muscles='Pectorales',
        youtube_url='https://www.youtube.com/watch?v=cleanrow',
    )

    program = MonthlyProgram.objects.create(
        customer=customer,
        fitness_level=2,
        goal='general_health',
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 28),
    )
    day = ProgramDay.objects.create(
        program=program,
        day_number=1,
        date=date(2026, 1, 1),
        day_type='training',
    )
    ProgramExercise.objects.create(program_day=day, exercise=protected, reps=10)

    out = StringIO()
    csv_path = _write_csv(tmp_path, '')
    call_command('import_exercises', '--csv', csv_path, '--cleanup-corrupt', stdout=out)

    assert Exercise.objects.filter(name='Protected Bad').exists()
    assert not Exercise.objects.filter(name='Orphan Bad').exists()
    assert Exercise.objects.filter(name='Clean Exercise').exists()

    output = out.getvalue()
    assert 'skipped 1 corrupt exercise(s) referenced by ProgramExercise' in output
    assert f'id={protected.id}' in output
    assert "name='Protected Bad'" in output
