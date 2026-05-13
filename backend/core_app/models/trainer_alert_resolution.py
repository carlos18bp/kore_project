from django.db import models

from core_app.models.base import TimestampedModel


class TrainerAlertResolution(TimestampedModel):
    class ResolutionType(models.TextChoices):
        PRIVATE_NOTE = 'private_note', 'Nota privada'
        PUBLIC_NOTE = 'public_note', 'Nota pública'
        SCHEDULE_EVAL = 'schedule_eval', 'Agendar evaluación'
        MARK_REVIEWED = 'mark_reviewed', 'Marcar revisado'
        GO_TO_MODULE = 'go_to_module', 'Ir al módulo'

    risk_score = models.ForeignKey(
        'core_app.ClientRiskScore',
        on_delete=models.CASCADE,
        related_name='resolutions',
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='alert_resolutions',
    )
    signal_type = models.CharField(max_length=50)
    resolution_type = models.CharField(max_length=30, choices=ResolutionType.choices)
    note = models.TextField()
    is_public = models.BooleanField(default=False)
    resolved_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-resolved_at']

    def __str__(self):
        return f'{self.signal_type} → {self.resolution_type}'
