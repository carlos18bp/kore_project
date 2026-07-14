from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class SessionRating(TimestampedModel):
    """A 1–5 rating left on an attended booking by one of its two parties.

    The unique constraint is load-bearing: it makes rating idempotent and is what
    stops a customer from farming the `session_rated` credit on one session.
    """

    class RaterRole(models.TextChoices):
        CUSTOMER = 'customer', 'Customer'
        TRAINER = 'trainer', 'Trainer'

    booking = models.ForeignKey(
        'core_app.Booking', on_delete=models.CASCADE, related_name='ratings',
    )
    rater_role = models.CharField(max_length=10, choices=RaterRole.choices, db_index=True)
    score = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
    )
    comment = models.TextField(blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['booking', 'rater_role'], name='uniq_rating_per_booking_role',
            ),
        ]

    def __str__(self):
        return f'Booking {self.booking_id} — {self.rater_role}: {self.score}/5'
