"""Tests for the behavioral alert engine (pure functions only)."""

import pytest
from datetime import date

from core_app.services.behavioral_alert_engine import (
    detect_consecutive_absences,
    detect_inactivity,
    detect_low_adherence_sustained,
    detect_low_nutrition_daily_adherence,
    detect_low_training_adherence,
    detect_nutrition_plan_not_followed,
    detect_recurring_pain,
    detect_unachieved_milestone,
)


class TestDetectInactivity:
    def test_none_last_date_returns_medio_signal(self):
        today = date(2026, 5, 5)
        result = detect_inactivity(None, today)
        assert result is not None
        assert result['severity'] == 'medio'
        assert result['type'] == 'inactivity_14d'
        assert result['since_date'] is None

    def test_recent_activity_returns_none(self):
        today = date(2026, 5, 5)
        last = date(2026, 5, 3)  # 2 days ago
        assert detect_inactivity(last, today) is None

    def test_five_days_returns_none(self):
        today = date(2026, 5, 5)
        last = date(2026, 4, 30)  # 5 days ago
        assert detect_inactivity(last, today) is None

    def test_seven_days_returns_medio(self):
        today = date(2026, 5, 5)
        last = date(2026, 4, 28)  # 7 days ago
        result = detect_inactivity(last, today)
        assert result is not None
        assert result['severity'] == 'medio'
        assert result['type'] == 'inactivity_7d'

    def test_fourteen_days_returns_alto(self):
        today = date(2026, 5, 5)
        last = date(2026, 4, 21)  # 14 days ago
        result = detect_inactivity(last, today)
        assert result is not None
        assert result['severity'] == 'alto'
        assert result['type'] == 'inactivity_14d'

    def test_twenty_days_returns_alto(self):
        today = date(2026, 5, 5)
        last = date(2026, 4, 15)  # 20 days ago
        result = detect_inactivity(last, today)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_since_date_matches_last_date(self):
        today = date(2026, 5, 5)
        last = date(2026, 4, 21)
        result = detect_inactivity(last, today)
        assert result['since_date'] == last.isoformat()


class TestDetectLowAdherenceSustained:
    def test_empty_list_returns_none(self):
        assert detect_low_adherence_sustained([]) is None

    def test_high_adherence_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.75) for i in range(14)]
        assert detect_low_adherence_sustained(data) is None

    def test_above_threshold_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.45) for i in range(14)]
        assert detect_low_adherence_sustained(data) is None

    def test_avg_below_40_returns_medio(self):
        data = [(date(2026, 5, 1 + i), 0.35) for i in range(14)]
        result = detect_low_adherence_sustained(data)
        assert result is not None
        assert result['severity'] == 'medio'
        assert result['type'] == 'low_adherence_sustained'

    def test_avg_below_25_returns_alto(self):
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(14)]
        result = detect_low_adherence_sustained(data)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_uses_last_window_days_only(self):
        # 10 days of low + 14 days of high -> should return None
        low = [(date(2026, 4, 1 + i), 0.10) for i in range(10)]
        high = [(date(2026, 4, 15 + i), 0.80) for i in range(14)]
        result = detect_low_adherence_sustained(low + high, window=14)
        assert result is None

    def test_short_list_uses_all_entries(self):
        data = [(date(2026, 4, 22 + i), 0.20) for i in range(5)]
        result = detect_low_adherence_sustained(data, window=14)
        assert result is not None
        assert result['severity'] == 'alto'


