from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class ClientRiskScore(TimestampedModel):
    class Level(models.TextChoices):
        ALTO = 'alto', 'Alto'
        MEDIO = 'medio', 'Medio'
        BAJO = 'bajo', 'Bajo'
        SIN_RIESGO = 'sin_riesgo', 'Sin riesgo'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='risk_scores',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='client_risk_scores',
    )
    computed_at = models.DateTimeField(auto_now_add=True, db_index=True)
    level = models.CharField(
        max_length=20,
        choices=Level.choices,
        default=Level.SIN_RIESGO,
        db_index=True,
    )
    kore_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    behavioral_signals = models.JSONField(default=list)
    clinical_signals = models.JSONField(default=list)
    is_stale = models.BooleanField(default=False, db_index=True)

    class Meta:
        ordering = ['-computed_at']
        indexes = [
            models.Index(fields=['customer', 'trainer', 'is_stale']),
        ]

    def __str__(self):
        return f'{self.customer} — {self.level} ({self.computed_at})'
