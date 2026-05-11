from django.conf import settings
from django.db import models

from .base import TimestampedModel
from .meal_suggestion import MealSuggestion


class WeeklyNutritionPlan(TimestampedModel):
    """A trainer-curated 7-day meal plan for one customer.

    Generated from the existing meal_suggestion_service rotation, then
    reviewed and published by the trainer before the customer can see it.
    Status flow: draft → published (→ completed when the week ends).
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        COMPLETED = 'completed', 'Completed'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='weekly_nutrition_plans',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='weekly_nutrition_plans',
    )
    goal = models.CharField(max_length=50)
    fitness_level = models.PositiveSmallIntegerField()
    week_start = models.DateField()
    week_end = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    trainer_notes = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-week_start']

    def __str__(self):
        return f'{self.customer} — {self.week_start} (level {self.fitness_level}, {self.status})'


class WeeklyPlanDay(TimestampedModel):
    """One day (1–7, Mon=1) within a WeeklyNutritionPlan."""

    plan = models.ForeignKey(WeeklyNutritionPlan, on_delete=models.CASCADE, related_name='days')
    day_number = models.PositiveSmallIntegerField()
    date = models.DateField()

    class Meta:
        ordering = ['day_number']
        unique_together = [('plan', 'day_number')]

    def __str__(self):
        return f'Day {self.day_number} ({self.date})'


class WeeklyPlanMeal(TimestampedModel):
    """One meal slot within a WeeklyPlanDay (one per meal_block)."""

    plan_day = models.ForeignKey(WeeklyPlanDay, on_delete=models.CASCADE, related_name='meals')
    meal_block = models.CharField(max_length=20, choices=MealSuggestion.MealBlock.choices)
    suggestion = models.ForeignKey(
        MealSuggestion,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='plan_meals',
    )
    order = models.PositiveSmallIntegerField(default=0)
    trainer_notes = models.TextField(blank=True)

    class Meta:
        ordering = ['order']
        unique_together = [('plan_day', 'meal_block')]

    def __str__(self):
        return f'{self.get_meal_block_display()} — {self.suggestion}'
