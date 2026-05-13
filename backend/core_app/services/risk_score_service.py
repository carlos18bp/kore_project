"""Shared helper for computing and persisting a ClientRiskScore for one customer.

Used by:
- compute_daily_alerts (Huey periodic task, runs at 06:00 for all active clients)
- post_save signal handlers (reactive recompute when an evaluation is saved)
"""
from __future__ import annotations

import logging

logger = logging.getLogger(__name__)


def recompute_risk_score(customer, today=None) -> bool:
    """Recompute behavioral + clinical signals for *customer* and persist a new ClientRiskScore.

    Finds the trainer from the latest published MonthlyProgram.
    Returns True if a score was written, False if skipped (no active program / no trainer).

    The caller is responsible for wrapping this in try/except if they want to swallow errors.
    """
    from django.utils.timezone import localdate

    from core_app.models import ClientRiskScore
    from core_app.models.monthly_program import MonthlyProgram
    from core_app.services.behavioral_alert_engine import compute_behavioral_signals
    from core_app.services.clinical_alert_engine import compute_clinical_signals

    if today is None:
        today = localdate()

    program = (
        MonthlyProgram.objects
        .filter(customer=customer, status=MonthlyProgram.Status.PUBLISHED)
        .select_related('trainer')
        .order_by('-start_date')
        .first()
    )
    if program is None or program.trainer is None:
        return False

    trainer = program.trainer

    behavioral = compute_behavioral_signals(customer, trainer, today)
    clinical = compute_clinical_signals(customer, trainer, today)
    all_signals = behavioral + clinical
    severities = {s['severity'] for s in all_signals}

    if 'alto' in severities:
        level = ClientRiskScore.Level.ALTO
    elif 'medio' in severities:
        level = ClientRiskScore.Level.MEDIO
    elif 'bajo' in severities:
        level = ClientRiskScore.Level.BAJO
    else:
        level = ClientRiskScore.Level.SIN_RIESGO

    ClientRiskScore.objects.filter(
        customer=customer, trainer=trainer, is_stale=False,
    ).update(is_stale=True)

    ClientRiskScore.objects.create(
        customer=customer,
        trainer=trainer,
        level=level,
        behavioral_signals=behavioral,
        clinical_signals=clinical,
    )

    return True
