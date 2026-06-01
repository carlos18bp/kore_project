from django.db import models

from core_app.models.base import TimestampedModel
from core_app.models.monthly_program import MonthlyProgram


class ProgramWeekNote(TimestampedModel):
    """Nota semanal del entrenador (semana 1–4) dentro de un MonthlyProgram de 28 días."""

    program = models.ForeignKey(
        MonthlyProgram,
        on_delete=models.CASCADE,
        related_name='week_notes',
    )
    week_number = models.PositiveSmallIntegerField()  # 1–4
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['week_number']
        unique_together = [('program', 'week_number')]

    def __str__(self):
        return f'{self.program} — semana {self.week_number}'
