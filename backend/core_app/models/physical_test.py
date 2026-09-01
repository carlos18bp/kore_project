from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class PhysicalTest(TimestampedModel):
    """Biweekly trainer-administered physical test.

    A passed test is the human-verified source of training credits
    (see credits engine spec). Cadence is operational, not enforced.
    """

    class Result(models.TextChoices):
        PASSED = 'passed', 'Passed'
        FAILED = 'failed', 'Failed'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='physical_tests',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='physical_tests',
    )
    performed_at = models.DateField(db_index=True)
    result = models.CharField(max_length=10, choices=Result.choices)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ('-performed_at',)

    def __str__(self):
        return f'{self.customer} — {self.result} ({self.performed_at})'
