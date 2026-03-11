"""Anthropometry evaluation model for the KÓRE diagnostic engine.

Stores raw measurements in two JSON fields (perimeters and skinfolds)
plus basic required fields.  All computed indices are auto-calculated
on save.
"""

from datetime import date

from django.conf import settings
from django.core.validators import MinValueValidator, MaxValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class AnthropometryEvaluation(TimestampedModel):
    """A single anthropometric evaluation of a client by a trainer.

    Raw perimeter and skinfold measurements are stored in JSONFields
    keyed like ``brazo_relajado_d``, ``triceps_i``, ``pecho``, etc.
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

    # ── Required basic measurements ──
    weight_kg = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(300)],
    )
    height_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(100), MaxValueValidator(250)],
    )
    waist_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(200)],
    )
    hip_cm = models.DecimalField(
        max_digits=5, decimal_places=1,
        validators=[MinValueValidator(20), MaxValueValidator(200)],
        help_text='Glúteos / cadera.',
    )

    # ── Detailed measurements (JSON) ──
    perimeters = models.JSONField(
        default=dict, blank=True,
        help_text='Perímetros en cm. Keys: brazo_relajado_d/i, brazo_flexionado_d/i, antebrazo_d/i, muneca_d/i, pecho, cintura, gluteos, muslo_d/i, pantorrilla_d/i, tobillo_d/i.',
    )
    skinfolds = models.JSONField(
        default=dict, blank=True,
        help_text='Pliegues en mm. Keys: triceps_d/i, biceps_d/i, subescapular_d/i, cresta_iliaca_d/i, supraespinal, abdominal, muslo_d/i, pantorrilla_d/i.',
    )

    notes = models.TextField(blank=True)

    # ── Computed indices ──
    age_at_evaluation = models.PositiveSmallIntegerField(null=True, blank=True)
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
    bf_method = models.CharField(max_length=30, blank=True, help_text='jackson_pollock or deurenberg')

    fat_mass_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)
    lean_mass_kg = models.DecimalField(max_digits=5, decimal_places=1, null=True, blank=True)

    waist_risk = models.CharField(max_length=20, blank=True)
    waist_risk_color = models.CharField(max_length=10, blank=True)

    sum_skinfolds = models.DecimalField(max_digits=6, decimal_places=1, null=True, blank=True)
    asymmetries = models.JSONField(default=dict, blank=True, help_text='Detected bilateral asymmetries >10%.')

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Antropometría #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        self._compute_indices()
        super().save(*args, **kwargs)

    def _compute_indices(self):
        from core_app.services.anthropometry_calculator import compute_all

        cp = getattr(self.customer, 'customer_profile', None)
        sex = cp.sex if cp and cp.sex else 'masculino'
        dob = cp.date_of_birth if cp else None

        if dob:
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        else:
            age = 30

        self.age_at_evaluation = age

        results = compute_all(
            weight_kg=float(self.weight_kg),
            height_cm=float(self.height_cm),
            waist_cm=float(self.waist_cm),
            hip_cm=float(self.hip_cm),
            age=age,
            sex=sex,
            skinfolds=self.skinfolds or {},
        )

        for field, value in results.items():
            setattr(self, field, value)
