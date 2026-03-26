# -*- coding: utf-8 -*-
"""Nutrition habits model for the KÓRE diagnostic engine.

Stores self-reported dietary habit data submitted by the client and
auto-computes a composite Habit Score (0–10) on save.

Scientific basis:
- OMS (2020). Healthy diet fact sheet. WHO.
- Monteiro CA et al. (2019). Ultra-processed foods — NOVA classification.
- ISSN (2017). Position stand: protein and exercise. JISSN, 14:20.
- EFSA (2010). Scientific Opinion on dietary reference values for water.
- Cahill LE et al. (2013). Breakfast eating and coronary heart disease. Circulation.
- AHA (2020). Dietary sugars intake and cardiovascular health.
"""

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class NutritionHabit(TimestampedModel):
    """A single nutrition habits entry submitted by a client."""

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='nutrition_habits',
        limit_choices_to={'role': 'customer'},
    )

    # ── Raw habit data (client-submitted) ──
    meals_per_day = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Número de comidas al día.',
    )
    water_liters = models.DecimalField(
        max_digits=3, decimal_places=1,
        validators=[MinValueValidator(0), MaxValueValidator(10)],
        help_text='Litros de agua al día.',
    )
    fruit_weekly = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(35)],
        help_text='Frecuencia semanal de consumo de frutas.',
    )
    vegetable_weekly = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(35)],
        help_text='Frecuencia semanal de consumo de verduras.',
    )
    protein_frequency = models.PositiveSmallIntegerField(
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Frecuencia de proteína (1=nunca, 5=diario en cada comida).',
    )
    ultraprocessed_weekly = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(35)],
        help_text='Frecuencia semanal de ultraprocesados.',
    )
    sugary_drinks_weekly = models.PositiveSmallIntegerField(
        validators=[MaxValueValidator(35)],
        help_text='Frecuencia semanal de bebidas azucaradas.',
    )
    eats_breakfast = models.BooleanField(
        help_text='¿Desayuna regularmente?',
    )

    notes = models.TextField(blank=True)

    # ── Computed fields ──
    habit_score = models.DecimalField(
        max_digits=4, decimal_places=2, null=True, blank=True,
    )
    habit_category = models.CharField(max_length=30, blank=True)
    habit_color = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Nutrición #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        self._compute_score()
        super().save(*args, **kwargs)

    def _compute_score(self):
        from core_app.services.nutrition_calculator import compute_all

        results = compute_all(
            meals_per_day=self.meals_per_day,
            water_liters=self.water_liters,
            fruit_weekly=self.fruit_weekly,
            vegetable_weekly=self.vegetable_weekly,
            protein_frequency=self.protein_frequency,
            ultraprocessed_weekly=self.ultraprocessed_weekly,
            sugary_drinks_weekly=self.sugary_drinks_weekly,
            eats_breakfast=self.eats_breakfast,
        )

        for field, value in results.items():
            setattr(self, field, value)
