"""Tests for the WeeklyNutritionPlan / meal-suggestion APIViews."""
from datetime import date, timedelta

import pytest
from django.urls import reverse
from rest_framework import status

from django.utils import timezone as dj_tz

from core_app.models import (
    MealSuggestion,
    Package,
    Subscription,
    TrainerProfile,
    User,
    WeeklyNutritionPlan,
    WeeklyPlanDay,
    WeeklyPlanMeal,
)

MEAL_BLOCKS = [
    MealSuggestion.MealBlock.BREAKFAST,
    MealSuggestion.MealBlock.MID_MORNING,
    MealSuggestion.MealBlock.LUNCH,
    MealSuggestion.MealBlock.SNACK,
    MealSuggestion.MealBlock.DINNER,
]


@pytest.fixture
def customer(db):
    user = User.objects.create_user(
        email='np-customer@test.com', password='pass', first_name='Carla', last_name='Diaz', role=User.Role.CUSTOMER,
    )
    pkg = Package.objects.create(title='Nutri', sessions_count=1, price=1, includes_nutrition=True)
    Subscription.objects.create(
        customer=user, package=pkg, sessions_total=1, status='active',
        starts_at=dj_tz.now(), expires_at=dj_tz.now() + timedelta(days=30), includes_nutrition=True,
    )
    return user


@pytest.fixture
def trainer(db):
    user = User.objects.create_user(
        email='np-trainer@test.com', password='pass', first_name='Tom', last_name='Reyes', role=User.Role.TRAINER,
    )
    TrainerProfile.objects.create(user=user, specialty='General')
    return user


def _suggestion(*, meal_block=MealSuggestion.MealBlock.BREAKFAST, title='Avena', is_active=True, calories=300):
    return MealSuggestion.objects.create(
        title=title, meal_block=meal_block, calories_estimate=calories,
        goal_tags=['general_health'], fitness_level_min=1, fitness_level_max=5, nova_max=2, is_active=is_active,
    )


def _plan(customer, *, status=WeeklyNutritionPlan.Status.DRAFT, trainer=None, week_start=date(2026, 4, 6)):
    return WeeklyNutritionPlan.objects.create(
        customer=customer,
        trainer=trainer.trainer_profile if trainer else None,
        goal='general_health', fitness_level=2,
        week_start=week_start, week_end=week_start + timedelta(days=27),
        status=status,
    )


def _meal_for(plan):
    day = WeeklyPlanDay.objects.create(plan=plan, day_number=1, date=plan.week_start)
    return WeeklyPlanMeal.objects.create(plan_day=day, meal_block=MealSuggestion.MealBlock.BREAKFAST, order=0)


@pytest.mark.django_db
class TestMealSuggestionCatalogGet:
    def test_lists_active_suggestions_with_count(self, api_client, customer):
        _suggestion(title='A')
        _suggestion(title='B')
        _suggestion(title='Inactiva', is_active=False)
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('meal-suggestions'))

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['count'] == 2
        assert len(resp.data['results']) == 2
        assert all(item['is_active'] for item in resp.data['results'])

    def test_filters_by_meal_block(self, api_client, customer):
        _suggestion(meal_block=MealSuggestion.MealBlock.BREAKFAST, title='Desa')
        _suggestion(meal_block=MealSuggestion.MealBlock.LUNCH, title='Almu')
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('meal-suggestions'), {'meal_block': MealSuggestion.MealBlock.LUNCH})

        assert resp.data['count'] == 1
        assert resp.data['results'][0]['meal_block'] == MealSuggestion.MealBlock.LUNCH

    def test_filters_by_search_substring(self, api_client, customer):
        _suggestion(title='Avena con frutas')
        _suggestion(title='Huevos revueltos')
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('meal-suggestions'), {'search': 'avena'})

        assert resp.data['count'] == 1
        assert 'Avena' in resp.data['results'][0]['title']

    def test_includes_inactive_when_all_param_is_set(self, api_client, customer):
        _suggestion(title='Activa')
        _suggestion(title='Inactiva', is_active=False)
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('meal-suggestions'), {'all': '1'})

        assert resp.data['count'] == 2

    def test_paginates_with_limit_and_offset(self, api_client, customer):
        for i in range(5):
            _suggestion(title=f'Plato {i}')
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('meal-suggestions'), {'limit': 2, 'offset': 1})

        assert resp.data['count'] == 5
        assert len(resp.data['results']) == 2


