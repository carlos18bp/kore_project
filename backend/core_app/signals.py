import logging

from django.db import transaction
from django.db.models.signals import post_save
from django.dispatch import receiver

from core_app.models.user import User

logger = logging.getLogger(__name__)


@receiver(post_save, sender=User)
def create_customer_profile(sender, instance, created, **kwargs):
    """Auto-create a CustomerProfile when a customer user is created."""
    if created and instance.role == User.Role.CUSTOMER:
        from core_app.models.customer_profile import CustomerProfile
        CustomerProfile.objects.get_or_create(user=instance)


# ── Reactive risk-score recompute on evaluation saves ───────────────────────
#
# Clinical signals depend entirely on evaluation data (anthropometry,
# posturometry, physical fitness, PAR-Q, nutrition habits).  When a trainer
# saves any of these, the stored ClientRiskScore should reflect the new data
# immediately — not wait until the 06:00 batch.
#
# Behavioral signals (adherence, inactivity) are NOT recomputed here; they
# depend on completed DailyLog records and are best measured at end-of-day.
# The daily batch at 06:00 handles those.

def _recompute_for_customer(customer, source: str) -> None:
    """Enqueue a background risk-score recompute once the current transaction commits.

    The recompute is deliberately kept OFF the request path: its behavioral/clinical
    signal engines run several ORM queries over the customer's history, and running
    them inline blocked the HTTP response long enough that evaluation saves appeared
    to hang in the trainer UI. ``transaction.on_commit`` guarantees the worker sees
    the just-saved row (and that nothing is enqueued if the save rolls back).
    Errors are swallowed so they can never break the triggering save.
    """
    customer_id = customer.pk

    def _enqueue():
        try:
            from core_app.tasks import recompute_risk_score_task
            recompute_risk_score_task(customer_id)
            logger.debug('risk_score: enqueued recompute after %s for customer %s', source, customer_id)
        except Exception as exc:
            logger.exception(
                'risk_score: failed to enqueue recompute after %s for customer %s: %s',
                source, customer_id, exc,
            )

    transaction.on_commit(_enqueue)


@receiver(post_save, sender='core_app.AnthropometryEvaluation')
def on_anthropometry_save(sender, instance, **kwargs):
    _recompute_for_customer(instance.customer, 'AnthropometryEvaluation')


@receiver(post_save, sender='core_app.PosturometryEvaluation')
def on_posturometry_save(sender, instance, **kwargs):
    _recompute_for_customer(instance.customer, 'PosturometryEvaluation')


@receiver(post_save, sender='core_app.PhysicalEvaluation')
def on_physical_evaluation_save(sender, instance, **kwargs):
    _recompute_for_customer(instance.customer, 'PhysicalEvaluation')


@receiver(post_save, sender='core_app.ParqAssessment')
def on_parq_save(sender, instance, **kwargs):
    _recompute_for_customer(instance.customer, 'ParqAssessment')


@receiver(post_save, sender='core_app.NutritionHabit')
def on_nutrition_habit_save(sender, instance, **kwargs):
    _recompute_for_customer(instance.customer, 'NutritionHabit')


@receiver(post_save, sender='core_app.WeeklyNutritionPlan')
def on_nutrition_plan_save(sender, instance, **kwargs):
    # Only recompute when the plan is published — drafts don't affect clinical risk
    from core_app.models.weekly_nutrition_plan import WeeklyNutritionPlan
    if instance.status == WeeklyNutritionPlan.Status.PUBLISHED:
        _recompute_for_customer(instance.customer, 'WeeklyNutritionPlan.publish')


# ── Credit engine event hooks (Phase 2) ─────────────────────────────────────
#
# Same pattern as the risk-score recompute: enqueue AFTER the commit so the
# worker sees the saved row, and swallow enqueue errors so credits can never
# break the user's save. Rules live in services/credit_engine.handle_event.

def _enqueue_credit_event(kind: str, object_id: int) -> None:
    def _enqueue():
        try:
            from core_app.tasks import process_credit_event
            process_credit_event(kind, object_id)
        except Exception as exc:
            logger.exception('credits: failed to enqueue %s for %s: %s', kind, object_id, exc)

    transaction.on_commit(_enqueue)


@receiver(post_save, sender='core_app.MoodEntry')
def on_mood_entry_credit(sender, instance, created, **kwargs):
    if created:
        _enqueue_credit_event('checkin', instance.pk)


@receiver(post_save, sender='core_app.WaterGlassLog')
def on_water_glass_credit(sender, instance, created, **kwargs):
    if created:
        _enqueue_credit_event('water_glass', instance.pk)


@receiver(post_save, sender='core_app.MealEntry')
def on_meal_entry_credit(sender, instance, **kwargs):
    if instance.status == 'completed' and instance.photo:
        _enqueue_credit_event('meal_photo', instance.pk)


@receiver(post_save, sender='core_app.PhysicalTest')
def on_physical_test_credit(sender, instance, **kwargs):
    if instance.result == 'passed':
        _enqueue_credit_event('physical_test', instance.pk)
