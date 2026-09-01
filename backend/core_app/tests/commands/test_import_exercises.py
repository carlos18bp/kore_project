"""Tests for import_exercises --csv corruption filtering and cleanup."""

import sys
import textwrap
from datetime import date
from io import StringIO
from unittest.mock import MagicMock

import pytest
from django.contrib.auth import get_user_model
from django.core.management import call_command
from django.core.management.base import CommandError

from core_app.management.commands.import_exercises import _fitness_level, _goal_tags
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


def _fake_openpyxl(monkeypatch, rows):
    """Install a stub openpyxl module whose workbook yields the given rows.

    openpyxl is not a project dependency (the command imports it lazily), so
    the Excel path is tested against this boundary stub.
    """
    worksheet = MagicMock()
    worksheet.iter_rows.return_value = rows
    workbook = MagicMock()
    workbook.active = worksheet
    fake_module = MagicMock()
    fake_module.load_workbook.return_value = workbook
    monkeypatch.setitem(sys.modules, 'openpyxl', fake_module)
    return fake_module


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


@pytest.mark.parametrize(
    ('exercise_type', 'pattern', 'implement', 'expected'),
    [
        ('Stability', 'Push', 'Barbell', 1),
        ('Bodyweight', 'Core', 'None', 1),
        ('Bodyweight', 'Push', 'None', 2),
        ('Bodyweight', 'Plyometric', 'None', 3),
        ('Explosiveness', 'Monostructural', 'None', 3),
        ('Explosiveness', 'Complex', 'Barbell', 5),
        ('Explosiveness', 'Push', 'Barbell', 4),
        ('External Loading', 'Squat', 'Band', 2),
        ('External Loading', 'Squat', 'Barbell', 4),
        ('External Loading', 'Squat', 'Dumbbell', 3),
        ('External Loading', 'Complex', 'Barbell', 5),
    ],
)
def test_fitness_level_derived_from_type_pattern_implement(
    exercise_type, pattern, implement, expected
):
    """The 1-5 fitness level follows the type/pattern/implement rubric."""
    assert _fitness_level(exercise_type, pattern, implement) == expected


@pytest.mark.parametrize(
    ('exercise_type', 'pattern', 'expected'),
    [
        ('Stability', 'Core', ['general_health', 'rehab']),
        ('Bodyweight', 'Monostructural', ['fat_loss', 'general_health']),
        ('Bodyweight', 'Locomotion', ['fat_loss', 'general_health']),
        ('Bodyweight', 'Plyometric', ['fat_loss', 'general_health', 'sports_performance']),
        ('Explosiveness', 'Squat', ['fat_loss', 'general_health', 'sports_performance']),
        ('External Loading', 'Push', ['general_health', 'muscle_gain', 'sports_performance']),
        ('Bodyweight', 'Pull', ['general_health', 'muscle_gain']),
        ('External Loading', 'Single Leg', ['general_health', 'rehab', 'sports_performance']),
    ],
)
def test_goal_tags_derived_from_type_pattern(exercise_type, pattern, expected):
    """Goal tags accumulate per type/pattern rules on top of general_health."""
    assert _goal_tags(exercise_type, pattern) == expected


@pytest.mark.django_db
def test_excel_import_upserts_rows_by_name(monkeypatch):
    """Excel rows upsert by name with derived level, tags, active flag."""
    excel_row = (
        'Bench Press', 'done', 'Push', 'External Loading', 'Barbell',
        'Chest', 'Triceps', 'Sagittal', 'Push the bar up',
        'https://www.youtube.com/watch?v=bench123',
    )
    fake_module = _fake_openpyxl(monkeypatch, [excel_row, excel_row])
    out = StringIO()

    call_command('import_exercises', stdout=out)

    args, kwargs = fake_module.load_workbook.call_args
    assert args[0].endswith('data/exercises/tier2_exercises_with_links.xlsx')
    assert kwargs == {'read_only': True, 'data_only': True}
    rec = Exercise.objects.get(name='Bench Press')
    assert rec.fitness_level_min == 4
    assert rec.goal_tags == ['general_health', 'muscle_gain', 'sports_performance']
    assert rec.is_active is True
    assert 'created: 1, updated: 1' in out.getvalue()