@pytest.mark.django_db
class TestMealSuggestionCatalogPost:
    def test_trainer_creates_suggestion_returns_201(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('meal-suggestions'), {
            'title': 'Bowl de avena', 'meal_block': MealSuggestion.MealBlock.BREAKFAST,
            'calories_estimate': 350, 'nova_max': 2, 'goal_tags': ['general_health'],
        }, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert MealSuggestion.objects.filter(title='Bowl de avena').exists()
        assert resp.data['title'] == 'Bowl de avena'

    def test_rejects_blank_title(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('meal-suggestions'), {
            'title': '  ', 'meal_block': MealSuggestion.MealBlock.BREAKFAST, 'calories_estimate': 350,
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_rejects_invalid_meal_block(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('meal-suggestions'), {
            'title': 'Algo', 'meal_block': 'merienda_extra', 'calories_estimate': 350,
        }, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_customer_cannot_create_suggestion(self, api_client, customer):
        api_client.force_authenticate(user=customer)

        resp = api_client.post(reverse('meal-suggestions'), {
            'title': 'Algo', 'meal_block': MealSuggestion.MealBlock.BREAKFAST, 'calories_estimate': 350,
        }, format='json')

        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestNutritionPlanList:
    def test_lists_customer_plans_newest_first(self, api_client, customer, trainer):
        _plan(customer, week_start=date(2026, 3, 2))
        _plan(customer, week_start=date(2026, 5, 4))
        api_client.force_authenticate(user=trainer)

        resp = api_client.get(reverse('nutrition-plan-list', args=[customer.id]))

        assert resp.status_code == status.HTTP_200_OK
        assert [p['week_start'] for p in resp.data] == ['2026-05-04', '2026-03-02']

    def test_requires_trainer_role(self, api_client, customer):
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('nutrition-plan-list', args=[customer.id]))

        assert resp.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
class TestGenerateNutritionPlan:
    def test_generates_draft_plan(self, api_client, customer, trainer):
        for block in MEAL_BLOCKS:
            _suggestion(meal_block=block, title=f'Plato {block}')
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-generate'), {'customer_id': customer.id}, format='json')

        assert resp.status_code == status.HTTP_201_CREATED
        assert resp.data['status'] == WeeklyNutritionPlan.Status.DRAFT
        assert len(resp.data['days']) == 28

    def test_returns_404_without_trainer_profile(self, api_client, customer):
        plain_trainer = User.objects.create_user(
            email='no-profile@test.com', password='pass', role=User.Role.TRAINER,
        )
        api_client.force_authenticate(user=plain_trainer)

        resp = api_client.post(reverse('nutrition-plan-generate'), {'customer_id': customer.id}, format='json')

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_400_without_customer_id(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-generate'), {}, format='json')

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_404_for_unknown_customer(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-generate'), {'customer_id': 999999}, format='json')

        assert resp.status_code == status.HTTP_404_NOT_FOUND

    def test_returns_409_when_draft_already_exists(self, api_client, customer, trainer):
        _plan(customer, status=WeeklyNutritionPlan.Status.DRAFT)
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-generate'), {'customer_id': customer.id}, format='json')

        assert resp.status_code == status.HTTP_409_CONFLICT

    def test_returns_400_for_bad_week_start_format(self, api_client, customer, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(
            reverse('nutrition-plan-generate'),
            {'customer_id': customer.id, 'week_start': 'not-a-date'}, format='json',
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
class TestNutritionPlanDetail:
    def test_returns_full_plan_with_days(self, api_client, customer, trainer):
        plan = _plan(customer)
        _meal_for(plan)
        api_client.force_authenticate(user=trainer)

        resp = api_client.get(reverse('nutrition-plan-detail', args=[plan.id]))

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data['id'] == plan.id
        assert len(resp.data['days']) == 1

    def test_returns_404_for_unknown_plan(self, api_client, trainer):
        api_client.force_authenticate(user=trainer)

        resp = api_client.get(reverse('nutrition-plan-detail', args=[999999]))

        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestApproveNutritionPlan:
    def test_publishes_draft_and_sets_approved_at(self, api_client, customer, trainer):
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.DRAFT)
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-approve', args=[plan.id]), {}, format='json')

        assert resp.status_code == status.HTTP_200_OK
        plan.refresh_from_db()
        assert plan.status == WeeklyNutritionPlan.Status.PUBLISHED
        assert plan.approved_at is not None

    def test_persists_trainer_notes(self, api_client, customer, trainer):
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.DRAFT)
        api_client.force_authenticate(user=trainer)

        api_client.post(reverse('nutrition-plan-approve', args=[plan.id]), {'trainer_notes': 'Bien'}, format='json')

        plan.refresh_from_db()
        assert plan.trainer_notes == 'Bien'

    def test_returns_404_for_non_draft_plan(self, api_client, customer, trainer):
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.PUBLISHED)
        api_client.force_authenticate(user=trainer)

        resp = api_client.post(reverse('nutrition-plan-approve', args=[plan.id]), {}, format='json')

        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestDeleteNutritionPlan:
    def test_deletes_draft_plan(self, api_client, customer, trainer):
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.DRAFT)
        api_client.force_authenticate(user=trainer)

        resp = api_client.delete(reverse('nutrition-plan-delete', args=[plan.id]))

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not WeeklyNutritionPlan.objects.filter(pk=plan.id).exists()

    def test_deletes_published_plan_for_relaunch(self, api_client, customer, trainer):
        # El trainer puede borrar un plan publicado para relanzarlo desde cero.
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.PUBLISHED)
        api_client.force_authenticate(user=trainer)

        resp = api_client.delete(reverse('nutrition-plan-delete', args=[plan.id]))

        assert resp.status_code == status.HTTP_204_NO_CONTENT
        assert not WeeklyNutritionPlan.objects.filter(pk=plan.id).exists()


@pytest.mark.django_db
class TestEditPlanMeal:
    def test_swaps_suggestion_for_meal(self, api_client, customer, trainer):
        plan = _plan(customer)
        meal = _meal_for(plan)
        suggestion = _suggestion(title='Nueva')
        api_client.force_authenticate(user=trainer)

        resp = api_client.patch(
            reverse('nutrition-plan-edit-meal', args=[plan.id, meal.plan_day.id, meal.id]),
            {'suggestion_id': suggestion.id}, format='json',
        )

        assert resp.status_code == status.HTTP_200_OK
        meal.refresh_from_db()
        assert meal.suggestion_id == suggestion.id

    def test_clears_suggestion_when_null(self, api_client, customer, trainer):
        plan = _plan(customer)
        meal = _meal_for(plan)
        meal.suggestion = _suggestion(title='Vieja')
        meal.save(update_fields=['suggestion'])
        api_client.force_authenticate(user=trainer)

        api_client.patch(
            reverse('nutrition-plan-edit-meal', args=[plan.id, meal.plan_day.id, meal.id]),
            {'suggestion_id': None}, format='json',
        )

        meal.refresh_from_db()
        assert meal.suggestion is None

    def test_updates_trainer_notes(self, api_client, customer, trainer):
        plan = _plan(customer)
        meal = _meal_for(plan)
        api_client.force_authenticate(user=trainer)

        api_client.patch(
            reverse('nutrition-plan-edit-meal', args=[plan.id, meal.plan_day.id, meal.id]),
            {'trainer_notes': 'Sin lactosa'}, format='json',
        )

        meal.refresh_from_db()
        assert meal.trainer_notes == 'Sin lactosa'

    def test_returns_400_when_plan_is_completed(self, api_client, customer, trainer):
        plan = _plan(customer, status=WeeklyNutritionPlan.Status.COMPLETED)
        meal = _meal_for(plan)
        api_client.force_authenticate(user=trainer)

        resp = api_client.patch(
            reverse('nutrition-plan-edit-meal', args=[plan.id, meal.plan_day.id, meal.id]),
            {'trainer_notes': 'X'}, format='json',
        )

        assert resp.status_code == status.HTTP_400_BAD_REQUEST

    def test_returns_404_for_unknown_suggestion(self, api_client, customer, trainer):
        plan = _plan(customer)
        meal = _meal_for(plan)
        api_client.force_authenticate(user=trainer)

        resp = api_client.patch(
            reverse('nutrition-plan-edit-meal', args=[plan.id, meal.plan_day.id, meal.id]),
            {'suggestion_id': 999999}, format='json',
        )

        assert resp.status_code == status.HTTP_404_NOT_FOUND


@pytest.mark.django_db
class TestCustomerNutritionPlanWeek:
    def test_returns_published_plan_covering_today(self, api_client, customer):
        today = date.today()
        WeeklyNutritionPlan.objects.create(
            customer=customer, goal='general_health', fitness_level=2,
            week_start=today - timedelta(days=3), week_end=today + timedelta(days=24),
            status=WeeklyNutritionPlan.Status.PUBLISHED,
        )
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('my-nutrition-plan'))

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data is not None
        assert resp.data['status'] == WeeklyNutritionPlan.Status.PUBLISHED

    def test_returns_null_when_no_active_plan(self, api_client, customer):
        api_client.force_authenticate(user=customer)

        resp = api_client.get(reverse('my-nutrition-plan'))

        assert resp.status_code == status.HTTP_200_OK
        assert resp.data is None
