"""Recording and assembly of subscription renewal history.

`record_renewal` appends one row to the append-only SubscriptionRenewal table.
`build_renewal_timeline` assembles a customer's full period timeline by merging:
  (A) SubscriptionRenewal rows of any subscription owned by the customer, and
  (B) the customer's Subscription rows that have NO renewal records (legacy
      data created before this feature) as synthetic period items.
The two sources never overlap: (B) excludes rows that already have records.
"""

from __future__ import annotations

from core_app.models import Subscription, SubscriptionRenewal


def record_renewal(
    *,
    subscription,
    kind: str,
    period_start,
    period_end,
    sessions_granted: int,
    package,
    payment=None,
    actor_email: str = '',
    note: str = '',
) -> SubscriptionRenewal:
    """Append a single period record to the subscription's history."""
    return SubscriptionRenewal.objects.create(
        subscription=subscription,
        kind=kind,
        period_start=period_start,
        period_end=period_end,
        sessions_granted=sessions_granted,
        package=package,
        payment=payment,
        actor_email=actor_email or '',
        note=note or '',
    )


def _payment_dict(payment):
    if payment is None:
        return None
    return {
        'amount': str(payment.amount),
        'currency': payment.currency,
        'provider': payment.provider,
        'status': payment.status,
    }


def build_renewal_timeline(customer) -> list[dict]:
    """Return the customer's full period timeline, newest period first."""
    items: list[dict] = []

    # (A) New-style records across all of the customer's subscriptions.
    records = (
        SubscriptionRenewal.objects
        .filter(subscription__customer=customer)
        .select_related('package', 'payment')
    )
    for r in records:
        items.append({
            'kind': r.kind,
            'period_start': r.period_start,
            'period_end': r.period_end,
            'sessions_granted': r.sessions_granted,
            'package_title': r.package.title,
            'actor_email': r.actor_email,
            'note': r.note,
            'payment': _payment_dict(r.payment),
            'source': 'record',
        })

    # (B) Legacy subscription rows with no records → synthetic periods.
    legacy_rows = list(
        Subscription.objects
        .filter(customer=customer, renewals__isnull=True)
        .select_related('package')
        .order_by('created_at')
    )
    for index, sub in enumerate(legacy_rows):
        items.append({
            'kind': (
                SubscriptionRenewal.Kind.INITIAL
                if index == 0
                else SubscriptionRenewal.Kind.MANUAL
            ),
            'period_start': sub.starts_at,
            'period_end': sub.expires_at,
            'sessions_granted': sub.sessions_total,
            'package_title': sub.package.title,
            'actor_email': '',
            'note': '',
            'payment': None,
            'source': 'legacy',
        })

    items.sort(key=lambda it: it['period_start'], reverse=True)
    return items
