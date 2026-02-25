"""API view tests for payment creation, listing, and update permissions."""

from datetime import datetime, timedelta
from decimal import Decimal

import pytest
from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot, Booking, Package, Payment, User
from core_app.tests.helpers import get_results

FIXED_NOW = timezone.make_aware(datetime(2024, 1, 15, 10, 0, 0))


@pytest.fixture
def customer(db):
    """Create a customer user for payment view authentication checks."""
    return User.objects.create_user(email='pv_cust@example.com', password='p')


@pytest.fixture
def other_customer(db):
    """Create a second customer used for ownership filtering assertions."""
    return User.objects.create_user(email='pv_other@example.com', password='p')


@pytest.fixture
def booking(db, customer):
    """Create a booking fixture that can be paid through the API."""
    pkg = Package.objects.create(title='Pkg', price=Decimal('100000.00'))
    now = FIXED_NOW
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
def test_payment_create_requires_login(api_client, booking):
    """Reject payment creation when the request is unauthenticated."""
    url = reverse('payment-list')
    response = api_client.post(url, {'booking_id': booking.id}, format='json')
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_payment_create_success(api_client, customer, booking):
    """Create a payment successfully when customer pays their own booking."""
    api_client.force_authenticate(user=customer)
    url = reverse('payment-list')
    response = api_client.post(url, {'booking_id': booking.id}, format='json')
    assert response.status_code == status.HTTP_201_CREATED
    assert Payment.objects.count() == 1
    payment = Payment.objects.first()
    assert payment.customer == customer
    assert payment.amount == Decimal('100000.00')


@pytest.mark.django_db
def test_payment_create_rejects_other_users_booking(api_client, other_customer, booking):
    """Reject payment creation when customer targets another user's booking."""
    api_client.force_authenticate(user=other_customer)
    url = reverse('payment-list')
    response = api_client.post(url, {'booking_id': booking.id}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_payment_list_returns_only_own_for_customer(api_client, customer, other_customer, booking):
    """Restrict payment list results to records owned by the authenticated customer."""
    Payment.objects.create(booking=booking, customer=customer, amount=Decimal('100000.00'))

    now = FIXED_NOW
    pkg2 = Package.objects.create(title='Pkg2')
    slot2 = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4),
    )
    b2 = Booking.objects.create(customer=other_customer, package=pkg2, slot=slot2)
    Payment.objects.create(booking=b2, customer=other_customer, amount=Decimal('50000.00'))

    api_client.force_authenticate(user=customer)
    url = reverse('payment-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 1


@pytest.mark.django_db
def test_payment_list_returns_all_for_admin(api_client, admin_user, customer, other_customer, booking):
    """Allow admin users to list payments across different customers."""
    Payment.objects.create(booking=booking, customer=customer, amount=Decimal('100000.00'))

    now = FIXED_NOW
    pkg2 = Package.objects.create(title='Pkg2')
    slot2 = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=3), ends_at=now + timedelta(hours=4),
    )
    b2 = Booking.objects.create(customer=other_customer, package=pkg2, slot=slot2)
    Payment.objects.create(booking=b2, customer=other_customer, amount=Decimal('50000.00'))

    api_client.force_authenticate(user=admin_user)
    url = reverse('payment-list')
    response = api_client.get(url)
    assert response.status_code == status.HTTP_200_OK
    assert len(get_results(response.data)) == 2


@pytest.mark.django_db
def test_payment_update_requires_admin(api_client, customer, booking):
    """Block payment status updates initiated by non-admin customers."""
    payment = Payment.objects.create(booking=booking, customer=customer)
    api_client.force_authenticate(user=customer)
    url = reverse('payment-detail', args=[payment.id])
    response = api_client.patch(url, {'status': 'confirmed'}, format='json')
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_payment_update_allowed_for_admin(api_client, admin_user, customer, booking):
    """Allow admin users to update payment status through the detail endpoint."""
    payment = Payment.objects.create(booking=booking, customer=customer)
    api_client.force_authenticate(user=admin_user)
    url = reverse('payment-detail', args=[payment.id])
    response = api_client.patch(url, {'status': 'confirmed'}, format='json')
    assert response.status_code == status.HTTP_200_OK
    payment.refresh_from_db()
    assert payment.status == Payment.Status.CONFIRMED
