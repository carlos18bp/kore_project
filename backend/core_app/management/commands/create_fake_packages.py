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
            # Personalizado
            {
                'title': 'Personalizado — 1 sesión',
                'short_description': 'Sesión individual personalizada con tu entrenador.',
                'sessions_count': 1,
                'session_duration_minutes': 60,
                'price': Decimal('120000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. No reembolsable.',
                'order': 1,
                'is_active': True,
            },
            {
                'title': 'Personalizado — 4 sesiones',
                'short_description': 'Plan mensual personalizado, 1 sesión por semana.',
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('400000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Renovación automática.',
                'order': 2,
                'is_active': True,
            },
            {
                'title': 'Personalizado — 8 sesiones',
                'short_description': 'Plan intensivo personalizado, 2 sesiones por semana.',
                'sessions_count': 8,
                'session_duration_minutes': 60,
                'price': Decimal('720000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Renovación automática.',
                'order': 3,
                'is_active': True,
            },
            # Semi-personalizado
            {
                'title': 'Semi-personalizado — 4 sesiones',
                'short_description': 'Grupos reducidos de hasta 3 personas.',
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('280000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Máximo 3 participantes por sesión.',
                'order': 4,
                'is_active': True,
            },
            {
                'title': 'Semi-personalizado — 8 sesiones',
                'short_description': 'Plan intensivo en grupo reducido.',
                'sessions_count': 8,
                'session_duration_minutes': 60,
                'price': Decimal('480000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Máximo 3 participantes por sesión.',
                'order': 5,
                'is_active': True,
            },
            # Terapéutico
            {
                'title': 'Terapéutico — 4 sesiones',
                'short_description': 'Enfoque en rehabilitación y movilidad articular.',
                'sessions_count': 4,
                'session_duration_minutes': 45,
                'price': Decimal('360000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 30 días.',
                'order': 6,
                'is_active': True,
            },
            {
                'title': 'Terapéutico — 12 sesiones',
                'short_description': 'Programa completo de rehabilitación, 3 sesiones por semana.',
                'sessions_count': 12,
                'session_duration_minutes': 45,
                'price': Decimal('1080000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 30 días.',
                'order': 7,
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
