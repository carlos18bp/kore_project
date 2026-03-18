"""Management command to resend booking invitations with corrected timezone.

This command identifies bookings that were confirmed before the timezone fix
and resends the calendar invitations with proper America/Bogota timezone.
"""

from datetime import datetime
from django.core.management.base import BaseCommand, CommandError
from django.utils import timezone

from core_app.models import Booking
from core_app.services.email_service import send_template_email
from core_app.services.ics_generator import generate_ics


class Command(BaseCommand):
    help = 'Resend booking calendar invitations with corrected timezone to affected customers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--before',
            type=str,
            help='Resend invites for bookings created before this date (YYYY-MM-DD). Defaults to today.',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be sent without actually sending emails.',
        )
        parser.add_argument(
            '--booking-id',
            type=int,
            help='Resend invite for a specific booking ID only.',
        )

    def handle(self, *args, **options):
        dry_run = options.get('dry_run', False)
        booking_id = options.get('booking_id')
        before_date_str = options.get('before')

        # Determine cutoff date
        if before_date_str:
            try:
                before_date = datetime.strptime(before_date_str, '%Y-%m-%d')
                before_date = timezone.make_aware(before_date)
            except ValueError:
                raise CommandError('Invalid date format. Use YYYY-MM-DD.')
        else:
            before_date = timezone.now()

        # Build queryset
        queryset = Booking.objects.filter(
            status__in=[Booking.Status.CONFIRMED, Booking.Status.PENDING],
            slot__starts_at__gte=timezone.now(),  # Only future sessions
        ).select_related('customer', 'trainer__user', 'slot', 'package')

        if booking_id:
            queryset = queryset.filter(pk=booking_id)
        else:
            queryset = queryset.filter(created_at__lt=before_date)

        bookings = list(queryset.order_by('slot__starts_at'))

        if not bookings:
            self.stdout.write(self.style.WARNING('No bookings found matching criteria.'))
            return

        self.stdout.write(f'Found {len(bookings)} booking(s) to process.')

        success_count = 0
        error_count = 0

        for booking in bookings:
            customer = booking.customer
            slot = booking.slot
            trainer = booking.trainer

            customer_name = f'{customer.first_name} {customer.last_name}'.strip() or customer.email
            trainer_name = ''
            if trainer:
                trainer_name = f'{trainer.user.first_name} {trainer.user.last_name}'.strip()

            # Format slot time for display
            slot_display = slot.starts_at.strftime('%Y-%m-%d %H:%M')

            self.stdout.write(f'  Booking #{booking.pk}: {customer_name} - {slot_display}')

            if dry_run:
                self.stdout.write(self.style.NOTICE('    [DRY RUN] Would send corrected invite'))
                success_count += 1
                continue

            try:
                # Generate corrected ICS
                ics_bytes = generate_ics(booking)

                # Build recipient list (customer + trainer if available)
                recipients = [customer.email]
                if trainer and trainer.user.email:
                    trainer_email = trainer.user.email.strip().lower()
                    if trainer_email and trainer_email != customer.email.strip().lower():
                        recipients.append(trainer.user.email)

                # Build context
                context = {
                    'customer_name': customer_name,
                    'customer_email': customer.email,
                    'trainer_name': trainer_name or 'Por asignar',
                    'location': trainer.location if trainer else 'Por confirmar',
                    'package_title': booking.package.title if booking.package else '',
                    'slot_start': slot.starts_at,
                    'slot_end': slot.ends_at,
                    'booking_id': booking.pk,
                }

                # Send corrected email
                success = send_template_email(
                    template_name='booking_confirmation',
                    subject='[Actualización] Tu sesión ha sido agendada — KÓRE',
                    to_emails=recipients,
                    context=context,
                    attachments=[('session.ics', ics_bytes, 'text/calendar')],
                )

                if success:
                    self.stdout.write(self.style.SUCCESS(f'    ✓ Sent to {", ".join(recipients)}'))
                    success_count += 1
                else:
                    self.stdout.write(self.style.ERROR('    ✗ Failed to send'))
                    error_count += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(f'    ✗ Error: {e}'))
                error_count += 1

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'Completed: {success_count} sent, {error_count} errors'))

        if dry_run:
            self.stdout.write(self.style.NOTICE('This was a dry run. No emails were actually sent.'))
