from django.conf import settings
from django.db import models

from core_app.models.base import SingletonModel, TimestampedModel


class CreditSettings(SingletonModel, TimestampedModel):
    """Global (singleton) configuration for the credit economy.

    ``action_values`` and ``streak_bonuses`` are seeded from the selected
    difficulty preset by ``credit_engine.get_settings()`` when empty, and can
    be individually overridden by the trainer (Part 6 UI).
    """

    class Difficulty(models.TextChoices):
        EASY = 'easy', 'Fácil'
        MEDIUM = 'medium', 'Medio'
        HARD = 'hard', 'Difícil'

    difficulty = models.CharField(
        max_length=10, choices=Difficulty.choices, default=Difficulty.MEDIUM,
    )
    action_values = models.JSONField(default=dict, blank=True)
    streak_bonuses = models.JSONField(default=dict, blank=True)
    training_day_threshold = models.FloatField(default=0.70)
    nutrition_min_meals = models.PositiveSmallIntegerField(default=3)
    water_goal_glasses = models.PositiveSmallIntegerField(default=8)
    meal_review_days = models.PositiveSmallIntegerField(default=3)
    reschedule_window_hours = models.PositiveSmallIntegerField(default=24)
    require_workout_captures = models.BooleanField(default=True)

    def __str__(self):
        return f'CreditSettings ({self.difficulty})'


class CreditWallet(TimestampedModel):
    """Denormalized per-customer credit state; reconstructible from the ledger."""

    customer = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_wallet',
    )
    balance = models.IntegerField(default=0)
    current_streak = models.PositiveIntegerField(default=0)
    longest_streak = models.PositiveIntegerField(default=0)
    last_active_date = models.DateField(null=True, blank=True)

    def __str__(self):
        return f'{self.customer} — {self.balance} credits (streak {self.current_streak})'


class CreditTransaction(TimestampedModel):
    """Append-only credit ledger. Only CONFIRMED rows touch the wallet balance."""

    class Action(models.TextChoices):
        PHYSICAL_TEST_PASSED = 'physical_test_passed', 'Physical test passed'
        SESSION_ATTENDED = 'session_attended', 'Session attended'
        SESSION_RATED = 'session_rated', 'Session rated'
        WORKOUT_DAY = 'workout_day', 'Workout day'
        MEAL_PHOTO = 'meal_photo', 'Meal with photo'
        CHECKIN = 'checkin', 'Daily check-in'
        WATER_GOAL = 'water_goal', 'Hydration goal'
        STREAK_BONUS = 'streak_bonus', 'Streak bonus'
        NO_SHOW_PENALTY = 'no_show_penalty', 'No-show penalty'
        NO_SHOW_REVERSAL = 'no_show_reversal', 'No-show reversal'
        LATE_RESCHEDULE_PENALTY = 'late_reschedule_penalty', 'Late reschedule penalty'
        ADJUSTMENT = 'adjustment', 'Manual adjustment'
        REDEMPTION = 'redemption', 'Store redemption'
        REDEMPTION_REFUND = 'redemption_refund', 'Redemption refund'
        PURCHASE = 'purchase', 'Credit purchase'

    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        CONFIRMED = 'confirmed', 'Confirmed'
        REJECTED = 'rejected', 'Rejected'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='credit_transactions',
    )
    action = models.CharField(max_length=32, choices=Action.choices, db_index=True)
    amount = models.IntegerField()
    status = models.CharField(
        max_length=10, choices=Status.choices, default=Status.CONFIRMED, db_index=True,
    )
    description = models.CharField(max_length=255)
    reference_type = models.CharField(max_length=32, blank=True, default='')
    reference_id = models.CharField(max_length=64, null=True, blank=True)
    review_deadline = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True, blank=True,
        related_name='+',
    )
    reviewed_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        ordering = ('-created_at',)
        constraints = [
            models.UniqueConstraint(
                fields=['customer', 'action', 'reference_type', 'reference_id'],
                name='uq_credit_tx_reference',
            ),
        ]

    def __str__(self):
        return f'{self.customer} {self.action} {self.amount:+d} ({self.status})'
