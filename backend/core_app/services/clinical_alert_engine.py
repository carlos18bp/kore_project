"""
Clinical alert detection for the Trainer Intelligence Center.

Crosses evaluation results with program data to detect clinical risk signals.
compute_clinical_signals() is the ORM orchestrator.
"""
from __future__ import annotations

from datetime import date, timedelta

# Expiry thresholds in days per module
EVAL_THRESHOLDS = {
    'anthropometry': 60,
    'posturometry': 60,
    'physical': 60,
    'parq': 90,
    'nutrition': 90,
}

# Postural segments that conflict with high-load exercises
_HIGH_RISK_POSTURAL_SEGMENTS = (
    'columna_vertebral', 'columna_lumbar', 'columna_cervical',
    'rodillas', 'hombros',
)

# Exercise name patterns that require healthy joints/spine
_HIGH_LOAD_PATTERNS = (
    'squat', 'sentadilla', 'deadlift', 'peso muerto',
    'overhead', 'press', 'militar', 'lunges', 'zancadas',
)


# ── Pure signal detectors ────────────────────────────────────────────────────

def detect_expired_evaluations(
    last_eval_dates: dict[str, date | None],
    today: date,
) -> list[dict]:
    """
    Returns a list of signals for each module whose last evaluation is past its threshold.

    last_eval_dates: {module_name: last_eval_date or None}
    """
    signals = []
    for module, threshold_days in EVAL_THRESHOLDS.items():
        last_date = last_eval_dates.get(module)
        if last_date is None:
            signals.append({
                'type': f'expired_{module}',
                'label': f'Sin evaluación de {_module_label(module)}',
                'severity': 'medio',
                'detail': f'No se ha registrado ninguna evaluación de {_module_label(module)}.',
                'module': module,
                'last_eval_date': None,
            })
            continue
        days_since = (today - last_date).days
        if days_since > threshold_days * 2:
            signals.append({
                'type': f'expired_{module}',
                'label': f'{_module_label(module)} vencida hace {days_since}d',
                'severity': 'alto',
                'detail': f'Última evaluación: {last_date.isoformat()}. Umbral: {threshold_days}d.',
                'module': module,
                'last_eval_date': last_date.isoformat(),
            })
        elif days_since > threshold_days:
            signals.append({
                'type': f'expired_{module}',
                'label': f'{_module_label(module)} vencida ({days_since}d)',
                'severity': 'medio',
                'detail': f'Última evaluación: {last_date.isoformat()}. Umbral: {threshold_days}d.',
                'module': module,
                'last_eval_date': last_date.isoformat(),
            })
    return signals


def detect_postural_exercise_conflict(
    postural_findings: list[str],
    exercise_names: list[str],
) -> dict | None:
    """
    Returns a signal if high-risk postural segments are affected AND high-load exercises
    are in the program.

    postural_findings: list of segment names that have alterations (severity > 0).
    exercise_names: list of exercise name strings in the active program.
    """
    risky_segments = [s for s in postural_findings if s in _HIGH_RISK_POSTURAL_SEGMENTS]
    if not risky_segments:
        return None

    conflicting_exercises = [
        name for name in exercise_names
        if any(pattern in name.lower() for pattern in _HIGH_LOAD_PATTERNS)
    ]
    if not conflicting_exercises:
        return None

    return {
        'type': 'postural_exercise_conflict',
        'label': 'Conflicto postural con ejercicios del programa',
        'severity': 'medio',
        'detail': (
            f'Alteraciones en: {", ".join(risky_segments)}. '
            f'Ejercicios en programa: {", ".join(conflicting_exercises[:3])}.'
        ),
        'module': 'posturometry',
        'last_eval_date': None,
    }


