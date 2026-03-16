"""PAR-Q+ assessment model for the KÓRE diagnostic engine.

Stores the client's responses to the 7 general health questions from
the PAR-Q+ 2024 (Physical Activity Readiness Questionnaire for Everyone)
and auto-computes a risk classification on save.

Scientific basis:
- PAR-Q+ (2024). CSEP / ePARmed-X+.
- Warburton DER et al. (2011). The PAR-Q+ and ePARmed-X+. HFJC, 4(2).
- Thomas S, Reading J, Shephard RJ (1992). Revision of PAR-Q. Can J Sport Sci.
- ACSM (2021). Guidelines for Exercise Testing and Prescription, 11th ed.
"""

from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class ParqAssessment(TimestampedModel):
    """A single PAR-Q+ assessment submitted by a client."""

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='parq_assessments',
        limit_choices_to={'role': 'customer'},
    )

    # ── 7 PAR-Q+ general health questions (Yes/No) ──
    q1_heart_condition = models.BooleanField(
        default=False,
        help_text='¿Algún médico le ha dicho que tiene una condición cardíaca O presión arterial alta?',
    )
    q2_chest_pain = models.BooleanField(
        default=False,
        help_text='¿Siente dolor en el pecho en reposo, en actividades diarias, o al hacer actividad física?',
    )
    q3_dizziness = models.BooleanField(
        default=False,
        help_text='¿Pierde el equilibrio por mareos O ha perdido el conocimiento en los últimos 12 meses?',
    )
    q4_chronic_condition = models.BooleanField(
        default=False,
        help_text='¿Le han diagnosticado alguna condición médica crónica (diferente a enfermedad cardíaca o presión alta)?',
    )
    q5_prescribed_medication = models.BooleanField(
        default=False,
        help_text='¿Actualmente toma medicamentos recetados para una condición médica crónica?',
    )
    q6_bone_joint_problem = models.BooleanField(
        default=False,
        help_text='¿Tiene actualmente (o ha tenido en los últimos 12 meses) un problema óseo, articular o de tejidos blandos que podría empeorar con actividad física?',
    )
    q7_medical_supervision = models.BooleanField(
        default=False,
        help_text='¿Algún médico le ha dicho que solo debe hacer actividad física con supervisión médica?',
    )

    additional_notes = models.TextField(blank=True)

    # ── Computed fields ──
    yes_count = models.PositiveSmallIntegerField(default=0)
    risk_classification = models.CharField(max_length=30, blank=True)
    risk_label = models.CharField(max_length=50, blank=True)
    risk_color = models.CharField(max_length=10, blank=True)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"PAR-Q #{self.pk} — {self.customer.email} ({self.created_at.date()})"

    def save(self, *args, **kwargs):
        self._compute_classification()
        super().save(*args, **kwargs)

    def _compute_classification(self):
        from core_app.services.parq_calculator import compute_all

        results = compute_all(
            q1_heart_condition=self.q1_heart_condition,
            q2_chest_pain=self.q2_chest_pain,
            q3_dizziness=self.q3_dizziness,
            q4_chronic_condition=self.q4_chronic_condition,
            q5_prescribed_medication=self.q5_prescribed_medication,
            q6_bone_joint_problem=self.q6_bone_joint_problem,
            q7_medical_supervision=self.q7_medical_supervision,
        )

        for field, value in results.items():
            setattr(self, field, value)
