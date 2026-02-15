from decimal import Decimal

from django.core.management.base import BaseCommand

from core_app.models import Package


class Command(BaseCommand):
    help = 'Create fake packages'

    def add_arguments(self, parser):
        parser.add_argument('--extra', type=int, default=0)

    def handle(self, *args, **options):
        extra = int(options['extra'])

        cat = Package.Category

        base_packages = [
            # ── Personalizado FLW (1-a-1) ──
            {
                'title': 'Sesión Individual',
                'short_description': 'Sesión individual personalizada con tu entrenador.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 1,
                'session_duration_minutes': 60,
                'price': Decimal('85000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. No reembolsable.',
                'order': 1,
                'is_active': True,
            },
            {
                'title': 'Programa Básico',
                'short_description': 'Plan mensual personalizado, 1 sesión por semana.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('320000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Renovación automática.',
                'order': 2,
                'is_active': True,
            },
            {
                'title': 'Programa Continuidad',
                'short_description': 'Plan intensivo personalizado, 2 sesiones por semana.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 8,
                'session_duration_minutes': 60,
                'price': Decimal('600000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'terms_and_conditions': 'Válido por 60 días. Renovación automática.',
                'order': 3,
                'is_active': True,
            },
            {
                'title': 'Programa Avance',
                'short_description': 'Plan avanzado personalizado, 3 sesiones por semana.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 12,
                'session_duration_minutes': 60,
                'price': Decimal('840000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'terms_and_conditions': 'Válido por 60 días. Renovación automática.',
                'order': 4,
                'is_active': True,
            },
            {
                'title': 'Programa Consolidación',
                'short_description': 'Plan de consolidación personalizado.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 16,
                'session_duration_minutes': 60,
                'price': Decimal('1040000.00'),
                'currency': 'COP',
                'validity_days': 90,
                'terms_and_conditions': 'Válido por 90 días. Renovación automática.',
                'order': 5,
                'is_active': True,
            },
            {
                'title': 'Programa Integral',
                'short_description': 'Plan integral personalizado.',
                'category': cat.PERSONALIZADO,
                'sessions_count': 20,
                'session_duration_minutes': 60,
                'price': Decimal('1200000.00'),
                'currency': 'COP',
                'validity_days': 90,
                'terms_and_conditions': 'Válido por 90 días. Renovación automática.',
                'order': 6,
                'is_active': True,
            },
            # ── Semi-personalizado FLW (2-3 personas) ──
            {
                'title': 'Programa Inicial',
                'short_description': 'Grupos reducidos de hasta 3 personas, 1 sesión/semana.',
                'category': cat.SEMI_PERSONALIZADO,
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('240000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Máximo 3 participantes por sesión.',
                'order': 7,
                'is_active': True,
            },
            {
                'title': 'Programa Continuidad',
                'short_description': 'Plan intensivo en grupo reducido, 2 sesiones/semana.',
                'category': cat.SEMI_PERSONALIZADO,
                'sessions_count': 8,
                'session_duration_minutes': 60,
                'price': Decimal('440000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Válido por 30 días. Máximo 3 participantes por sesión.',
                'order': 8,
                'is_active': True,
            },
            {
                'title': 'Programa Avance',
                'short_description': 'Plan avanzado en grupo reducido, 3 sesiones/semana.',
                'category': cat.SEMI_PERSONALIZADO,
                'sessions_count': 12,
                'session_duration_minutes': 60,
                'price': Decimal('600000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'terms_and_conditions': 'Válido por 60 días. Máximo 3 participantes por sesión.',
                'order': 9,
                'is_active': True,
            },
            {
                'title': 'Programa Consolidación',
                'short_description': 'Plan de consolidación en grupo reducido.',
                'category': cat.SEMI_PERSONALIZADO,
                'sessions_count': 16,
                'session_duration_minutes': 60,
                'price': Decimal('760000.00'),
                'currency': 'COP',
                'validity_days': 90,
                'terms_and_conditions': 'Válido por 90 días. Máximo 3 participantes por sesión.',
                'order': 10,
                'is_active': True,
            },
            {
                'title': 'Programa Integral',
                'short_description': 'Plan integral en grupo reducido.',
                'category': cat.SEMI_PERSONALIZADO,
                'sessions_count': 20,
                'session_duration_minutes': 60,
                'price': Decimal('900000.00'),
                'currency': 'COP',
                'validity_days': 90,
                'terms_and_conditions': 'Válido por 90 días. Máximo 3 participantes por sesión.',
                'order': 11,
                'is_active': True,
            },
            # ── Terapéutico FLW ──
            {
                'title': 'Sesión Terapéutica',
                'short_description': 'Sesión individual terapéutica.',
                'category': cat.TERAPEUTICO,
                'sessions_count': 1,
                'session_duration_minutes': 60,
                'price': Decimal('95000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 30 días.',
                'order': 12,
                'is_active': True,
            },
            {
                'title': 'Programa Terapéutico',
                'short_description': 'Enfoque en rehabilitación y movilidad articular.',
                'category': cat.TERAPEUTICO,
                'sessions_count': 4,
                'session_duration_minutes': 60,
                'price': Decimal('360000.00'),
                'currency': 'COP',
                'validity_days': 30,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 30 días.',
                'order': 13,
                'is_active': True,
            },
            {
                'title': 'Programa Recuperación',
                'short_description': 'Programa completo de rehabilitación, 2 sesiones/semana.',
                'category': cat.TERAPEUTICO,
                'sessions_count': 8,
                'session_duration_minutes': 60,
                'price': Decimal('680000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 60 días.',
                'order': 14,
                'is_active': True,
            },
            {
                'title': 'Programa Funcional',
                'short_description': 'Programa funcional terapéutico, 3 sesiones/semana.',
                'category': cat.TERAPEUTICO,
                'sessions_count': 12,
                'session_duration_minutes': 60,
                'price': Decimal('960000.00'),
                'currency': 'COP',
                'validity_days': 60,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 60 días.',
                'order': 15,
                'is_active': True,
            },
            {
                'title': 'Programa Integral',
                'short_description': 'Programa integral terapéutico.',
                'category': cat.TERAPEUTICO,
                'sessions_count': 20,
                'session_duration_minutes': 60,
                'price': Decimal('1500000.00'),
                'currency': 'COP',
                'validity_days': 90,
                'terms_and_conditions': 'Requiere valoración inicial. Válido por 90 días.',
                'order': 16,
                'is_active': True,
            },
        ]

        created = 0
        for p in base_packages:
            _, was_created = Package.objects.get_or_create(
                title=p['title'],
                category=p['category'],
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