def detect_anthropometry_critical(
    bmi: float | None,
    bmi_category: str,
    bf_color: str,
    waist_risk_color: str,
    whr_color: str,
    whe_color: str,
    eval_date: 'date | None',
) -> list[dict]:
    """
    Returns a list of signals for critical anthropometric findings:
    - Obesity (BMI >= 30)
    - Critical body fat (bf_color == 'rojo')
    - Critical waist circumference risk (waist_risk_color or whr_color or whe_color == 'rojo')
    """
    signals = []
    last_eval = eval_date.isoformat() if eval_date else None

    if bmi is not None and bmi >= 30:
        category_label = bmi_category or 'Obesidad'
        severity = 'alto' if bmi >= 35 else 'medio'
        signals.append({
            'type': 'anthropometry_obesity',
            'label': f'IMC en rango de {category_label}: {round(bmi, 1)}',
            'severity': severity,
            'detail': f'IMC: {round(bmi, 1)} kg/m². Categoría: {category_label}.',
            'module': 'anthropometry',
            'last_eval_date': last_eval,
        })

    if bf_color == 'rojo':
        signals.append({
            'type': 'anthropometry_body_fat_critical',
            'label': 'Porcentaje de grasa corporal crítico',
            'severity': 'medio',
            'detail': 'El porcentaje de grasa corporal está en zona de riesgo (rojo).',
            'module': 'anthropometry',
            'last_eval_date': last_eval,
        })

    if 'rojo' in (waist_risk_color, whr_color, whe_color):
        signals.append({
            'type': 'anthropometry_waist_risk',
            'label': 'Riesgo cardiovascular por medidas de cintura',
            'severity': 'medio',
            'detail': 'Uno o más indicadores de riesgo por cintura están en zona roja (ICC, ICT o perímetro).',
            'module': 'anthropometry',
            'last_eval_date': last_eval,
        })

    return signals


def detect_posturometry_multiple_alterations(
    segment_scores: dict,
    findings: dict,
    eval_date: 'date | None',
    threshold: int = 3,
) -> dict | None:
    """
    Returns a signal when 3+ postural segments have alterations.
    Uses segment_scores JSONField (keys are segment names, values have 'score' < 3 = altered).
    Falls back to findings if segment_scores is empty.
    """
    altered_segments: list[str] = []

    if segment_scores and isinstance(segment_scores, dict):
        for segment, data in segment_scores.items():
            if isinstance(data, dict) and data.get('score', 3) < 3:
                altered_segments.append(segment)
    elif findings and isinstance(findings, dict):
        for view, view_findings in findings.items():
            if isinstance(view_findings, list):
                for item in view_findings:
                    seg = item if isinstance(item, str) else (item.get('segment') if isinstance(item, dict) else None)
                    if seg and seg not in altered_segments:
                        altered_segments.append(seg)

    if len(altered_segments) < threshold:
        return None

    return {
        'type': 'posturometry_multiple_alterations',
        'label': f'{len(altered_segments)} segmentos posturales alterados',
        'severity': 'alto' if len(altered_segments) >= 5 else 'medio',
        'detail': f'Alteraciones en: {", ".join(altered_segments[:6])}{"..." if len(altered_segments) > 6 else ""}.',
        'module': 'posturometry',
        'last_eval_date': eval_date.isoformat() if eval_date else None,
    }


def detect_physical_low_fitness(
    general_index: float | None,
    general_category: str,
    eval_date: 'date | None',
) -> dict | None:
    """Returns a signal if the physical general_index is in the very low range (<= 1.5)."""
    if general_index is None:
        return None
    if general_index <= 1.5:
        return {
            'type': 'physical_low_fitness',
            'label': f'Condición física muy baja: {general_category or round(general_index, 2)}',
            'severity': 'alto' if general_index <= 1.0 else 'medio',
            'detail': f'Índice de condición física general: {round(general_index, 2)}/5. Categoría: {general_category or "Muy bajo"}.',
            'module': 'physical',
            'last_eval_date': eval_date.isoformat() if eval_date else None,
        }
    return None


