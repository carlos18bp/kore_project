from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class MonthlyProgram(TimestampedModel):
    """A 28-day auto-generated workout program assigned to one customer.

    Generated from evaluation data (physical scores, posturometry findings,
    PAR-Q risk, goal).  Trainer reviews and publishes it before the customer
    can see it.  Status flow: draft → published (trainer approves).
    """

    class Status(models.TextChoices):
        DRAFT = 'draft', 'Draft'
        PUBLISHED = 'published', 'Published'
        COMPLETED = 'completed', 'Completed'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='monthly_programs',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='monthly_programs',
    )
    fitness_level = models.PositiveSmallIntegerField()
    goal = models.CharField(max_length=50)
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        db_index=True,
    )
    trainer_notes = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ['-start_date']

    def __str__(self):
        return f'{self.customer} — {self.start_date} (level {self.fitness_level}, {self.status})'


class ProgramDay(TimestampedModel):
    """One day within a MonthlyProgram (training, active rest, or rest)."""

    class DayType(models.TextChoices):
        TRAINING = 'training', 'Training'
        ACTIVE_REST = 'active_rest', 'Active Rest'
        REST = 'rest', 'Rest'

    program = models.ForeignKey(MonthlyProgram, on_delete=models.CASCADE, related_name='days')
    day_number = models.PositiveSmallIntegerField()
    date = models.DateField()
    day_type = models.CharField(max_length=20, choices=DayType.choices)

    class Meta:
        ordering = ['day_number']
        unique_together = [('program', 'day_number')]

    def __str__(self):
        return f'Day {self.day_number} ({self.day_type})'


class ProgramExercise(TimestampedModel):
    """An exercise prescribed for a specific ProgramDay."""

    program_day = models.ForeignKey(ProgramDay, on_delete=models.CASCADE, related_name='exercises')
    exercise = models.ForeignKey('core_app.Exercise', on_delete=models.PROTECT, related_name='program_entries')
    sets = models.PositiveSmallIntegerField(default=3)
    reps = models.PositiveSmallIntegerField(null=True, blank=True)
    duration_seconds = models.PositiveSmallIntegerField(null=True, blank=True)
    rest_seconds = models.PositiveSmallIntegerField(default=60)
    order = models.PositiveSmallIntegerField(default=0)
    notes = models.TextField(blank=True)

    class Meta:
        ordering = ['order']

    def __str__(self):
        reps_str = f'{self.reps} reps' if self.reps else f'{self.duration_seconds}s'
        return f'{self.exercise.name} — {self.sets}×{reps_str}'


class DailyLog(TimestampedModel):
    """Customer's tracking record for one day of the program.

    Created automatically when the customer opens today's routine.
    Closed at 23:55 by a Huey periodic task; after close the log
    is immutable (no further edits allowed).
    """

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='daily_logs',
    )
    program = models.ForeignKey(MonthlyProgram, on_delete=models.CASCADE, related_name='daily_logs')
    date = models.DateField(db_index=True)
    is_closed = models.BooleanField(default=False)
    closed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        unique_together = [('customer', 'date')]

    def __str__(self):
        return f'{self.customer} — {self.date} (closed={self.is_closed})'


class ExerciseLog(TimestampedModel):
    """Completion status for a single ProgramExercise within a DailyLog."""

    class Status(models.TextChoices):
        COMPLETED = 'completed', 'Completed'
        SKIPPED = 'skipped', 'Skipped'
        NOT_DONE = 'not_done', 'Not Done'

    daily_log = models.ForeignKey(DailyLog, on_delete=models.CASCADE, related_name='exercise_logs')
    program_exercise = models.ForeignKey(ProgramExercise, on_delete=models.CASCADE, related_name='logs')
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.NOT_DONE)
    notes = models.TextField(blank=True)

    class Meta:
        unique_together = [('daily_log', 'program_exercise')]

    def __str__(self):
        return f'{self.program_exercise.exercise.name} — {self.status}'