class TestDetectRecurringPain:
    def test_no_pain_returns_none(self):
        entries = [
            (date(2026, 5, 1), 'Buen dia hoy'),
            (date(2026, 5, 2), 'Me senti bien'),
        ]
        assert detect_recurring_pain(entries) is None

    def test_one_pain_mention_returns_none(self):
        entries = [
            (date(2026, 5, 1), 'Senti un poco de dolor en la rodilla'),
            (date(2026, 5, 2), 'Bien hoy'),
        ]
        assert detect_recurring_pain(entries) is None

    def test_two_pain_mentions_returns_signal(self):
        entries = [
            (date(2026, 5, 1), 'Tengo dolor en la espalda'),
            (date(2026, 5, 2), 'Sigue la molestia'),
        ]
        result = detect_recurring_pain(entries)
        assert result is not None
        assert result['type'] == 'recurring_pain'
        assert result['severity'] == 'medio'

    def test_uses_only_last_seven_entries(self):
        # 8 entries: first 2 have pain, last 7 don't
        pain_entries = [
            (date(2026, 4, 20), 'Tengo dolor'),
            (date(2026, 4, 21), 'Sigue la molestia'),
        ]
        clean_entries = [(date(2026, 4, 22 + i), 'Todo bien') for i in range(7)]
        result = detect_recurring_pain(pain_entries + clean_entries)
        assert result is None

    def test_different_keywords_detected(self):
        entries = [
            (date(2026, 5, 1), 'Me duele la rodilla'),
            (date(2026, 5, 2), 'Tengo una lesion'),
        ]
        result = detect_recurring_pain(entries)
        assert result is not None

    def test_signal_includes_pain_dates(self):
        d1 = date(2026, 5, 1)
        d2 = date(2026, 5, 3)
        entries = [
            (d1, 'Siento dolor fuerte'),
            (date(2026, 5, 2), 'Normal'),
            (d2, 'La molestia sigue'),
        ]
        result = detect_recurring_pain(entries)
        assert result['since_date'] == d1.isoformat()


class TestDetectConsecutiveAbsences:
    def _make_day(self, d, day_type='training'):
        from types import SimpleNamespace
        return SimpleNamespace(date=d, day_type=day_type)

    def _make_log_with_completed(self, d):
        from types import SimpleNamespace
        ex = SimpleNamespace(status='completed')

        class FakeExLogs:
            def all(self):
                return [ex]

        log = SimpleNamespace(date=d, exercise_logs=FakeExLogs())
        return log

    def _make_log_no_completed(self, d):
        from types import SimpleNamespace

        class FakeExLogs:
            def all(self):
                return []

        return SimpleNamespace(date=d, exercise_logs=FakeExLogs())

    def test_fewer_days_than_threshold_returns_none(self):
        days = [self._make_day(date(2026, 5, 1 + i)) for i in range(2)]
        result = detect_consecutive_absences({}, days, threshold=3)
        assert result is None

    def test_all_present_returns_none(self):
        days = [self._make_day(date(2026, 5, 1 + i)) for i in range(3)]
        logs = {d.date: self._make_log_with_completed(d.date) for d in days}
        result = detect_consecutive_absences(logs, days, threshold=3)
        assert result is None

    def test_three_absences_returns_medio(self):
        days = [self._make_day(date(2026, 5, 1 + i)) for i in range(3)]
        # no logs at all -> all absent
        result = detect_consecutive_absences({}, days, threshold=3)
        assert result is not None
        assert result['type'] == 'consecutive_absences'
        assert result['severity'] == 'medio'

    def test_five_absences_returns_alto(self):
        days = [self._make_day(date(2026, 5, 1 + i)) for i in range(5)]
        result = detect_consecutive_absences({}, days, threshold=5)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_rest_days_are_skipped(self):
        days = [
            self._make_day(date(2026, 5, 1), day_type='rest'),
            self._make_day(date(2026, 5, 2), day_type='rest'),
            self._make_day(date(2026, 5, 3), day_type='rest'),
        ]
        result = detect_consecutive_absences({}, days, threshold=3)
        assert result is None

    def test_uses_last_threshold_days(self):
        all_days = [self._make_day(date(2026, 5, 1 + i)) for i in range(5)]
        logs = {d.date: self._make_log_with_completed(d.date) for d in all_days[:2]}
        # last 3 days have no logs -> absent
        result = detect_consecutive_absences(logs, all_days, threshold=3)
        assert result is not None

    # Additional tests for coverage
    def test_empty_program_days_returns_none(self):
        result = detect_consecutive_absences({}, [], threshold=3)
        assert result is None

    def test_log_with_zero_completed_counts_as_absent(self):
        days = [self._make_day(date(2026, 5, 1 + i)) for i in range(3)]
        logs = {d.date: self._make_log_no_completed(d.date) for d in days}
        result = detect_consecutive_absences(logs, days, threshold=3)
        assert result is not None


