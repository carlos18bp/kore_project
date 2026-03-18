"""Posturometry evaluation model for the KÓRE diagnostic engine.

Stores raw postural observations across 4 views (anterior, lateral right,
lateral left, posterior) in JSON fields plus optional photos per view.
All computed indices are auto-calculated on save.

Scientific basis:
- Kendall, F.P. et al. (2005). Muscles: Testing and Function with Posture and Pain. 5th ed.
- REEDCO Posture Score (1974). 10-segment scale, inter-rater α=0.899–0.915.
- New York Posture Rating Chart (1958; Howley & Frank, 1992). 13-segment scale.
- PAS/SAPO — Ferreira et al. (2010). Clinics, 65(7).
- Magee, D.J. (2014). Orthopedic Physical Assessment. 6th ed.
- Janda, V. (1996). Upper/lower crossed syndromes — regional grouping basis.
"""

from datetime import date

from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


def posturometry_photo_path(instance, filename):
    """Upload path: posturometry/<customer_id>/<eval_id_or_new>/<filename>."""
    customer_id = instance.customer_id or 'unknown'
    return f'posturometry/{customer_id}/{filename}'


class PosturometryEvaluation(TimestampedModel):
    """A single postural evaluation of a client by a trainer.

    Raw observations are stored per view in JSONFields keyed by segment name.
    Each segment entry: {is_normal: bool, severity: 0-3, sub_fields: {...}}.
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='posturometry_evaluations',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        related_name='posturometry_evaluations',
        null=True,
        blank=True,
    )

    evaluation_date = models.DateField(
        null=True, blank=True,
        help_text='Fecha real del examen. Si no se indica, se usa la fecha de creación.',
    )

    # ── Raw observations per view (JSON) ──
    anterior_data = models.JSONField(
        default=dict, blank=True,
        help_text='Vista anterior: cabeza, cuello, hombros, claviculas, altura_tetillas, pliegue_inguinal, rodillas, pie.',
    )
    lateral_right_data = models.JSONField(
        default=dict, blank=True,
        help_text='Vista lateral derecha: cabeza, escapulas, columna_vertebral, codos_angulo, abdomen_prominente, cadera, rodillas, pies.',
    )
    lateral_left_data = models.JSONField(
        default=dict, blank=True,
        help_text='Vista lateral izquierda: same segments as lateral right.',
    )
    posterior_data = models.JSONField(
        default=dict, blank=True,
        help_text='Vista posterior: cabeza, hombros, escapulas, codos_flexionados, espacios_brazo_tronco, columna_vertebral, pliegues_laterales, altura_cresta_inguinales, gluteos, pliegues_popliteos, rodillas, pies.',
    )

    # ── Photos per view ──
    anterior_photo = models.ImageField(
        upload_to=posturometry_photo_path, null=True, blank=True,
    )
    lateral_right_photo = models.ImageField(
        upload_to=posturometry_photo_path, null=True, blank=True,
    )
    lateral_left_photo = models.ImageField(
        upload_to=posturometry_photo_path, null=True, blank=True,
    )
    posterior_photo = models.ImageField(
        upload_to=posturometry_photo_path, null=True, blank=True,
    )

    # ── Observations per view ──
    anterior_observations = models.TextField(blank=True)
    lateral_right_observations = models.TextField(blank=True)
    lateral_left_observations = models.TextField(blank=True)
    posterior_observations = models.TextField(blank=True)

    notes = models.TextField(blank=True)
    recommendations = models.JSONField(
        default=dict, blank=True,
        help_text='Trainer-editable recommendations per region: {upper: {result, action}, ...}.',
    )

    # ── Computed indices ──
    global_index = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    global_category = models.CharField(max_length=30, blank=True)
    global_color = models.CharField(max_length=10, blank=True)

    upper_index = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    upper_category = models.CharField(max_length=30, blank=True)
    upper_color = models.CharField(max_length=10, blank=True)

    central_index = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    central_category = models.CharField(max_length=30, blank=True)
    central_color = models.CharField(max_length=10, blank=True)

    lower_index = models.DecimalField(max_digits=4, decimal_places=2, null=True, blank=True)
    lower_category = models.CharField(max_length=30, blank=True)
    lower_color = models.CharField(max_length=10, blank=True)

    segment_scores = models.JSONField(
        default=dict, blank=True,
        help_text='Consolidated scores per unique segment: {cabeza: {score, views: {...}}, ...}.',
    )
    findings = models.JSONField(
        default=dict, blank=True,
        help_text='Auto-generated findings per view: {anterior: [...], ...}.',
    )

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Posturometría #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        if not self.evaluation_date:
            self.evaluation_date = date.today()
        self._compute_indices()
        self._fill_default_recommendations()
        super().save(*args, **kwargs)

    def _compute_indices(self):
        from core_app.services.posturometry_calculator import compute_all
        results = compute_all(
            anterior_data=self.anterior_data or {},
            lateral_right_data=self.lateral_right_data or {},
            lateral_left_data=self.lateral_left_data or {},
            posterior_data=self.posterior_data or {},
        )
        for field, value in results.items():
            setattr(self, field, value)

    def _fill_default_recommendations(self):
        if self.recommendations:
            return
        from core_app.services.posturometry_calculator import generate_default_recommendations
        self.recommendations = generate_default_recommendations(self)
