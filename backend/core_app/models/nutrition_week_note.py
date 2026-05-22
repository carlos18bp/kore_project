from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionWeekNote(TimestampedModel):
    """Nota semanal de nutrición (semana 1–4) dentro de un ciclo sintético.

    Nutrición no tiene un modelo de ciclo de 28 días, así que el ciclo se
    identifica con un entero ``cycle_number`` por cliente.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nutrition_week_notes',
        limit_choices_to={'role': 'customer'},
    )
    cycle_number = models.PositiveSmallIntegerField()  # ≥ 1, por cliente
    cycle_start = models.DateField()
    week_number = models.PositiveSmallIntegerField()  # 1–4
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['-cycle_number', 'week_number']
        unique_together = [('customer', 'cycle_number', 'week_number')]

    def __str__(self):
        return f'{self.customer} — ciclo {self.cycle_number} semana {self.week_number}'
