from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class Exercise(TimestampedModel):
    """Exercise catalog entry imported from the Tier-2 catalog.

    fitness_level_min (1-5) is auto-assigned during import based on Type and
    Main Implement, matching the 1-5 scale of PhysicalEvaluation.general_index.
    """

    name = models.CharField(max_length=200, unique=True)
    pattern = models.CharField(max_length=100, blank=True)
    exercise_type = models.CharField(max_length=100, blank=True)
    main_implement = models.CharField(max_length=100, blank=True)
    primary_muscles = models.CharField(max_length=255, blank=True)
    secondary_muscles = models.CharField(max_length=255, blank=True)
    plane = models.CharField(max_length=50, blank=True)
    explanation = models.TextField(blank=True)
    youtube_url = models.URLField(blank=True)

    fitness_level_min = models.PositiveSmallIntegerField(
        default=1,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        db_index=True,
    )
    is_corrective = models.BooleanField(default=False, db_index=True)
    goal_tags = models.JSONField(default=list)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ['name']

    def __str__(self):
        return f'{self.name} (level {self.fitness_level_min})'
