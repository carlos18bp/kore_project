from datetime import timedelta

import pytest
from django.utils import timezone

from core_app.models import Booking, Package
from core_app.models.physical_test import PhysicalTest


@pytest.mark.django_db
def test_physical_test_result_choices(existing_user):
    test = PhysicalTest.objects.create(
        customer=existing_user,
        performed_at=timezone.localdate(),
        result=PhysicalTest.Result.PASSED,
    )
    assert test.result == 'passed'
    assert test.trainer is None  # nullable


@pytest.mark.django_db
def test_booking_attendance_defaults_to_unset(existing_user):
    package = Package.objects.create(title='P')
    now = timezone.now()
    booking = Booking.objects.create(
        customer=existing_user, package=package,
        starts_at=now, ends_at=now + timedelta(hours=1),
    )
    assert booking.attendance_status == Booking.AttendanceStatus.UNSET
    assert booking.attendance_confirmed_at is None
