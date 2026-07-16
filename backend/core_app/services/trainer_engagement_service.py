"""Aggregation for the trainer engagement panel (Fase 2 — Parte 11b).

Portfolio engagement over the trainer's own clients. All KPI math lives here
so the view stays thin.
"""

from datetime import timedelta

from django.db.models import Avg, Count, Max, Q, Sum

from core_app.models import (
    Booking,
    CreditTransaction,
    CreditWallet,
    MoodEntry,
    SessionRating,
    User,
)


def _customer_ids(trainer_profile):
    """Distinct customer ids booked with this trainer (defines their portfolio)."""
    return list(
        Booking.objects.filter(trainer=trainer_profile)
        .values_list('customer_id', flat=True)
        .distinct()
    )


def _summary(ids, trainer_profile, now):
    since = now - timedelta(days=30)
    total = len(ids)

    active_streaks = CreditWallet.objects.filter(
        customer_id__in=ids, current_streak__gt=0,
    ).count()

    checked_in = MoodEntry.objects.filter(user_id__in=ids, date=now.date()).count()
    checked_pct = round(checked_in / total * 100, 1) if total else 0.0

    txns = CreditTransaction.objects.filter(
        customer_id__in=ids, status=CreditTransaction.Status.CONFIRMED, created_at__gte=since,
    )
    earned = int(txns.filter(amount__gt=0).aggregate(s=Sum('amount'))['s'] or 0)
    spent = abs(int(txns.filter(amount__lt=0).aggregate(s=Sum('amount'))['s'] or 0))

    att = Booking.objects.filter(
        trainer=trainer_profile, starts_at__gte=since,
        attendance_status__in=[Booking.AttendanceStatus.ATTENDED, Booking.AttendanceStatus.NO_SHOW],
    ).aggregate(
        attended=Count('id', filter=Q(attendance_status=Booking.AttendanceStatus.ATTENDED)),
        total=Count('id'),
    )
    attendance_rate = round(att['attended'] / att['total'] * 100, 1) if att['total'] else None

    return {
        'clients_total': total,
        'active_streaks': active_streaks,
        'checked_in_today': checked_in,
        'checked_in_today_pct': checked_pct,
        'credits_earned_30d': earned,
        'credits_spent_30d': spent,
        'attendance_rate_30d': attendance_rate,
    }


def _roster(ids, trainer_profile, now):
    if not ids:
        return []
    since = now - timedelta(days=30)

    users = {u.id: u for u in User.objects.filter(id__in=ids)}
    streaks = dict(
        CreditWallet.objects.filter(customer_id__in=ids)
        .values_list('customer_id', 'current_streak')
    )

    last_checkin = {
        row['user_id']: row['last']
        for row in MoodEntry.objects.filter(user_id__in=ids)
        .values('user_id').annotate(last=Max('date'))
    }

    att_map = {
        row['customer_id']: (row['attended'], row['total'])
        for row in Booking.objects.filter(
            trainer=trainer_profile, customer_id__in=ids, starts_at__gte=since,
            attendance_status__in=[Booking.AttendanceStatus.ATTENDED, Booking.AttendanceStatus.NO_SHOW],
        ).values('customer_id').annotate(
            attended=Count('id', filter=Q(attendance_status=Booking.AttendanceStatus.ATTENDED)),
            total=Count('id'),
        )
    }

    rating_map = {
        row['booking__customer_id']: row['avg']
        for row in SessionRating.objects.filter(
            booking__customer_id__in=ids, booking__trainer=trainer_profile,
            rater_role=SessionRating.RaterRole.CUSTOMER,
        ).values('booking__customer_id').annotate(avg=Avg('score'))
    }

    roster = []
    for cid in ids:
        u = users.get(cid)
        if u is None:
            continue
        att = att_map.get(cid)
        rate = round(att[0] / att[1] * 100, 1) if att and att[1] else None
        avg = rating_map.get(cid)
        lc = last_checkin.get(cid)
        roster.append({
            'customer_id': cid,
            'name': f'{u.first_name} {u.last_name}'.strip() or u.email,
            'current_streak': streaks.get(cid, 0),
            'last_checkin': lc.isoformat() if lc else None,
            'attendance_rate_30d': rate,
            'average_rating': round(avg, 1) if avg is not None else None,
        })
    roster.sort(key=lambda r: (-r['current_streak'], r['name']))
    return roster


def build_engagement(trainer_profile, now):
    ids = _customer_ids(trainer_profile)
    return {
        'summary': _summary(ids, trainer_profile, now),
        'roster': _roster(ids, trainer_profile, now),
    }