def detect_parq_high_risk(
    yes_count: int,
    q1_heart: bool,
    q2_chest: bool,
    q3_dizziness: bool,
    q7_medical_supervision: bool,
    risk_classification: str,
    eval_date: 'date | None',
) -> dict | None:
    """
    Returns a signal if PAR-Q+ indicates high risk:
    - yes_count >= 3, OR
    - Any critical single question (q1, q2, q3, q7) answered Yes
    """
    critical_yes = q1_heart or q2_chest or q3_dizziness or q7_medical_supervision
    if yes_count == 0:
        return None

    if yes_count >= 3 or critical_yes:
        severity = 'alto' if (yes_count >= 3 or q2_chest or q3_dizziness or q7_medical_supervision) else 'medio'
        critical_labels = []
        if q1_heart:
            critical_labels.append('condición cardíaca/hipertensión')
        if q2_chest:
            critical_labels.append('dolor de pecho')
        if q3_dizziness:
            critical_labels.append('mareos/pérdida de conocimiento')
        if q7_medical_supervision:
            critical_labels.append('requiere supervisión médica')

        detail = f'{yes_count} respuesta(s) positiva(s) en PAR-Q+.'
        if critical_labels:
            detail += f' Factores críticos: {", ".join(critical_labels)}.'
        if risk_classification:
            detail += f' Clasificación: {risk_classification}.'

        return {
            'type': 'parq_high_risk',
            'label': f'PAR-Q+: {yes_count} factor{"es" if yes_count > 1 else ""} de riesgo',
            'severity': severity,
            'detail': detail,
            'module': 'parq',
            'last_eval_date': eval_date.isoformat() if eval_date else None,
        }
    return None


def detect_nutrition_habits_specific(
    ultraprocessed_weekly: int | None,
    water_liters: float | None,
    eats_breakfast: bool | None,
    sugary_drinks_weekly: int | None,
    eval_date: 'date | None',
) -> list[dict]:
    """
    Returns specific signals for individual problematic nutrition habits:
    - Ultra-processed consumption > 7/week
    - Water intake < 1 L/day
    - Not eating breakfast regularly
    - Sugary drinks > 7/week
    """
    signals = []
    last_eval = eval_date.isoformat() if eval_date else None

    if ultraprocessed_weekly is not None and ultraprocessed_weekly > 7:
        signals.append({
            'type': 'nutrition_ultraprocessed_high',
            'label': f'Consumo alto de ultraprocesados: {ultraprocessed_weekly}×/sem',
            'severity': 'alto' if ultraprocessed_weekly > 14 else 'medio',
            'detail': f'Consumo de alimentos ultraprocesados: {ultraprocessed_weekly} veces por semana (recomendado: ≤7).',
            'module': 'nutrition',
            'last_eval_date': last_eval,
        })

    if water_liters is not None and float(water_liters) < 1.0:
        signals.append({
            'type': 'nutrition_low_water',
            'label': f'Hidratación muy baja: {water_liters}L/día',
            'severity': 'medio',
            'detail': f'Ingesta de agua: {water_liters}L/día (recomendado: ≥2L).',
            'module': 'nutrition',
            'last_eval_date': last_eval,
        })

    if eats_breakfast is False:
        signals.append({
            'type': 'nutrition_skips_breakfast',
            'label': 'No desayuna regularmente',
            'severity': 'bajo',
            'detail': 'El cliente reporta no desayunar de manera regular.',
            'module': 'nutrition',
            'last_eval_date': last_eval,
        })

    if sugary_drinks_weekly is not None and sugary_drinks_weekly > 7:
        signals.append({
            'type': 'nutrition_sugary_drinks_high',
            'label': f'Consumo alto de bebidas azucaradas: {sugary_drinks_weekly}×/sem',
            'severity': 'medio',
            'detail': f'Bebidas azucaradas: {sugary_drinks_weekly} veces por semana (recomendado: ≤7).',
            'module': 'nutrition',
            'last_eval_date': last_eval,
        })

    return signals


