from django.conf import settings
from django.db import models

from .base import TimestampedModel


class NutritionDailyLog(TimestampedModel):

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nutrition_daily_logs',
    )
    date = models.DateField(db_index=True)
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [('customer', 'date')]

    def __str__(self):
        return f'{self.customer} — {self.date} (nutrition, closed={self.is_closed})'


class MealEntry(TimestampedModel):

    class Status(models.TextChoices):
        COMPLETED = 'completed', 'Completed'
        SKIPPED = 'skipped', 'Skipped'
        NOT_DONE = 'not_done', 'Not Done'

    class MealBlock(models.TextChoices):
        BREAKFAST = 'desayuno', 'Desayuno'
        MID_MORNING = 'media_manana', 'Media mañana'
        LUNCH = 'almuerzo', 'Almuerzo'
        SNACK = 'merienda', 'Merienda'
        DINNER = 'cena', 'Cena'

    daily_log = models.ForeignKey(NutritionDailyLog, on_delete=models.CASCADE, related_name='meal_entries')
    meal_block = models.CharField(max_length=20, choices=MealBlock.choices)
    suggestion = models.ForeignKey(
        'core_app.MealSuggestion',
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='meal_entries',
    )
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_DONE)
    notes = models.TextField(blank=True)
    photo = models.ImageField(
        upload_to='nutrition/%Y/%m/',
        null=True, blank=True,
    )
    trainer_comment = models.TextField(blank=True)
    trainer_comment_at = models.DateTimeField(null=True, blank=True)
    flagged_for_session = models.BooleanField(default=False, db_index=True)

    class Meta:
        unique_together = [('daily_log', 'meal_block')]

    def __str__(self):
        return f'{self.get_meal_block_display()} — {self.status}'
