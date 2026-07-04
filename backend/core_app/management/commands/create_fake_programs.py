"""Create fake monthly training programs for development and testing.

Populates the Monthly Tracking domain that ``create_fake_data`` omits:
MonthlyProgram / ProgramDay / ProgramExercise (via the real
``program_generator`` service), plus ProgramWeekNote, DailyLog and
ExerciseLog so the trainer intelligence and adherence surfaces have data.

Depends on the Exercise catalog (run ``import_exercises`` first) and on the
customers created by ``create_fake_users``.  Re-running is safe: customers
that already own a program are skipped unless ``--reset`` is passed.
"""

import random
from datetime import timedelta

from django.core.management.base import BaseCommand
from django.utils import timezone

from core_app.models import (
    DailyLog,
    Exercise,
    ExerciseLog,
    MonthlyProgram,
    ProgramWeekNote,
    User,
)
from core_app.models.monthly_program import ProgramDay
from core_app.services.program_generator import generate_monthly_program

# Realistic weekly coaching notes (weeks 1-4 of a 28-day cycle).
WEEK_NOTES = [
    'Semana de adaptación: enfocá la técnica antes que la carga.',
    'Subimos volumen. Cuidá el descanso entre series.',
    'Semana de mayor intensidad. Priorizá la movilidad en el calentamiento.',
    'Descarga: bajamos carga para consolidar y recuperar.',
]

# Weighted exercise-completion distribution (mostly done, some misses).
STATUS_CHOICES = [
    (ExerciseLog.Status.COMPLETED, 70),
    (ExerciseLog.Status.SKIPPED, 15),
    (ExerciseLog.Status.NOT_DONE, 15),
]

# The newest program starts this many days before today so most of its
# days already elapsed (producing past DailyLogs) while a few remain future.
NEWEST_START_OFFSET_DAYS = 21
PROGRAM_LENGTH_DAYS = 28


class Command(BaseCommand):
    help = 'Create fake monthly training programs (with daily logs) for all customers'

    def add_arguments(self, parser):
        parser.add_argument(
            '--per-customer', type=int, default=1,
            help='Number of consecutive 28-day programs per customer (default: 1).',
        )
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed for reproducible programs.',
        )
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Delete existing programs/logs for customers before creating new ones.',
        )

    def handle(self, *args, **options):
        seed = options.get('seed')
        if seed is not None:
            random.seed(seed)

        per_customer = max(int(options['per_customer']), 1)
        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return

        if not Exercise.objects.filter(is_active=True).exists():
            self.stdout.write(self.style.WARNING(
                'No active exercises found. Run import_exercises first.'
            ))
            return

        if options['reset']:
            customer_ids = [c.pk for c in customers]
            DailyLog.objects.filter(customer_id__in=customer_ids).delete()
            MonthlyProgram.objects.filter(customer_id__in=customer_ids).delete()
            self.stdout.write(self.style.WARNING('Existing programs and daily logs deleted.'))

        counts = {'programs': 0, 'week_notes': 0, 'daily_logs': 0, 'exercise_logs': 0}
        today = timezone.localdate()
        now = timezone.now()
        newest_start = today - timedelta(days=NEWEST_START_OFFSET_DAYS)

        for customer in customers:
            if MonthlyProgram.objects.filter(customer=customer).exists():
                continue

            for cycle_index in range(per_customer):
                cycles_from_newest = per_customer - 1 - cycle_index
                start_date = newest_start - timedelta(days=PROGRAM_LENGTH_DAYS * cycles_from_newest)

                program = generate_monthly_program(customer.pk, start_date=start_date)
                program.status = MonthlyProgram.Status.PUBLISHED
                program.approved_at = now
                program.save(update_fields=['status', 'approved_at'])
                counts['programs'] += 1

                for week_number in range(1, 5):
                    _, created = ProgramWeekNote.objects.get_or_create(
                        program=program,
                        week_number=week_number,
                        defaults={'notes': WEEK_NOTES[week_number - 1]},
                    )
                    if created:
                        counts['week_notes'] += 1

                counts_delta = self._log_elapsed_days(customer, program, today, now)
                counts['daily_logs'] += counts_delta[0]
                counts['exercise_logs'] += counts_delta[1]

        self.stdout.write(self.style.SUCCESS('Monthly programs:'))
        self.stdout.write(f"- programs_created: {counts['programs']}")
        self.stdout.write(f"- week_notes_created: {counts['week_notes']}")
        self.stdout.write(f"- daily_logs_created: {counts['daily_logs']}")
        self.stdout.write(f"- exercise_logs_created: {counts['exercise_logs']}")
        self.stdout.write(f"- total_customers_processed: {len(customers)}")

    def _log_elapsed_days(self, customer, program, today, now):
        """Create DailyLog + ExerciseLog rows for the program's past, non-rest days."""
        daily_logs_created = 0
        exercise_logs_created = 0

        statuses = [s for s, _ in STATUS_CHOICES]
        weights = [w for _, w in STATUS_CHOICES]

        program_days = (
            program.days
            .filter(date__lte=today)
            .exclude(day_type=ProgramDay.DayType.REST)
            .prefetch_related('exercises')
        )
        for program_day in program_days:
            daily_log, created = DailyLog.objects.get_or_create(
                customer=customer,
                date=program_day.date,
                defaults={
                    'program': program,
                    'is_closed': program_day.date < today,
                    'closed_at': now if program_day.date < today else None,
                },
            )
            if created:
                daily_logs_created += 1

            for program_exercise in program_day.exercises.all():
                status = random.choices(statuses, weights=weights, k=1)[0]
                _, ex_created = ExerciseLog.objects.get_or_create(
                    daily_log=daily_log,
                    program_exercise=program_exercise,
                    defaults={'status': status},
                )
                if ex_created:
                    exercise_logs_created += 1

        return daily_logs_created, exercise_logs_created
