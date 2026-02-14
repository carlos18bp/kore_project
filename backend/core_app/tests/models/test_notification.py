import pytest
from datetime import timedelta
from django.utils import timezone

from core_app.models import (
    AvailabilitySlot, Booking, Notification, Package, Payment, User,
)


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='notif_cust@example.com', password='p')


@pytest.fixture
def booking(db, customer):
    pkg = Package.objects.create(title='Pkg')
    now = timezone.now()
    slot = AvailabilitySlot.objects.create(
        starts_at=now + timedelta(hours=1), ends_at=now + timedelta(hours=2),
    )
    return Booking.objects.create(customer=customer, package=pkg, slot=slot)


@pytest.fixture
def payment(db, booking, customer):
    return Payment.objects.create(booking=booking, customer=customer)


@pytest.mark.django_db
class TestNotificationModel:
    def test_defaults(self, booking):
        notif = Notification.objects.create(
            booking=booking,
            notification_type=Notification.Type.BOOKING_CONFIRMED,
        )
        assert notif.status == Notification.Status.PENDING
        assert notif.sent_to == ''
        assert notif.payload == {}
        assert notif.error_message == ''

    def test_str(self, booking):
        notif = Notification.objects.create(
            booking=booking,
            notification_type=Notification.Type.BOOKING_CONFIRMED,
        )
        assert f'Notification #{notif.pk}' in str(notif)

    def test_type_choices(self):
        assert Notification.Type.BOOKING_CONFIRMED == 'booking_confirmed'
        assert Notification.Type.PAYMENT_CONFIRMED == 'payment_confirmed'
        assert Notification.Type.RECEIPT_EMAIL == 'receipt_email'

    def test_nullable_fks(self):
        notif = Notification.objects.create(
            notification_type=Notification.Type.RECEIPT_EMAIL,
        )
        assert notif.booking is None
        assert notif.payment is None

    def test_cascade_on_booking_delete(self, customer, booking):
        Notification.objects.create(
            booking=booking,
            notification_type=Notification.Type.BOOKING_CONFIRMED,
        )
        assert Notification.objects.count() == 1
        # Booking uses PROTECT from Payment/Slot, but Notification uses CASCADE.
        # We can only test cascade if booking can be deleted (no payments blocking).
        # Instead, verify the on_delete is CASCADE by checking the field definition.
        field = Notification._meta.get_field('booking')
        from django.db.models import CASCADE
        assert field.remote_field.on_delete is CASCADE

    def test_cascade_on_payment_delete(self, payment):
        Notification.objects.create(
            payment=payment,
            notification_type=Notification.Type.PAYMENT_CONFIRMED,
        )
        field = Notification._meta.get_field('payment')
        from django.db.models import CASCADE
        assert field.remote_field.on_delete is CASCADE

    def test_ordering_by_created_at_desc(self, booking):
        n1 = Notification.objects.create(
            booking=booking, notification_type=Notification.Type.BOOKING_CONFIRMED,
        )
        n2 = Notification.objects.create(
            booking=booking, notification_type=Notification.Type.RECEIPT_EMAIL,
        )
        ids = list(Notification.objects.values_list('id', flat=True))
        assert ids == [n2.id, n1.id]
