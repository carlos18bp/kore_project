import logging

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
    """Run recompute_risk_score and swallow errors so they never break a save."""
    try:
        from core_app.services.risk_score_service import recompute_risk_score
        recompute_risk_score(customer)
        logger.debug('risk_score: recomputed after %s for customer %s', source, customer.pk)
    except Exception as exc:
        logger.exception(
            'risk_score: recompute failed after %s for customer %s: %s',
            source, customer.pk, exc,
        )


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
