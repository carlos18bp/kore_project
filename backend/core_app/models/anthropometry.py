"""Anthropometry evaluation model for the KÓRE diagnostic engine."""

from datetime import date

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class AnthropometryEvaluation(TimestampedModel):
    """A single anthropometric evaluation of a client by a trainer.

    Stores raw measurements and auto-calculated indices (IMC, ICC, ICE,
    % grasa, masa grasa/libre, riesgo abdominal).  All computed fields
    are populated on save via the calculator service.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='anthropometry_evaluations',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        related_name='anthropometry_evaluations',
        null=True,
        blank=True,
    )

    # ── Raw measurements (required) ──
    weight_kg = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(300)],
        help_text='Peso en kilogramos.',
    )
    height_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(100), MaxValueValidator(250)],
        help_text='Estatura en centímetros.',
    )
    waist_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(200)],
        help_text='Perímetro de cintura en centímetros.',
    )
    hip_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(200)],
        help_text='Perímetro de cadera en centímetros.',
    )

    # ── Raw measurements (optional) ──
    chest_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    abdomen_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    arm_relaxed_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    arm_flexed_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    thigh_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    calf_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    neck_cm = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    notes = models.TextField(blank=True, help_text='Observaciones del entrenador.')

    # ── Computed indices (auto-populated on save) ──
    age_at_evaluation = models.PositiveSmallIntegerField(
        null=True, blank=True,
        help_text='Age at the time of evaluation.',
    )
    bmi = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    bmi_category = models.CharField(max_length=30, blank=True)
    bmi_color = models.CharField(max_length=10, blank=True)

    waist_hip_ratio = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    whr_risk = models.CharField(max_length=20, blank=True)
    whr_color = models.CharField(max_length=10, blank=True)

    waist_height_ratio = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    whe_risk = models.CharField(max_length=20, blank=True)
    whe_color = models.CharField(max_length=10, blank=True)

    body_fat_pct = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    bf_category = models.CharField(max_length=20, blank=True)
    bf_color = models.CharField(max_length=10, blank=True)

    fat_mass_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    lean_mass_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    waist_risk = models.CharField(max_length=20, blank=True)
    waist_risk_color = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Antropometría #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        self._compute_indices()
        super().save(*args, **kwargs)

    def _compute_indices(self):
        """Run all anthropometry calculations and populate computed fields."""
        from core_app.services.anthropometry_calculator import compute_all

        cp = getattr(self.customer, 'customer_profile', None)
        sex = cp.sex if cp and cp.sex else 'masculino'
        dob = cp.date_of_birth if cp else None

        if dob:
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        else:
            age = 30  # fallback

        self.age_at_evaluation = age

        results = compute_all(
            weight_kg=float(self.weight_kg),
            height_cm=float(self.height_cm),
            waist_cm=float(self.waist_cm),
            hip_cm=float(self.hip_cm),
            age=age,
            sex=sex,
        )

        for field, value in results.items():
            setattr(self, field, value)
