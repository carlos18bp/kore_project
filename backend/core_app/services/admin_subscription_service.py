"""Admin-driven subscription creation and plan evolution.

Two operations are exposed:

- ``create_subscription_for_admin``: register a brand new subscription for a
  customer who does not currently have an active one. Used when the customer
  paid in cash or by bank transfer (off-platform). A Payment record is created
  alongside the Subscription with the full package price.

- ``evolve_subscription_for_admin``: replace the active subscription's package
  with a larger one (upgrade only — downgrades are blocked at the call site).
  Preserves ``starts_at``, ``expires_at``, ``sessions_used``, ``is_recurring``,
  and ``payment_method_type``. A Payment record is created for the delta only.

Both operations are wrapped in ``transaction.atomic`` so the Subscription and
its accompanying Payment row land together. The ``actor`` parameter (the admin
user) is accepted but not persisted today — there is no ``Payment.recorded_by``
column yet. It is captured in ``Payment.metadata`` so it can be promoted to a
dedicated column later without changing service signatures.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Optional

from django.db import transaction
from django.utils import timezone

from core_app.models import Payment, Subscription, SubscriptionRenewal
from core_app.services.renewal_history_service import record_renewal


ALLOWED_OFFLINE_METHODS = {
    Payment.Provider.CASH,
    Payment.Provider.TRANSFER,
}


@transaction.atomic
def create_subscription_for_admin(
    *,
    customer,
    package,
    payment_method: str,
    starts_at,
    expires_at,
    sessions_used: int,
    notes: str = '',
    actor=None,
) -> Subscription:
    """Create a new ACTIVE subscription for a customer with no active sub.

    Args:
        customer: User who owns the new subscription.
        package: Package being purchased.
        payment_method: ``Payment.Provider.CASH`` or ``Payment.Provider.TRANSFER``.
        starts_at: Subscription validity start (timezone-aware).
        expires_at: Subscription validity end (timezone-aware).
        sessions_used: Sessions already consumed at creation time (>= 0,
            <= ``package.sessions_count``).
        notes: Optional admin notes copied into ``Payment.metadata.notes``.
        actor: Admin ``User`` initiating the action. Stored in metadata.

    Returns:
        Subscription: The newly created subscription instance.
    """
    subscription = Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=package.sessions_count,
        sessions_used=sessions_used,
        status=Subscription.Status.ACTIVE,
        starts_at=starts_at,
        expires_at=expires_at,
        is_recurring=False,
        payment_method_type='',
    )

    payment = Payment.objects.create(
        subscription=subscription,
        customer=customer,
        status=Payment.Status.CONFIRMED,
        amount=package.price,
        currency=package.currency,
        provider=payment_method,
        confirmed_at=timezone.now(),
        metadata=_payment_metadata(
            kind='admin_create',
            actor=actor,
            notes=notes,
            extra={'package_id': package.pk},
        ),
    )

    record_renewal(
        subscription=subscription,
        kind=SubscriptionRenewal.Kind.INITIAL,
        period_start=starts_at,
        period_end=expires_at,
        sessions_granted=subscription.sessions_total,
        package=package,
        payment=payment,
        actor_email=getattr(actor, 'email', '') or '',
        note=notes,
    )

    return subscription


@transaction.atomic
def evolve_subscription_for_admin(
    *,
    current_subscription: Subscription,
    new_package,
    payment_method: str,
    notes: str = '',
    actor=None,
) -> Subscription:
    """Replace the current subscription's package with a larger one.

    Validity dates, ``sessions_used``, ``is_recurring`` and
    ``payment_method_type`` are preserved by design — only ``package`` and
    ``sessions_total`` change. The price delta is recorded as a new Payment
    row tied to the (still same) Subscription.

    Args:
        current_subscription: The customer's existing ACTIVE subscription.
        new_package: The target package (must be larger in both price and
            sessions_count — validated by caller, not here).
        payment_method: ``Payment.Provider.CASH`` or ``Payment.Provider.TRANSFER``.
        notes: Optional admin notes copied into ``Payment.metadata.notes``.
        actor: Admin ``User`` initiating the action. Stored in metadata.

    Returns:
        Subscription: The updated subscription (same instance, refreshed).
    """
    old_package = current_subscription.package
    delta_amount = (new_package.price or Decimal('0')) - (old_package.price or Decimal('0'))

    current_subscription.package = new_package
    current_subscription.sessions_total = new_package.sessions_count
    current_subscription.save(update_fields=['package', 'sessions_total', 'updated_at'])

    payment = Payment.objects.create(
        subscription=current_subscription,
        customer=current_subscription.customer,
        status=Payment.Status.CONFIRMED,
        amount=delta_amount,
        currency=new_package.currency,
        provider=payment_method,
        confirmed_at=timezone.now(),
        metadata=_payment_metadata(
            kind='admin_evolve',
            actor=actor,
            notes=notes,
            extra={
                'from_package_id': old_package.pk,
                'from_package_title': old_package.title,
                'to_package_id': new_package.pk,
                'to_package_title': new_package.title,
            },
        ),
    )

    record_renewal(
        subscription=current_subscription,
        kind=SubscriptionRenewal.Kind.PLAN_CHANGE,
        period_start=current_subscription.starts_at,
        period_end=current_subscription.expires_at,
        sessions_granted=current_subscription.sessions_total,
        package=new_package,
        payment=payment,
        actor_email=getattr(actor, 'email', '') or '',
        note=notes,
    )

    return current_subscription


@transaction.atomic
def schedule_plan_change_for_admin(
    *,
    current_subscription: Subscription,
    new_package,
    notes: str = '',
    actor=None,
) -> Subscription:
    """Schedule a downgrade / lateral plan change for the next renewal.

    No payment or refund happens now and the current paid period is left
    untouched (the customer keeps the package they already paid for until
    ``expires_at``). The ``new_package`` is stored in ``pending_package`` and is
    applied — with its price charged — when the subscription renews, either via
    the recurring billing task or an admin manual renewal.

    Args:
        current_subscription: The customer's existing ACTIVE subscription.
        new_package: The target package (lower or lateral price — validated by
            the caller).
        notes: Optional admin notes (currently informational only).
        actor: Admin ``User`` initiating the action.

    Returns:
        Subscription: The updated subscription (same instance, refreshed).
    """
    current_subscription.pending_package = new_package
    current_subscription.save(update_fields=['pending_package', 'updated_at'])
    return current_subscription


def _payment_metadata(*, kind: str, actor, notes: str, extra: Optional[dict] = None) -> dict:
    """Build the Payment.metadata dict for admin-driven payments."""
    data: dict = {'admin_action': kind}
    if actor is not None and getattr(actor, 'email', None):
        data['recorded_by_email'] = actor.email
        data['recorded_by_id'] = actor.pk
    if notes:
        data['notes'] = notes
    if extra:
        data.update(extra)
    return data
