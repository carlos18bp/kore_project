import pytest
from datetime import timedelta
from decimal import Decimal

from django.urls import reverse
from django.utils import timezone
from rest_framework import status

from core_app.models import AvailabilitySlot, Booking, Package, Payment, User
from core_app.tests.helpers import get_results


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='pv_cust@example.com', password='p')


@pytest.fixture
def other_customer(db):
    return User.objects.create_user(email='pv_other@example.com', password='p')


@pytest.fixture
def booking(db, customer):
    pkg = Package.objects.create(title='Pkg', price=Decimal('100000.00'))
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.mark.django_db
def test_payment_create_requires_login(api_client, booking):
    url = reverse('payment-list')
    response = api_client.post(url, {'booking_id': booking.id}, format='json')
    assert response.status_code in (status.HTTP_401_UNAUTHORIZED, status.HTTP_403_FORBIDDEN)


@pytest.mark.django_db
def test_payment_create_success(api_client, customer, booking):
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
    api_client.force_authenticate(user=other_customer)
    url = reverse('payment-list')
    response = api_client.post(url, {'booking_id': booking.id}, format='json')
    assert response.status_code == status.HTTP_400_BAD_REQUEST


@pytest.mark.django_db
def test_payment_list_returns_only_own_for_customer(api_client, customer, other_customer, booking):
    Payment.objects.create(booking=booking, customer=customer, amount=Decimal('100000.00'))

    now = timezone.now()
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
    Payment.objects.create(booking=booking, customer=customer, amount=Decimal('100000.00'))

    now = timezone.now()
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
    payment = Payment.objects.create(booking=booking, customer=customer)
    api_client.force_authenticate(user=customer)
    url = reverse('payment-detail', args=[payment.id])
    response = api_client.patch(url, {'status': 'confirmed'}, format='json')
    assert response.status_code == status.HTTP_403_FORBIDDEN


@pytest.mark.django_db
def test_payment_update_allowed_for_admin(api_client, admin_user, customer, booking):
    payment = Payment.objects.create(booking=booking, customer=customer)
    api_client.force_authenticate(user=admin_user)
    url = reverse('payment-detail', args=[payment.id])
    response = api_client.patch(url, {'status': 'confirmed'}, format='json')
    assert response.status_code == status.HTTP_200_OK
    payment.refresh_from_db()
    assert payment.status == Payment.Status.CONFIRMED