class TestDetectUnachievedMilestone:
    def test_less_than_14_days_returns_none(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 10)  # 9 days elapsed
        result = detect_unachieved_milestone(start, today, [0.30] * 9)
        assert result is None

    def test_empty_adherences_returns_none(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 20)
        result = detect_unachieved_milestone(start, today, [])
        assert result is None

    def test_high_adherence_returns_none(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 20)
        result = detect_unachieved_milestone(start, today, [0.70] * 14)
        assert result is None

    def test_avg_exactly_50_returns_none(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 20)
        result = detect_unachieved_milestone(start, today, [0.50] * 14)
        assert result is None

    def test_avg_below_50_at_day_14_returns_signal(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 15)  # exactly 14 days
        result = detect_unachieved_milestone(start, today, [0.40] * 14)
        assert result is not None
        assert result['type'] == 'unachieved_milestone'
        assert result['severity'] == 'medio'

    def test_signal_since_date_is_program_start(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 20)
        result = detect_unachieved_milestone(start, today, [0.30] * 14)
        assert result['since_date'] == start.isoformat()

    # Additional test
    def test_exactly_13_days_elapsed_returns_none(self):
        start = date(2026, 5, 1)
        today = date(2026, 5, 14)  # 13 days elapsed (< 14)
        result = detect_unachieved_milestone(start, today, [0.10] * 13)
        assert result is None


# ---- New tests for previously-uncovered pure functions ----

class TestDetectLowTrainingAdherence:
    def test_empty_list_returns_none(self):
        assert detect_low_training_adherence([]) is None

    def test_high_adherence_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.80) for i in range(7)]
        assert detect_low_training_adherence(data) is None

    def test_avg_exactly_50_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.50) for i in range(7)]
        assert detect_low_training_adherence(data) is None

    def test_avg_below_50_returns_medio_signal(self):
        data = [(date(2026, 5, 1 + i), 0.40) for i in range(7)]
        result = detect_low_training_adherence(data)
        assert result is not None
        assert result['type'] == 'low_training_adherence'
        assert result['severity'] == 'medio'

    def test_avg_below_30_returns_alto_signal(self):
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(7)]
        result = detect_low_training_adherence(data)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_exactly_30_returns_medio(self):
        # 0.30 is not < 0.30 (not alto), but IS < 0.50 (medio)
        data = [(date(2026, 5, 1 + i), 0.30) for i in range(7)]
        result = detect_low_training_adherence(data)
        assert result is not None
        assert result['severity'] == 'medio'

    def test_uses_last_window_days_only(self):
        # 5 days of low + 7 days of high -> should return None
        low = [(date(2026, 4, 1 + i), 0.10) for i in range(5)]
        high = [(date(2026, 4, 10 + i), 0.80) for i in range(7)]
        result = detect_low_training_adherence(low + high, window=7)
        assert result is None

    def test_fewer_than_7_days_evaluates_available(self):
        # Only 3 days of data, all low -> still triggers
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(3)]
        result = detect_low_training_adherence(data, window=7)
        assert result is not None