def detect_nutritional_deficit(
    habit_score: float | None,
    previous_habit_score: float | None,
) -> dict | None:
    """
    Returns a signal if nutrition habit score is low with no improvement trend.

    habit_score: most recent NutritionHabit.habit_score (0-10).
    previous_habit_score: habit score from 30+ days ago (or None if unavailable).
    """
    if habit_score is None:
        return None
    if habit_score < 2.5:
        return {
            'type': 'nutritional_deficit',
            'label': f'Déficit nutricional crítico: {habit_score}/10',
            'severity': 'medio',
            'detail': f'Puntaje de hábito nutricional: {habit_score}/10.',
            'module': 'nutrition',
            'last_eval_date': None,
        }
    if habit_score < 4.0:
        improving = (
            previous_habit_score is not None and habit_score > previous_habit_score
        )
        if not improving:
            return {
                'type': 'nutritional_deficit',
                'label': f'Hábito nutricional bajo: {habit_score}/10',
                'severity': 'bajo',
                'detail': (
                    f'Puntaje: {habit_score}/10. '
                    + ('Sin mejora respecto a evaluación anterior.' if previous_habit_score else 'Sin evaluación anterior para comparar.')
                ),
                'module': 'nutrition',
                'last_eval_date': None,
            }
    return None


# ── ORM orchestrator ─────────────────────────────────────────────────────────

