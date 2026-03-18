from django.conf import settings
from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class MoodEntry(TimestampedModel):
    """Daily mood log for a user.

    Each user can record one mood per day on a 1-10 scale.
    The full history is persisted for trainer review and analytics.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mood_entries',
    )
    score = models.PositiveSmallIntegerField(
        help_text='Mood score from 1 (worst) to 10 (best).',
    )
    notes = models.TextField(
        blank=True,
        help_text='Optional notes about how the user feels.',
    )
    date = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ('-date',)
        unique_together = ('user', 'date')
        verbose_name_plural = 'mood entries'

    def __str__(self):
        return f"{self.user.email} — {self.score}/10 ({self.date})"
