"""Tests for the nutrition habits score calculator."""


from core_app.services.nutrition_calculator import (
    _score_breakfast,
    _score_fruit,
    _score_meals,
    _score_protein,
    _score_sugary_drinks,
    _score_ultraprocessed,
    _score_vegetable,
    _score_water,
    classify_score,
    compute_all,
)


class TestScoreMeals:
    def test_three_or_more_gives_full(self):
        assert _score_meals(3) == 1.0
        assert _score_meals(5) == 1.0

    def test_two_gives_half(self):
        assert _score_meals(2) == 0.5

    def test_one_gives_zero(self):
        assert _score_meals(1) == 0.0

    def test_none_gives_zero(self):
        assert _score_meals(None) == 0.0


class TestScoreWater:
    def test_two_or_more_liters_full(self):
        assert _score_water(2.0) == 1.5
        assert _score_water(3.5) == 1.5

    def test_one_point_five_partial(self):
        assert _score_water(1.5) == 1.0
        assert _score_water(1.9) == 1.0

    def test_one_liter_partial(self):
        assert _score_water(1.0) == 0.5

    def test_below_one_zero(self):
        assert _score_water(0.5) == 0.0

    def test_none_gives_zero(self):
        assert _score_water(None) == 0.0


class TestScoreFruit:
    def test_five_or_more_full(self):
        assert _score_fruit(5) == 1.0
        assert _score_fruit(7) == 1.0

    def test_three_to_four_partial(self):
        assert _score_fruit(3) == 0.5
        assert _score_fruit(4) == 0.5

    def test_below_three_zero(self):
        assert _score_fruit(2) == 0.0
        assert _score_fruit(0) == 0.0


class TestScoreVegetable:
    def test_five_or_more_full(self):
        assert _score_vegetable(7) == 1.0

    def test_three_partial(self):
        assert _score_vegetable(3) == 0.5

    def test_below_three_zero(self):
        assert _score_vegetable(1) == 0.0


class TestScoreProtein:
    def test_five_full(self):
        assert _score_protein(5) == 1.5

    def test_four_partial(self):
        assert _score_protein(4) == 1.0

    def test_three_partial(self):
        assert _score_protein(3) == 0.5

    def test_two_or_less_zero(self):
        assert _score_protein(2) == 0.0
        assert _score_protein(1) == 0.0

    def test_none_zero(self):
        assert _score_protein(None) == 0.0


class TestScoreUltraprocessed:
    def test_three_or_less_full(self):
        assert _score_ultraprocessed(0) == 1.5
        assert _score_ultraprocessed(3) == 1.5

    def test_four_to_six_partial(self):
        assert _score_ultraprocessed(5) == 1.0

    def test_seven_to_ten_partial(self):
        assert _score_ultraprocessed(8) == 0.5

    def test_over_ten_zero(self):
        assert _score_ultraprocessed(11) == 0.0


class TestScoreSugaryDrinks:
    def test_two_or_less_full(self):
        assert _score_sugary_drinks(0) == 1.0
        assert _score_sugary_drinks(2) == 1.0

    def test_three_to_five_partial(self):
        assert _score_sugary_drinks(4) == 0.5

    def test_over_five_zero(self):
        assert _score_sugary_drinks(6) == 0.0


class TestScoreBreakfast:
    def test_yes_full(self):
        assert _score_breakfast(True) == 1.5

    def test_no_zero(self):
        assert _score_breakfast(False) == 0.0

    def test_none_zero(self):
        assert _score_breakfast(None) == 0.0


class TestClassifyScore:
    def test_zero_to_four_red(self):
        assert classify_score(0) == ('Hábitos por mejorar', 'red')
        assert classify_score(4) == ('Hábitos por mejorar', 'red')

    def test_five_to_seven_yellow(self):
        assert classify_score(5) == ('Hábitos intermedios', 'yellow')
        assert classify_score(7) == ('Hábitos intermedios', 'yellow')

    def test_eight_to_ten_green(self):
        assert classify_score(8) == ('Hábitos favorables', 'green')
        assert classify_score(10) == ('Hábitos favorables', 'green')

    def test_none_empty(self):
        assert classify_score(None) == ('', '')


class TestComputeAll:
    def test_perfect_score(self):
        result = compute_all(
            meals_per_day=4,
            water_liters=2.5,
            fruit_weekly=7,
            vegetable_weekly=7,
            protein_frequency=5,
            ultraprocessed_weekly=1,
            sugary_drinks_weekly=0,
            eats_breakfast=True,
        )
        assert result['habit_score'] == 10.0
        assert result['habit_category'] == 'Hábitos favorables'
        assert result['habit_color'] == 'green'

    def test_worst_score(self):
        result = compute_all(
            meals_per_day=1,
            water_liters=0.3,
            fruit_weekly=0,
            vegetable_weekly=0,
            protein_frequency=1,
            ultraprocessed_weekly=20,
            sugary_drinks_weekly=10,
            eats_breakfast=False,
        )
        assert result['habit_score'] == 0.0
        assert result['habit_color'] == 'red'

    def test_intermediate_score(self):
        result = compute_all(
            meals_per_day=3,
            water_liters=1.5,
            fruit_weekly=4,
            vegetable_weekly=4,
            protein_frequency=3,
            ultraprocessed_weekly=5,
            sugary_drinks_weekly=3,
            eats_breakfast=True,
        )
        # 1.0 + 1.0 + 0.5 + 0.5 + 0.5 + 1.0 + 0.5 + 1.5 = 6.5
        assert result['habit_score'] == 6.5
        assert result['habit_color'] == 'yellow'

    def test_all_none_gives_zero(self):
        result = compute_all()
        assert result['habit_score'] == 0.0
        assert result['habit_color'] == 'red'
