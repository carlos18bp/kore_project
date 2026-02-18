"""Management command to create fake trainer users and their profiles."""

from django.core.management.base import BaseCommand

from core_app.models import TrainerProfile, User


class Command(BaseCommand):
    """Create a trainer user and associated TrainerProfile.

    By default creates Germán Eduardo Franco Moreno as the single KÓRE
    trainer.  Idempotent — skips creation if the email already exists.
    """

    help = 'Create fake trainer user(s) with TrainerProfile'

    def add_arguments(self, parser):
        parser.add_argument('--password', type=str, default='ogthsv25')

    def handle(self, *args, **options):
        password = options['password']
        created_users = 0
        created_profiles = 0

        trainers_data = [
            {
                'email': 'german.franco@kore.com',
                'first_name': 'Germán Eduardo',
                'last_name': 'Franco Moreno',
                'specialty': 'Entrenamiento funcional y bienestar',
                'bio': (
                    'Entrenador certificado con más de 10 años de experiencia '
                    'en entrenamiento funcional, rehabilitación deportiva y '
                    'bienestar integral.'
                ),
                'location': 'KÓRE Studio — Calle 93 #11-26, Bogotá',
                'session_duration_minutes': 60,
            },
        ]

        for data in trainers_data:
            user, user_created = User.objects.get_or_create(
                email=data['email'],
                defaults={
                    'first_name': data['first_name'],
                    'last_name': data['last_name'],
                    'role': User.Role.TRAINER,
                },
            )
            if user_created:
                user.set_password(password)
                user.save(update_fields=['password'])
                created_users += 1
            elif user.role != User.Role.TRAINER:
                user.role = User.Role.TRAINER
                user.save(update_fields=['role'])

            profile, profile_created = TrainerProfile.objects.get_or_create(
                user=user,
                defaults={
                    'specialty': data['specialty'],
                    'bio': data['bio'],
                    'location': data['location'],
                    'session_duration_minutes': data['session_duration_minutes'],
                },
            )
            if profile_created:
                created_profiles += 1

        self.stdout.write(self.style.SUCCESS('Trainers:'))
        self.stdout.write(f'- users_created: {created_users}')
        self.stdout.write(f'- profiles_created: {created_profiles}')
        self.stdout.write(f'- total_trainers: {TrainerProfile.objects.count()}')
