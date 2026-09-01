"""Tests for import_food_catalog CSV parsing, category mapping and idempotency."""

import textwrap
from decimal import Decimal
from io import StringIO

import pytest
from django.core.management import call_command

from core_app.models import Food


TACO_HEADER = (
    'nombre,categoria,calorias_kcal,proteinas_g,carbohidratos_g,grasas_g,fibra_g\n'
)
OFF_HEADER = (
    'product_name_es,product_name,food_groups_tags,nova_group,'
    'energy-kcal_100g,proteins_100g,carbohydrates_100g,fat_100g,'
    'fiber_100g,nutrition_grades\n'
)


def _write_taco(tmp_path, body: str):
    path = tmp_path / 'taco_alimentos_es.csv'
    path.write_text(TACO_HEADER + textwrap.dedent(body), encoding='utf-8')


def _write_off(tmp_path, body: str):
    path = tmp_path / 'off_colombia.csv'
    path.write_text(OFF_HEADER + textwrap.dedent(body), encoding='utf-8')


def _run(tmp_path, *extra):
    out = StringIO()
    call_command('import_food_catalog', '--data-dir', str(tmp_path), *extra, stdout=out)
    return out.getvalue()


@pytest.mark.django_db
def test_taco_row_creates_food_with_mapped_category(tmp_path):
    """A named TACO row becomes a Food with mapped category, parsed macros, 'Tr' as NULL; nameless rows are skipped."""
    _write_taco(tmp_path, '''\
        Pechuga de pollo,Carnes y derivados,165,"31,2",0,3.6,Tr
        ,Carnes y derivados,100,10,0,1,2
    ''')

    out = _run(tmp_path)

    food = Food.objects.get(name='Pechuga de pollo', source=Food.Source.TACO)
    assert food.category == Food.Category.PROTEIN
    assert food.calories_per_100g == Decimal('165')
    assert food.protein_per_100g == Decimal('31.2')
    assert food.fiber_per_100g is None
    assert 'TACO: 1 created, 0 updated' in out


@pytest.mark.django_db
def test_taco_unknown_category_defaults_to_snack(tmp_path):
    """TACO categories outside the known map fall back to SNACK."""
    _write_taco(tmp_path, '''\
        Cosa Exotica,Categoria Inventada,50,1,10,0.5,1
    ''')

    _run(tmp_path)

    assert Food.objects.get(name='Cosa Exotica').category == Food.Category.SNACK


@pytest.mark.django_db
def test_unparseable_nutrient_value_stored_as_none(tmp_path):
    """Non-numeric nutrient strings are stored as NULL, not zero."""
    _write_taco(tmp_path, '''\
        Arepa,Cereales y derivados,abc,5,25,2,1
    ''')

    _run(tmp_path)

    food = Food.objects.get(name='Arepa')
    assert food.calories_per_100g is None
    assert food.carbs_per_100g == Decimal('25')


@pytest.mark.django_db
def test_missing_source_files_emit_warnings(tmp_path):
    """When neither CSV exists the command warns per source, reports zero imports."""
    out = _run(tmp_path)

    assert 'TACO file not found' in out
    assert 'OFF file not found' in out
    assert 'Total: 0 created, 0 updated' in out
    assert Food.objects.count() == 0


@pytest.mark.django_db
def test_dry_run_reports_counts_without_saving(tmp_path):
    """`--dry-run` previews the created count while writing nothing to the DB."""
    _write_taco(tmp_path, 'Pollo,Carnes y derivados,165,31,0,3.6,0\n')
    _write_off(tmp_path, 'Leche entera,Whole milk,en:leches,1,61,3.2,4.8,3.3,0,a\n')

    out = _run(tmp_path, '--dry-run')

    assert Food.objects.count() == 0
    assert 'Total: 2 created, 0 updated' in out


@pytest.mark.django_db
def test_rerun_updates_existing_records_instead_of_duplicating(tmp_path):
    """Re-importing a food keyed by (name, source) updates it in place."""
    _write_taco(tmp_path, 'Pollo,Carnes y derivados,165,31,0,3.6,0\n')
    _write_off(tmp_path, 'Leche entera,Whole milk,en:leches,1,61,3.2,4.8,3.3,0,a\n')
    _run(tmp_path)
    _write_taco(tmp_path, 'Pollo,Carnes y derivados,200,31,0,3.6,0\n')

    out = _run(tmp_path)

    assert Food.objects.count() == 2
    assert Food.objects.get(name='Pollo').calories_per_100g == Decimal('200')
    assert 'Total: 0 created, 2 updated' in out


@pytest.mark.django_db
def test_off_row_creates_food_with_keyword_category(tmp_path):
    """A named OFF row maps food-group keyword, nova group, nutri-score; nameless rows are skipped."""
    _write_off(tmp_path, '''\
        Yogur griego,Greek yogurt,en:yogurts,4,97,9,3.9,5,0,b
        ,,en:yogurts,4,97,9,3.9,5,0,b
    ''')

    out = _run(tmp_path)

    food = Food.objects.get(name='Yogur griego', source=Food.Source.OPENFOODFACTS)
    assert food.category == Food.Category.DAIRY
    assert food.nova_group == 4
    assert food.nutri_score == 'B'
    assert 'Open Food Facts: 1 created, 0 updated' in out


@pytest.mark.django_db
@pytest.mark.parametrize(
    ('name_es', 'name_generic', 'expected'),
    [
        ('Leche entera', 'Whole milk', 'Leche entera'),
        ('', 'Whole milk', 'Whole milk'),
    ],
    ids=['spanish-name-wins', 'generic-name-fallback'],
)
def test_off_product_name_preference(tmp_path, name_es, name_generic, expected):
    """The Spanish product name is preferred, falling back to the generic one."""
    _write_off(tmp_path, f'{name_es},{name_generic},en:leches,1,61,3.2,4.8,3.3,0,a\n')

    _run(tmp_path)

    assert list(Food.objects.values_list('name', flat=True)) == [expected]


@pytest.mark.django_db
@pytest.mark.parametrize('nova_raw', ['0', '5', 'abc'])
def test_off_nova_group_outside_valid_range_stored_as_none(tmp_path, nova_raw):
    """nova_group values outside 1-4 are stored as NULL."""
    _write_off(tmp_path, f'Pan tajado,Sliced bread,en:panes,{nova_raw},250,8,48,3,2,c\n')

    _run(tmp_path)

    assert Food.objects.get(name='Pan tajado').nova_group is None


@pytest.mark.django_db
def test_off_unmatched_food_group_defaults_to_snack(tmp_path):
    """OFF rows whose food groups match no keyword fall back to SNACK."""
    _write_off(tmp_path, 'Cosa rara,Weird thing,en:unknown-stuff,2,100,1,10,1,0,e\n')

    _run(tmp_path)

    assert Food.objects.get(name='Cosa rara').category == Food.Category.SNACK
