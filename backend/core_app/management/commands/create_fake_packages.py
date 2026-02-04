from decimal import Decimal

from django.core.management.base import BaseCommand

from core_app.models import Package


class Command(BaseCommand):
    help = 'Create fake packages'

    def add_arguments(self, parser):
        parser.add_argument('--extra', type=int, default=0)

    def handle(self, *args, **options):
        extra = int(options['extra'])

        base_packages = [
            {
                'title': 'Paquete Inicial',
                'short_description': 'Ideal para empezar',
                'sessions_count': 1,
                'session_duration_minutes': 60,
                'price': Decimal('100000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'order': 1,
                'is_active': True,
            },
            {
                'title': 'Paquete Pro',
                'short_description': 'Más sesiones y mejor precio',
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('360000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'order': 2,
                'is_active': True,
            },
        ]

        created = 0
        for p in base_packages:
            _, was_created = Package.objects.get_or_create(
                title=p['title'],
                defaults=p,
            )
            if was_created:
                created += 1

        for i in range(1, extra + 1):
            title = f'Paquete Extra {i}'
            _, was_created = Package.objects.get_or_create(
                title=title,
                defaults={
                    'short_description': 'Paquete adicional para pruebas',
                    'sessions_count': 1,
                    'session_duration_minutes': 60,
                    'price': Decimal('90000.00'),
                    'currency': 'COP',
                    'validity_days': 30,
                    'order': 100 + i,
                    'is_active': True,
                },
            )
            if was_created:
                created += 1

        self.stdout.write(self.style.SUCCESS('Packages:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {Package.objects.count()}')