def compute_clinical_signals(customer, trainer, today: date) -> list[dict]:
    """
    Queries DB for a single customer and returns a list of clinical signal dicts.
    """
    from core_app.models import (
        AnthropometryEvaluation,
        NutritionHabit,
        ParqAssessment,
        PhysicalEvaluation,
        PosturometryEvaluation,
    )
    from core_app.models.monthly_program import MonthlyProgram, ProgramDay, ProgramExercise

    signals: list[dict] = []

    # ── Expired evaluations ──
    def _last_eval_date(qs):
        obj = qs.order_by('-evaluation_date').first()
        return obj.evaluation_date if obj else None

    def _last_nutrition_date(qs):
        obj = qs.order_by('-created_at').first()
        return obj.created_at.date() if obj else None

    last_eval_dates = {
        'anthropometry': _last_eval_date(
            AnthropometryEvaluation.objects.filter(customer=customer)
        ),
        'posturometry': _last_eval_date(
            PosturometryEvaluation.objects.filter(customer=customer)
        ),
        'physical': _last_eval_date(
            PhysicalEvaluation.objects.filter(customer=customer)
        ),
        'parq': _last_nutrition_date(
            ParqAssessment.objects.filter(customer=customer)
        ),
        'nutrition': _last_nutrition_date(
            NutritionHabit.objects.filter(customer=customer)
        ),
    }

    signals.extend(detect_expired_evaluations(last_eval_dates, today))

    # ── Anthropometry critical findings ──
    latest_anthro = (
        AnthropometryEvaluation.objects
        .filter(customer=customer)
        .order_by('-evaluation_date')
        .first()
    )
    if latest_anthro:
        signals.extend(detect_anthropometry_critical(
            bmi=float(latest_anthro.bmi) if latest_anthro.bmi else None,
            bmi_category=latest_anthro.bmi_category or '',
            bf_color=latest_anthro.bf_color or '',
            waist_risk_color=latest_anthro.waist_risk_color or '',
            whr_color=latest_anthro.whr_color or '',
            whe_color=latest_anthro.whe_color or '',
            eval_date=latest_anthro.evaluation_date,
        ))

    # ── Posturometry: multiple alterations ──
    latest_posturo = (
        PosturometryEvaluation.objects
        .filter(customer=customer)
        .order_by('-evaluation_date')
        .first()
    )
    if latest_posturo:
        signal = detect_posturometry_multiple_alterations(
            segment_scores=latest_posturo.segment_scores or {},
            findings=latest_posturo.findings or {},
            eval_date=latest_posturo.evaluation_date,
        )
        if signal:
            signals.append(signal)

        # Postural / exercise conflict (existing logic)
        postural_findings = []
        findings_data = getattr(latest_posturo, 'findings', None) or {}
        if isinstance(findings_data, dict):
            for segment, data in findings_data.items():
                if isinstance(data, dict) and data.get('status') == 'alterado':
                    postural_findings.append(segment)

        if postural_findings:
            active_program = (
                MonthlyProgram.objects
                .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
                .order_by('-start_date')
                .first()
            )
            if active_program:
                exercise_names = list(
                    ProgramExercise.objects
                    .filter(program_day__program=active_program)
                    .select_related('exercise')
                    .values_list('exercise__name', flat=True)
                    .distinct()
                )
                signal = detect_postural_exercise_conflict(postural_findings, exercise_names)
                if signal:
                    signal['last_eval_date'] = latest_posturo.evaluation_date.isoformat()
                    signals.append(signal)

    # ── Physical fitness: low general index ──
    latest_physical = (
        PhysicalEvaluation.objects
        .filter(customer=customer)
        .order_by('-evaluation_date')
        .first()
    )
    if latest_physical:
        signal = detect_physical_low_fitness(
            general_index=float(latest_physical.general_index) if latest_physical.general_index else None,
            general_category=latest_physical.general_category or '',
            eval_date=latest_physical.evaluation_date,
        )
        if signal:
            signals.append(signal)

    # ── PAR-Q high risk ──
    latest_parq = (
        ParqAssessment.objects
        .filter(customer=customer)
        .order_by('-created_at')
        .first()
    )
    if latest_parq:
        signal = detect_parq_high_risk(
            yes_count=latest_parq.yes_count,
            q1_heart=latest_parq.q1_heart_condition,
            q2_chest=latest_parq.q2_chest_pain,
            q3_dizziness=latest_parq.q3_dizziness,
            q7_medical_supervision=latest_parq.q7_medical_supervision,
            risk_classification=latest_parq.risk_classification or '',
            eval_date=latest_parq.created_at.date(),
        )
        if signal:
            signals.append(signal)

    # ── Nutrition habits: specific issues ──
    latest_nutrition_habit = (
        NutritionHabit.objects
        .filter(customer=customer)
        .order_by('-created_at')
        .first()
    )
    if latest_nutrition_habit:
        signals.extend(detect_nutrition_habits_specific(
            ultraprocessed_weekly=latest_nutrition_habit.ultraprocessed_weekly,
            water_liters=float(latest_nutrition_habit.water_liters),
            eats_breakfast=latest_nutrition_habit.eats_breakfast,
            sugary_drinks_weekly=latest_nutrition_habit.sugary_drinks_weekly,
            eval_date=latest_nutrition_habit.created_at.date(),
        ))

    # ── Nutritional deficit (habit score) ──
    nutrition_evals = list(
        NutritionHabit.objects
        .filter(customer=customer)
        .order_by('-created_at')
        .values_list('habit_score', 'created_at')[:2]
    )
    latest_score = float(nutrition_evals[0][0]) if nutrition_evals else None
    previous_score = float(nutrition_evals[1][0]) if len(nutrition_evals) > 1 else None

    signal = detect_nutritional_deficit(latest_score, previous_score)
    if signal:
        if nutrition_evals:
            signal['last_eval_date'] = nutrition_evals[0][1].date().isoformat()
        signals.append(signal)

    return signals


# ── Internal helpers ─────────────────────────────────────────────────────────

def _module_label(module: str) -> str:
    return {
        'anthropometry': 'Antropometría',
        'posturometry': 'Posturometría',
        'physical': 'Evaluación física',
        'parq': 'PAR-Q+',
        'nutrition': 'Hábitos nutricionales',
    }.get(module, module)
