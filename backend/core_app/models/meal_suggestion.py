from django.db import models

from .base import TimestampedModel


class MealSuggestion(TimestampedModel):

    class MealBlock(models.TextChoices):
        BREAKFAST = 'desayuno', 'Desayuno'
        MID_MORNING = 'media_manana', 'Media mañana'
        LUNCH = 'almuerzo', 'Almuerzo'
        SNACK = 'merienda', 'Merienda'
        DINNER = 'cena', 'Cena'

    title = models.CharField(max_length=200)
    meal_block = models.CharField(max_length=20, choices=MealBlock.choices)
    description = models.TextField(blank=True)
    foods = models.ManyToManyField('core_app.Food', blank=True, related_name='meal_suggestions')
    calories_estimate = models.PositiveSmallIntegerField()
    goal_tags = models.JSONField(default=list, help_text='e.g. ["fat_loss", "muscle_gain", "general_health"]')
    fitness_level_min = models.PositiveSmallIntegerField(default=1)
    fitness_level_max = models.PositiveSmallIntegerField(default=5)
    nova_max = models.PositiveSmallIntegerField(default=2, help_text='Max NOVA group allowed in this suggestion')
    is_active = models.BooleanField(default=True)

    class Meta:
        indexes = [
            models.Index(fields=['meal_block', 'is_active']),
        ]

    def __str__(self):
        return f'{self.get_meal_block_display()}: {self.title}'