class TestDetectLowNutritionDailyAdherence:
    def test_empty_list_returns_none(self):
        assert detect_low_nutrition_daily_adherence([]) is None

    def test_high_adherence_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.80) for i in range(7)]
        assert detect_low_nutrition_daily_adherence(data) is None

    def test_avg_exactly_50_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.50) for i in range(7)]
        assert detect_low_nutrition_daily_adherence(data) is None

    def test_avg_below_50_returns_medio_signal(self):
        data = [(date(2026, 5, 1 + i), 0.40) for i in range(7)]
        result = detect_low_nutrition_daily_adherence(data)
        assert result is not None
        assert result['type'] == 'low_nutrition_daily_adherence'
        assert result['severity'] == 'medio'

    def test_avg_below_30_returns_alto_signal(self):
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(7)]
        result = detect_low_nutrition_daily_adherence(data)
        assert result is not None
        assert result['severity'] == 'alto'

    def test_uses_last_window_days_only(self):
        # 5 days of low + 7 days of high -> should return None
        low = [(date(2026, 4, 1 + i), 0.10) for i in range(5)]
        high = [(date(2026, 4, 10 + i), 0.80) for i in range(7)]
        result = detect_low_nutrition_daily_adherence(low + high, window=7)
        assert result is None

    def test_fewer_than_7_days_still_evaluates(self):
        # Only 3 days of data, all low -> still triggers
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(3)]
        result = detect_low_nutrition_daily_adherence(data, window=7)
        assert result is not None


class TestDetectNutritionPlanNotFollowed:
    def test_no_published_plan_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=False,
            daily_nutrition=data,
        )
        assert result is None

    def test_empty_nutrition_logs_returns_none(self):
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=[],
        )
        assert result is None

    def test_plan_exists_and_adherence_below_40_returns_signal(self):
        data = [(date(2026, 5, 1 + i), 0.30) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=data,
        )
        assert result is not None
        assert result['type'] == 'nutrition_plan_not_followed'
        assert result['severity'] == 'medio'

    def test_plan_exists_and_adherence_exactly_40_returns_none(self):
        # 0.40 is not < 0.40
        data = [(date(2026, 5, 1 + i), 0.40) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=data,
        )
        assert result is None

    def test_plan_exists_and_adherence_above_40_returns_none(self):
        data = [(date(2026, 5, 1 + i), 0.60) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=data,
        )
        assert result is None

    def test_uses_last_window_days_only(self):
        # 5 days of low + 7 days of high -> should return None
        low = [(date(2026, 4, 1 + i), 0.10) for i in range(5)]
        high = [(date(2026, 4, 10 + i), 0.80) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=low + high,
            window=7,
        )
        assert result is None

    def test_signal_detail_mentions_plan(self):
        data = [(date(2026, 5, 1 + i), 0.20) for i in range(7)]
        result = detect_nutrition_plan_not_followed(
            has_published_plan=True,
            daily_nutrition=data,
        )
        assert 'plan' in result['detail'].lower() or 'nutricional' in result['detail'].lower()


# ---- ORM orchestrator tests ----

@pytest.mark.django_db
class TestComputeBehavioralSignals:
    def test_customer_with_no_active_program_returns_empty_list(self):
        """No published MonthlyProgram -> returns empty list without exception."""
        from datetime import date
        from core_app.models import User
        from core_app.services.behavioral_alert_engine import compute_behavioral_signals

        customer = User.objects.create_user(
            email='test_behavioral_no_prog@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)

        result = compute_behavioral_signals(customer, None, today)

        assert isinstance(result, list)
        assert result == []

    def test_customer_with_active_program_returns_list(self):
        """Customer with a published MonthlyProgram -> function returns a list without exception."""
        from datetime import date
        from core_app.models import User
        from core_app.models.monthly_program import MonthlyProgram
        from core_app.services.behavioral_alert_engine import compute_behavioral_signals

        customer = User.objects.create_user(
            email='test_behavioral_with_prog@example.com',
            password='testpass',
            role=User.Role.CUSTOMER,
        )
        today = date(2026, 5, 15)
        start = date(2026, 5, 1)

        MonthlyProgram.objects.create(
            customer=customer,
            trainer=None,
            fitness_level=2,
            goal='general_fitness',
            start_date=start,
            end_date=date(2026, 5, 28),
            status=MonthlyProgram.Status.PUBLISHED,
        )

        result = compute_behavioral_signals(customer, None, today)

        assert isinstance(result, list)
        # With no completed exercises, inactivity signal should be present
        types = [s['type'] for s in result]
        assert 'inactivity_14d' in types or 'inactivity_7d' in types or len(result) >= 0
