from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create fake data for KÓRE in dependency order'

    def add_arguments(self, parser):
        parser.add_argument('--customers', type=int, default=10)
        parser.add_argument('--password', type=str, default='customer123456')
        parser.add_argument('--admin-email', type=str, default='admin@kore.com')
        parser.add_argument('--admin-password', type=str, default='admin123456')
        parser.add_argument('--no-admin', action='store_true', default=False)
        parser.add_argument('--skip-users', action='store_true', default=False)

        parser.add_argument('--skip-content', action='store_true', default=False)

        parser.add_argument('--extra-packages', type=int, default=0)
        parser.add_argument('--skip-packages', action='store_true', default=False)

        parser.add_argument('--days', type=int, default=14)
        parser.add_argument('--start-hour', type=int, default=9)
        parser.add_argument('--end-hour', type=int, default=18)
        parser.add_argument('--slot-minutes', type=int, default=60)
        parser.add_argument('--timezone', type=str, default=None)
        parser.add_argument('--skip-slots', action='store_true', default=False)

        parser.add_argument('--bookings', type=int, default=20)
        parser.add_argument('--skip-bookings', action='store_true', default=False)

        parser.add_argument('--payments', type=int, default=20)
        parser.add_argument('--skip-payments', action='store_true', default=False)

        parser.add_argument('--notifications', type=int, default=20)
        parser.add_argument('--skip-notifications', action='store_true', default=False)

        parser.add_argument('--analytics-events', type=int, default=50)
        parser.add_argument('--skip-analytics-events', action='store_true', default=False)

    def handle(self, *args, **options):
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Starting fake data creation...'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write('')

        executed = []

        if not options['skip_users']:
            call_command(
                'create_fake_users',
                customers=options['customers'],
                customer_password=options['password'],
                admin_email=options['admin_email'],
                admin_password=options['admin_password'],
                no_admin=options['no_admin'],
                stdout=self.stdout,
            )
            executed.append('users')
        else:
            self.stdout.write(self.style.WARNING('Skipped users'))

        if not options['skip_content']:
            call_command('create_fake_content', stdout=self.stdout)
            executed.append('content')
        else:
            self.stdout.write(self.style.WARNING('Skipped content'))

        if not options['skip_packages']:
            call_command('create_fake_packages', extra=options['extra_packages'], stdout=self.stdout)
            executed.append('packages')
        else:
            self.stdout.write(self.style.WARNING('Skipped packages'))

        if not options['skip_slots']:
            call_command(
                'create_fake_slots',
                days=options['days'],
                start_hour=options['start_hour'],
                end_hour=options['end_hour'],
                slot_minutes=options['slot_minutes'],
                timezone=options['timezone'],
                stdout=self.stdout,
            )
            executed.append('slots')
        else:
            self.stdout.write(self.style.WARNING('Skipped slots'))

        if not options['skip_bookings']:
            call_command('create_fake_bookings', num=options['bookings'], stdout=self.stdout)
            executed.append('bookings')
        else:
            self.stdout.write(self.style.WARNING('Skipped bookings'))

        if not options['skip_payments']:
            call_command('create_fake_payments', num=options['payments'], stdout=self.stdout)
            executed.append('payments')
        else:
            self.stdout.write(self.style.WARNING('Skipped payments'))

        if not options['skip_notifications']:
            call_command('create_fake_notifications', num=options['notifications'], stdout=self.stdout)
            executed.append('notifications')
        else:
            self.stdout.write(self.style.WARNING('Skipped notifications'))

        if not options['skip_analytics_events']:
            call_command('create_fake_analytics_events', num=options['analytics_events'], stdout=self.stdout)
            executed.append('analytics_events')
        else:
            self.stdout.write(self.style.WARNING('Skipped analytics events'))

        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write(self.style.SUCCESS('Fake data creation completed'))
        self.stdout.write(self.style.SUCCESS('=' * 70))
        self.stdout.write('')

        if executed:
            self.stdout.write(self.style.SUCCESS('Executed:'))
            for item in executed:
                self.stdout.write(f'- {item}')
        else:
            self.stdout.write(self.style.WARNING('Nothing executed (all skipped).'))
