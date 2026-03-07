from django.conf import settings
from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class MoodEntry(TimestampedModel):
    """Daily mood log for a user.

    Each user can record one mood per day. The full history is persisted
    for trainer review and analytics (implemented later).
    """

    class Mood(models.TextChoices):
        MOTIVATED = 'motivated', 'Motivado'
        NEUTRAL = 'neutral', 'Neutral'
        TIRED = 'tired', 'Cansado / Desmotivado'

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='mood_entries',
    )
    mood = models.CharField(max_length=20, choices=Mood.choices)
    date = models.DateField(default=timezone.localdate)

    class Meta:
        ordering = ('-date',)
        unique_together = ('user', 'date')
        verbose_name_plural = 'mood entries'

    def __str__(self):
        return f"{self.user.email} — {self.mood} ({self.date})"
