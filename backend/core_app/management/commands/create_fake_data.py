from django.core.management import call_command
from django.core.management.base import BaseCommand


class Command(BaseCommand):
    help = 'Create fake data for KÓRE in dependency order'

    def add_arguments(self, parser):
        parser.add_argument('--customers', type=int, default=20)
        parser.add_argument('--password', type=str, default='password')
        parser.add_argument('--admin-email', type=str, default='admin@kore.com')
        parser.add_argument('--admin-password', type=str, default='password')
        parser.add_argument('--no-admin', action='store_true', default=False)
        parser.add_argument('--skip-users', action='store_true', default=False)

        parser.add_argument('--skip-content', action='store_true', default=False)

        parser.add_argument('--trainer-password', type=str, default='password')
        parser.add_argument('--skip-trainers', action='store_true', default=False)

        parser.add_argument('--extra-packages', type=int, default=0)
        parser.add_argument('--skip-packages', action='store_true', default=False)

        parser.add_argument('--skip-subscriptions', action='store_true', default=False)
        parser.add_argument(
            '--no-ensure-inactive',
            action='store_true',
            default=False,
            help='Do not force at least one inactive subscription per customer.',
        )

        parser.add_argument('--skip-duo', action='store_true', default=False)

        parser.add_argument('--bookings', type=int, default=120)
        parser.add_argument('--skip-bookings', action='store_true', default=False)

        parser.add_argument('--payments', type=int, default=120)
        parser.add_argument('--skip-payments', action='store_true', default=False)

        parser.add_argument('--notifications', type=int, default=80)
        parser.add_argument('--skip-notifications', action='store_true', default=False)

        parser.add_argument('--analytics-events', type=int, default=200)
        parser.add_argument('--skip-analytics-events', action='store_true', default=False)

        parser.add_argument('--diagnostics-per-customer', type=int, default=2)
        parser.add_argument('--skip-diagnostics', action='store_true', default=False)

        parser.add_argument(
            '--spotlight-emails', type=str, default='customer1@kore.com',
            help='Comma-separated emails to receive a deep historical journey (after random seed).',
        )
        parser.add_argument(
            '--spotlight-months', type=int, default=6,
            help='Months of history to generate for spotlight customers (default: 6).',
        )
        parser.add_argument('--skip-spotlight', action='store_true', default=False)

        parser.add_argument('--programs-per-customer', type=int, default=1)
        parser.add_argument('--skip-programs', action='store_true', default=False)

        parser.add_argument('--nutrition-days', type=int, default=14)
        parser.add_argument('--skip-nutrition-daily', action='store_true', default=False)

        parser.add_argument('--nutrition-plans-per-customer', type=int, default=1)
        parser.add_argument('--skip-nutrition-plans', action='store_true', default=False)

        parser.add_argument('--trainer-messages-per-customer', type=int, default=2)
        parser.add_argument('--skip-trainer-intelligence', action='store_true', default=False)

        parser.add_argument('--skip-tracking', action='store_true', default=False)

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

        if not options['skip_trainers']:
            call_command(
                'create_fake_trainers',
                password=options['trainer_password'],
                stdout=self.stdout,
            )
            executed.append('trainers')
        else:
            self.stdout.write(self.style.WARNING('Skipped trainers'))

        if not options['skip_packages']:
            call_command('create_fake_packages', extra=options['extra_packages'], stdout=self.stdout)
            executed.append('packages')
        else:
            self.stdout.write(self.style.WARNING('Skipped packages'))

        if not options['skip_subscriptions']:
            call_command(
                'create_fake_subscriptions',
                ensure_inactive=not options['no_ensure_inactive'],
                stdout=self.stdout,
            )
            executed.append('subscriptions')
        else:
            self.stdout.write(self.style.WARNING('Skipped subscriptions'))

        if not options['skip_duo']:
            call_command('create_fake_duo_invitations', stdout=self.stdout)
            executed.append('duo_invitations')
        else:
            self.stdout.write(self.style.WARNING('Skipped duo invitations'))

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

        if not options['skip_diagnostics']:
            call_command(
                'create_fake_diagnostics',
                per_customer=options['diagnostics_per_customer'],
                stdout=self.stdout,
            )
            executed.append('diagnostics')
        else:
            self.stdout.write(self.style.WARNING('Skipped diagnostics'))

        if not options['skip_spotlight']:
            spotlight_emails = [
                e.strip() for e in options['spotlight_emails'].split(',') if e.strip()
            ]
            for email in spotlight_emails:
                call_command(
                    'create_fake_customer_history',
                    email=email,
                    months=options['spotlight_months'],
                    stdout=self.stdout,
                )
            if spotlight_emails:
                executed.append(f"spotlight ({', '.join(spotlight_emails)})")
        else:
            self.stdout.write(self.style.WARNING('Skipped spotlight customer history'))

        if not options['skip_programs']:
            call_command(
                'create_fake_programs',
                per_customer=options['programs_per_customer'],
                stdout=self.stdout,
            )
            executed.append('programs')
        else:
            self.stdout.write(self.style.WARNING('Skipped programs'))

        if not options['skip_nutrition_daily']:
            call_command(
                'create_fake_nutrition_daily',
                days=options['nutrition_days'],
                stdout=self.stdout,
            )
            executed.append('nutrition_daily')
        else:
            self.stdout.write(self.style.WARNING('Skipped nutrition daily'))

        if not options['skip_nutrition_plans']:
            call_command(
                'create_fake_nutrition_plans',
                per_customer=options['nutrition_plans_per_customer'],
                stdout=self.stdout,
            )
            executed.append('nutrition_plans')
        else:
            self.stdout.write(self.style.WARNING('Skipped nutrition plans'))

        if not options['skip_trainer_intelligence']:
            call_command(
                'create_fake_trainer_intelligence',
                messages_per_customer=options['trainer_messages_per_customer'],
                stdout=self.stdout,
            )
            executed.append('trainer_intelligence')
        else:
            self.stdout.write(self.style.WARNING('Skipped trainer intelligence'))

        if not options['skip_tracking']:
            call_command('create_fake_tracking', stdout=self.stdout)
            executed.append('tracking')
        else:
            self.stdout.write(self.style.WARNING('Skipped tracking'))

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
