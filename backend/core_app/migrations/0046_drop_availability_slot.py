"""Drop AvailabilitySlot; make Booking.starts_at/ends_at NOT NULL; remove slot FK."""

import django.db.models.deletion
from django.db import migrations, models
from django.utils import timezone


def _fill_null_booking_times(apps, schema_editor):
    """Fill any Booking rows that still have NULL starts_at/ends_at.

    Migration 0044 should have backfilled all existing rows. This guard
    covers edge cases (rows created between migrations on a live system).
    """
    Booking = apps.get_model('core_app', 'Booking')
    now = timezone.now()
    # Prefer copying from the slot FK if it still exists in the ORM state
    for booking in Booking.objects.filter(starts_at__isnull=True).select_related('slot'):
        if booking.slot_id and booking.slot:
            booking.starts_at = booking.slot.starts_at
            booking.ends_at = booking.slot.ends_at
        else:
            booking.starts_at = now
            booking.ends_at = now + __import__('datetime').timedelta(hours=1)
        booking.save(update_fields=['starts_at', 'ends_at'])


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0045_booking_slot_nullable'),
    ]

    operations = [
        # 1. Ensure no NULLs remain before we enforce NOT NULL
        migrations.RunPython(_fill_null_booking_times, migrations.RunPython.noop),

        # 2. Make starts_at / ends_at NOT NULL
        migrations.AlterField(
            model_name='booking',
            name='starts_at',
            field=models.DateTimeField(db_index=True),
        ),
        migrations.AlterField(
            model_name='booking',
            name='ends_at',
            field=models.DateTimeField(db_index=True),
        ),

        # 3. Remove the slot FK from Booking
        migrations.RemoveField(
            model_name='booking',
            name='slot',
        ),

        # 4. Drop the AvailabilitySlot table
        migrations.DeleteModel(
            name='AvailabilitySlot',
        ),
    ]
