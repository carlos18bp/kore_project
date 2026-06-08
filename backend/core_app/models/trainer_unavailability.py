from django.db import models

from core_app.models.base import TimestampedModel


class TrainerUnavailability(TimestampedModel):
    """Whole-day block that prevents new bookings on a given date.

    Existing bookings on the blocked date are NOT touched — the block only
    stops customers (and trainers acting on their behalf) from picking that
    day going forward.  Treated by the slot-availability algorithm as if
    every business-hour slot on that date were already taken.
    """

    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='unavailable_dates',
    )
    date = models.DateField(
        help_text='Local Bogota date (YYYY-MM-DD) on which no new bookings are allowed.',
    )
    reason = models.CharField(max_length=255, blank=True)

    class Meta:
        constraints = [
            models.UniqueConstraint(
                fields=('trainer', 'date'),
                name='uniq_trainer_unavailability_date',
            ),
        ]
        indexes = [models.Index(fields=('trainer', 'date'))]
        ordering = ('-date',)

    def __str__(self):
        return f'{self.trainer_id} blocked on {self.date}'
