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
        'parq': _last_eval_date(
            ParqAssessment.objects.filter(customer=customer)
        ),
        'nutrition': _last_nutrition_date(
            NutritionHabit.objects.filter(customer=customer)
        ),
    }

    signals.extend(detect_expired_evaluations(last_eval_dates, today))

    # ── Postural / exercise conflict ──
    latest_posturo = (
        PosturometryEvaluation.objects
        .filter(customer=customer)
        .order_by('-evaluation_date')
        .first()
    )
    if latest_posturo:
        # Collect segment names with any alteration (findings stored as dict in JSONField)
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

    # ── Nutritional deficit ──
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
