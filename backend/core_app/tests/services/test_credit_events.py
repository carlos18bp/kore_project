import pytest
from django.utils import timezone

from core_app.models import MealEntry, MoodEntry, NutritionDailyLog, WaterGlassLog
from core_app.models.credit import CreditTransaction
from core_app.models.physical_test import PhysicalTest
from core_app.services import credit_engine


@pytest.mark.django_db
def test_checkin_event_awards_once(existing_user):
    entry = MoodEntry.objects.create(user=existing_user, score=8)
    credit_engine.handle_event('checkin', entry.pk)
    credit_engine.handle_event('checkin', entry.pk)  # idempotent
    assert credit_engine.get_wallet(existing_user).balance == 5


@pytest.mark.django_db
def test_water_goal_awards_when_goal_reached(existing_user):
    log = NutritionDailyLog.objects.create(customer=existing_user, date=timezone.localdate())
    settings_obj = credit_engine.get_settings()
    settings_obj.water_goal_glasses = 2
    settings_obj.save(update_fields=['water_goal_glasses'])

    g1 = WaterGlassLog.objects.create(daily_log=log, photo='nutrition/water/x.jpg')
    credit_engine.handle_event('water_glass', g1.pk)
    assert credit_engine.get_wallet(existing_user).balance == 0  # below goal

    g2 = WaterGlassLog.objects.create(daily_log=log, photo='nutrition/water/y.jpg')
    credit_engine.handle_event('water_glass', g2.pk)
    assert credit_engine.get_wallet(existing_user).balance == 10


@pytest.mark.django_db
def test_meal_with_photo_creates_pending_transaction(existing_user):
    log = NutritionDailyLog.objects.create(customer=existing_user, date=timezone.localdate())
    meal = MealEntry.objects.create(
        daily_log=log, meal_block=MealEntry.MealBlock.LUNCH,
        status=MealEntry.Status.COMPLETED, photo='nutrition/x.jpg',
    )
    credit_engine.handle_event('meal_photo', meal.pk)
    tx = CreditTransaction.objects.get(reference_type='meal_entry', reference_id=str(meal.pk))
    assert tx.status == CreditTransaction.Status.PENDING
    assert tx.review_deadline is not None
    assert credit_engine.get_wallet(existing_user).balance == 0


@pytest.mark.django_db
def test_passed_physical_test_awards(existing_user):
    test = PhysicalTest.objects.create(
        customer=existing_user, performed_at=timezone.localdate(),
        result=PhysicalTest.Result.PASSED,
    )
    credit_engine.handle_event('physical_test', test.pk)
    assert credit_engine.get_wallet(existing_user).balance == 100
