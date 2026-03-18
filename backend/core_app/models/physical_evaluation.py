"""Physical evaluation model for the KÓRE diagnostic engine.

Stores raw physical test results (squats, pushups, plank, walk, unipodal,
mobility) and auto-computes individual scores (1–5) and composite indices
on save, using age- and sex-stratified baremos.  Optionally integrates
context from the client's latest anthropometry and posturometry evaluations.

Scientific basis:
- ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.
- Rikli & Jones (2001). Senior Fitness Test Manual.
- CSEP (2003). Canadian Physical Activity, Fitness & Lifestyle Approach.
- McGill (2015). Low Back Disorders, 3rd ed.
- ATS (2002). Am J Respir Crit Care Med, 166:111-117.
- Enright & Sherrill (1998). 6MWT reference equations.
- Springer et al. (2007). J Geriatr Phys Ther.
- Heyward & Gibson (2014). Advanced Fitness Assessment, 7th ed.
"""

from datetime import date

from django.conf import settings
from django.core.validators import MaxValueValidator, MinValueValidator
from django.db import models

from core_app.models.base import TimestampedModel


class PhysicalEvaluation(TimestampedModel):
    """A single physical evaluation of a client by a trainer."""

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='physical_evaluations',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        related_name='physical_evaluations',
        null=True,
        blank=True,
    )

    evaluation_date = models.DateField(
        null=True, blank=True,
        help_text='Fecha real del examen. Si no se indica, se usa la fecha de creación.',
    )

    # ── Snapshot of client demographics at evaluation time ──
    age_at_evaluation = models.PositiveSmallIntegerField(null=True, blank=True)
    sex_at_evaluation = models.CharField(max_length=20, blank=True)

    # ── Raw test results ──
    squats_reps = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(200)],
        help_text='Sentadillas correctas en 1 minuto.',
    )
    pushups_reps = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(200)],
        help_text='Flexiones correctas.',
    )
    plank_seconds = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(600)],
        help_text='Tiempo máximo de plancha en segundos.',
    )
    walk_meters = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(2000)],
        help_text='Distancia recorrida en caminata de 6 minutos (metros).',
    )
    unipodal_seconds = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(300)],
        help_text='Tiempo máximo de apoyo unipodal en segundos.',
    )
    hip_mobility = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Movilidad de cadera (1–5).',
    )
    shoulder_mobility = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Movilidad de hombros (1–5).',
    )
    ankle_mobility = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(5)],
        help_text='Movilidad de tobillo (1–5).',
    )

    # ── Observation / flags per test ──
    squats_notes = models.TextField(blank=True)
    squats_pain = models.BooleanField(default=False)
    squats_interrupted = models.BooleanField(default=False)

    pushups_notes = models.TextField(blank=True)
    pushups_pain = models.BooleanField(default=False)

    plank_notes = models.TextField(blank=True)
    plank_pain = models.BooleanField(default=False)

    walk_notes = models.TextField(blank=True)
    walk_effort_perception = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MinValueValidator(1), MaxValueValidator(10)],
        help_text='Percepción de esfuerzo (Borg 1–10).',
    )
    walk_heart_rate = models.PositiveSmallIntegerField(
        null=True, blank=True,
        validators=[MaxValueValidator(250)],
        help_text='Frecuencia cardiaca al finalizar.',
    )

    unipodal_notes = models.TextField(blank=True)
    mobility_notes = models.TextField(blank=True)

    notes = models.TextField(blank=True)
    recommendations = models.JSONField(
        default=dict, blank=True,
        help_text='Trainer-editable recommendations per index: {general: {result, action}, ...}.',
    )

    # ── Computed individual scores (1–5) ──
    squats_score = models.PositiveSmallIntegerField(null=True, blank=True)
    pushups_score = models.PositiveSmallIntegerField(null=True, blank=True)
    plank_score = models.PositiveSmallIntegerField(null=True, blank=True)
    walk_score = models.PositiveSmallIntegerField(null=True, blank=True)
    unipodal_score = models.PositiveSmallIntegerField(null=True, blank=True)

    # ── Composite indices ──
    strength_index = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    strength_category = models.CharField(max_length=30, blank=True)
    strength_color = models.CharField(max_length=10, blank=True)

    endurance_index = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    endurance_category = models.CharField(max_length=30, blank=True)
    endurance_color = models.CharField(max_length=10, blank=True)

    mobility_index = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    mobility_category = models.CharField(max_length=30, blank=True)
    mobility_color = models.CharField(max_length=10, blank=True)

    balance_index = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    balance_category = models.CharField(max_length=30, blank=True)
    balance_color = models.CharField(max_length=10, blank=True)

    general_index = models.DecimalField(max_digits=3, decimal_places=2, null=True, blank=True)
    general_category = models.CharField(max_length=30, blank=True)
    general_color = models.CharField(max_length=10, blank=True)

    # ── Cross-module integration ──
    cross_module_alerts = models.JSONField(
        default=dict, blank=True,
        help_text='Contextual alerts from anthropometry/posturometry: {test_key: [msg, ...]}.',
    )

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Evaluación física #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        if not self.evaluation_date:
            self.evaluation_date = date.today()
        self._snapshot_demographics()
        self._compute_indices()
        self._fill_default_recommendations()
        super().save(*args, **kwargs)

    def _snapshot_demographics(self):
        cp = getattr(self.customer, 'customer_profile', None)
        sex = cp.sex if cp and cp.sex else 'masculino'
        dob = cp.date_of_birth if cp else None

        if dob:
            today = date.today()
            age = today.year - dob.year - ((today.month, today.day) < (dob.month, dob.day))
        else:
            age = 30

        self.age_at_evaluation = age
        self.sex_at_evaluation = sex

    def _get_anthropometry_context(self):
        from core_app.models.anthropometry import AnthropometryEvaluation
        latest = AnthropometryEvaluation.objects.filter(
            customer=self.customer,
        ).order_by('-created_at').first()
        if not latest:
            return None
        return {
            'bmi': float(latest.bmi) if latest.bmi else None,
            'bmi_color': latest.bmi_color or '',
            'bf_color': latest.bf_color or '',
            'waist_risk_color': latest.waist_risk_color or '',
        }

    def _get_posturometry_context(self):
        from core_app.models.posturometry import PosturometryEvaluation
        latest = PosturometryEvaluation.objects.filter(
            customer=self.customer,
        ).order_by('-created_at').first()
        if not latest:
            return None
        return {
            'lower_color': latest.lower_color or '',
            'central_color': latest.central_color or '',
            'upper_color': latest.upper_color or '',
            'findings': latest.findings or {},
        }

    def _compute_indices(self):
        from core_app.services.physical_evaluation_calculator import compute_all

        results = compute_all(
            age=self.age_at_evaluation,
            sex=self.sex_at_evaluation,
            squats_reps=self.squats_reps,
            pushups_reps=self.pushups_reps,
            plank_seconds=self.plank_seconds,
            walk_meters=self.walk_meters,
            unipodal_seconds=self.unipodal_seconds,
            hip_mobility=self.hip_mobility,
            shoulder_mobility=self.shoulder_mobility,
            ankle_mobility=self.ankle_mobility,
            anthropometry_context=self._get_anthropometry_context(),
            posturometry_context=self._get_posturometry_context(),
        )

        for field, value in results.items():
            setattr(self, field, value)

    def _fill_default_recommendations(self):
        if self.recommendations:
            return
        from core_app.services.physical_evaluation_calculator import generate_default_recommendations
        self.recommendations = generate_default_recommendations(self)
