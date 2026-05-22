"""Cálculo del índice de semana (1–4) dentro de un ciclo de 28 días."""
from django.utils import timezone


def current_week_number(start_date, today=None):
    """Devuelve la semana 1–4 vigente hoy para un ciclo que arranca en start_date.

    Antes del inicio → 1. Después del día 28 → 4.
    """
    if today is None:
        today = timezone.localdate()
    delta_days = (today - start_date).days
    if delta_days < 0:
        return 1
    week = delta_days // 7 + 1
    return min(max(week, 1), 4)