@pytest.mark.django_db
def test_excel_row_without_name_counted_as_skipped(monkeypatch):
    """Excel rows with an empty name cell are skipped, not imported."""
    _fake_openpyxl(monkeypatch, [
        (None, 'done', 'Push', 'Bodyweight', 'None', 'Chest', '', 'Sagittal', '', ''),
    ])
    out = StringIO()

    call_command('import_exercises', stdout=out)

    assert Exercise.objects.count() == 0
    assert 'skipped (no name): 1' in out.getvalue()


def test_excel_import_missing_file_raises_command_error(tmp_path, monkeypatch):
    """A nonexistent --path aborts with CommandError before parsing."""
    fake_module = _fake_openpyxl(monkeypatch, [])

    with pytest.raises(CommandError) as exc_info:
        call_command('import_exercises', '--path', str(tmp_path / 'missing.xlsx'))

    assert 'File not found' in str(exc_info.value)
    fake_module.load_workbook.assert_not_called()


def test_csv_missing_file_raises_command_error(tmp_path):
    """A nonexistent --csv path aborts with CommandError."""
    with pytest.raises(CommandError) as exc_info:
        call_command('import_exercises', '--csv', str(tmp_path / 'missing.csv'))

    assert 'File not found' in str(exc_info.value)


@pytest.mark.django_db
def test_csv_row_without_youtube_url_counted_as_skipped(tmp_path):
    """CSV rows lacking a valid YouTube URL are skipped, not imported."""
    csv_path = _write_csv(tmp_path, '''\
        Sin Video,hecho,Empujar,Peso corporal,Ninguno,Pectorales,Tríceps,Sagital,Texto,sin-url
    ''')
    out = StringIO()

    call_command('import_exercises', '--csv', csv_path, stdout=out)

    assert Exercise.objects.count() == 0
    assert 'skipped: 1' in out.getvalue()


@pytest.mark.django_db
def test_csv_updates_record_matched_by_youtube_url(tmp_path):
    """A CSV row whose URL matches an existing record updates it in place."""
    Exercise.objects.create(
        name='Old English Name',
        youtube_url='https://www.youtube.com/watch?v=samevid1',
    )
    csv_path = _write_csv(tmp_path, '''\
        Nombre Nuevo,hecho,Empujar,Peso corporal,Ninguno,Pectorales,Tríceps,Sagital,Texto,https://www.youtube.com/watch?v=samevid1
    ''')
    out = StringIO()

    call_command('import_exercises', '--csv', csv_path, stdout=out)

    rec = Exercise.objects.get(youtube_url='https://www.youtube.com/watch?v=samevid1')
    assert rec.name == 'Nombre Nuevo'
    assert 'created: 0, updated: 1' in out.getvalue()


@pytest.mark.django_db
def test_csv_adopts_url_for_record_matched_by_name(tmp_path):
    """When only the name matches, the record adopts the CSV row's URL."""
    Exercise.objects.create(name='Flexión Diamante', youtube_url='')
    csv_path = _write_csv(tmp_path, '''\
        Flexión Diamante,hecho,Empujar,Peso corporal,Ninguno,Pectorales,Tríceps,Sagital,Texto,https://www.youtube.com/watch?v=newvid11
    ''')

    call_command('import_exercises', '--csv', csv_path, stdout=StringIO())

    rec = Exercise.objects.get(name='Flexión Diamante')
    assert rec.youtube_url == 'https://www.youtube.com/watch?v=newvid11'
    assert Exercise.objects.count() == 1


@pytest.mark.django_db(transaction=True)
def test_csv_renames_record_when_name_taken_by_another_record(tmp_path):
    """URL-matched updates that collide on name get a video-id suffix.

    Runs without the test-level atomic wrapper: the command's recovery path
    catches the IntegrityError from the first save, which is only legal when
    no outer transaction is active — as in production.
    """
    Exercise.objects.create(
        name='Sentadilla Goblet',
        youtube_url='https://www.youtube.com/watch?v=keeper11',
    )
    Exercise.objects.create(
        name='Old Import',
        youtube_url='https://www.youtube.com/watch?v=mine2222',
    )
    csv_path = _write_csv(tmp_path, '''\
        Sentadilla Goblet,hecho,Sentadilla,Carga externa,Mancuerna,Cuádriceps,Glúteos,Sagital,Texto,https://www.youtube.com/watch?v=mine2222
    ''')

    call_command('import_exercises', '--csv', csv_path, stdout=StringIO())

    renamed = Exercise.objects.get(youtube_url='https://www.youtube.com/watch?v=mine2222')
    assert renamed.name == 'Sentadilla Goblet (mine2222)'
