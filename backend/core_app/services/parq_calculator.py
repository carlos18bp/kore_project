"""PAR-Q+ risk classification calculator for the KÓRE diagnostic engine.

Implements a simplified safety filter based on the PAR-Q+ 2024
(Physical Activity Readiness Questionnaire for Everyone).  The 7
general health questions produce a YES count that maps to a risk
classification used by KÓRE to guide exercise programming.

Classification (KÓRE policy):
  0 YES  → Apto para ejercicio (green)
  1–2 YES → Apto con precaución (yellow)
  3+ YES  → Requiere valoración médica (red)

Scientific basis:
- PAR-Q+ (2024). The Physical Activity Readiness Questionnaire for
  Everyone. Canadian Society for Exercise Physiology / ePARmed-X+.
- Warburton DER, Jamnik VK, Bredin SSD, Gledhill N (2011). The
  Physical Activity Readiness Questionnaire for Everyone (PAR-Q+)
  and electronic Physical Activity Readiness Medical Examination
  (ePARmed-X+). HFJC, 4(2):3-23.
- Thomas S, Reading J, Shephard RJ (1992). Revision of the Physical
  Activity Readiness Questionnaire (PAR-Q). Can J Sport Sci, 17(4).
- ACSM (2021). Guidelines for Exercise Testing and Prescription,
  11th ed. — pre-participation health screening.
"""


# ---------------------------------------------------------------------------
# Question keys (for reference and iteration)
# ---------------------------------------------------------------------------

PARQ_QUESTION_KEYS = (
    'q1_heart_condition',
    'q2_chest_pain',
    'q3_dizziness',
    'q4_chronic_condition',
    'q5_prescribed_medication',
    'q6_bone_joint_problem',
    'q7_medical_supervision',
)

PARQ_QUESTIONS_ES = {
    'q1_heart_condition': '¿Algún médico le ha dicho que tiene una condición cardíaca O presión arterial alta?',
    'q2_chest_pain': '¿Siente dolor en el pecho en reposo, en actividades diarias, o al hacer actividad física?',
    'q3_dizziness': '¿Pierde el equilibrio por mareos O ha perdido el conocimiento en los últimos 12 meses?',
    'q4_chronic_condition': '¿Le han diagnosticado alguna condición médica crónica (diferente a enfermedad cardíaca o presión alta)?',
    'q5_prescribed_medication': '¿Actualmente toma medicamentos recetados para una condición médica crónica?',
    'q6_bone_joint_problem': '¿Tiene actualmente (o ha tenido en los últimos 12 meses) un problema óseo, articular o de tejidos blandos que podría empeorar con actividad física?',
    'q7_medical_supervision': '¿Algún médico le ha dicho que solo debe hacer actividad física con supervisión médica?',
}


# ---------------------------------------------------------------------------
# Classification
# ---------------------------------------------------------------------------

def classify_risk(yes_count):
    """Return (classification, label, color) for a given YES count.

    Args:
        yes_count: Number of affirmative answers (0–7).

    Returns:
        tuple: (classification_key, human_label, color)
    """
    if yes_count == 0:
        return ('apto', 'Apto para ejercicio', 'green')
    if yes_count <= 2:
        return ('apto_con_precaucion', 'Apto con precaución', 'yellow')
    return ('requiere_valoracion', 'Requiere valoración médica', 'red')


# ---------------------------------------------------------------------------
# Composite compute_all
# ---------------------------------------------------------------------------

def compute_all(
    q1_heart_condition=False,
    q2_chest_pain=False,
    q3_dizziness=False,
    q4_chronic_condition=False,
    q5_prescribed_medication=False,
    q6_bone_joint_problem=False,
    q7_medical_supervision=False,
):
    """Run classification and return a flat dict of results.

    Called from ParqAssessment.save() → _compute_classification().
    """
    answers = [
        q1_heart_condition,
        q2_chest_pain,
        q3_dizziness,
        q4_chronic_condition,
        q5_prescribed_medication,
        q6_bone_joint_problem,
        q7_medical_supervision,
    ]

    yes_count = sum(1 for a in answers if a)
    classification, label, color = classify_risk(yes_count)

    return {
        'yes_count': yes_count,
        'risk_classification': classification,
        'risk_label': label,
        'risk_color': color,
    }


# ---------------------------------------------------------------------------
# Default recommendation texts
# ---------------------------------------------------------------------------

RECOMMENDATION_TEXTS = {
    'green': {
        'result': 'No se identificaron factores de riesgo en el cuestionario PAR-Q+. Estás habilitado para actividad física estándar.',
        'action': 'Puedes participar en tu programa KÓRE sin restricciones especiales. Recuerda informar cualquier cambio en tu estado de salud.',
    },
    'yellow': {
        'result': 'Se identificaron 1–2 factores que requieren atención. Puedes realizar actividad física con las precauciones adecuadas.',
        'action': 'Tu entrenador adaptará las intensidades y ejercicios según tus respuestas. Se recomienda monitoreo durante las sesiones.',
    },
    'red': {
        'result': 'Se identificaron 3 o más factores de riesgo. Es necesaria una valoración médica antes de iniciar o continuar el programa.',
        'action': 'Consulta con tu médico y obtén una autorización por escrito para actividad física. Tu entrenador necesita esta información para diseñar un programa seguro.',
    },
}


def generate_default_recommendation(color):
    """Return default recommendation dict for the given color."""
    return RECOMMENDATION_TEXTS.get(color, RECOMMENDATION_TEXTS['red'])
