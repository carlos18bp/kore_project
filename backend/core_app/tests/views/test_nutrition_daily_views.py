"""Tests for nutrition daily views:
- TodayNutritionView
- UpdateMealEntryView
- MealEntryPhotoView
- NutritionHistoryView
"""

from datetime import date, timedelta
from io import BytesIO
from unittest.mock import patch

import pytest
from PIL import Image
from django.core.files.uploadedfile import InMemoryUploadedFile
from rest_framework.test import APIClient

from core_app.models import MealEntry, NutritionDailyLog, User
from core_app.models.weekly_nutrition_plan import WeeklyNutritionPlan, WeeklyPlanDay, WeeklyPlanMeal

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _today():
    return date.today()


def _make_customer(email='nutrdaily@test.com'):
    return User.objects.create_user(email=email, password='pass', role=User.Role.CUSTOMER)


def _auth(client, user):
    from rest_framework_simplejwt.tokens import RefreshToken
    token = RefreshToken.for_user(user)
    client.credentials(HTTP_AUTHORIZATION=f'Bearer {token.access_token}')


def _empty_suggestions():
    """Return an empty dict keyed by MealBlock — no real suggestions needed."""
    return {block: None for block in [
        MealEntry.MealBlock.BREAKFAST,
        MealEntry.MealBlock.MID_MORNING,
        MealEntry.MealBlock.LUNCH,
        MealEntry.MealBlock.SNACK,
        MealEntry.MealBlock.DINNER,
    ]}


def _make_jpeg_upload(name='photo.jpg', size=(100, 100)):
    """Create a minimal in-memory JPEG upload."""
    buf = BytesIO()
    img = Image.new('RGB', size, color='red')
    img.save(buf, format='JPEG')
    buf.seek(0)
    return InMemoryUploadedFile(buf, 'photo', name, 'image/jpeg', buf.getbuffer().nbytes, None)


# ---------------------------------------------------------------------------
# TodayNutritionView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestTodayNutritionViewFirstCall:
    @patch('core_app.views.nutrition_daily_views.get_daily_suggestions')
    def test_first_call_creates_log_with_five_meal_entries(self, mock_suggest):
        mock_suggest.return_value = _empty_suggestions()
        customer = _make_customer('today1@test.com')
        client = APIClient()
        _auth(client, customer)

        resp = client.get('/api/my-nutrition-daily/today/')
        assert resp.status_code == 200
        assert NutritionDailyLog.objects.filter(customer=customer, date=_today()).count() == 1
        assert MealEntry.objects.filter(daily_log__customer=customer).count() == 5

    @patch('core_app.views.nutrition_daily_views.get_daily_suggestions')
    def test_second_call_does_not_duplicate_log(self, mock_suggest):
        mock_suggest.return_value = _empty_suggestions()
        customer = _make_customer('today2@test.com')
        client = APIClient()
        _auth(client, customer)

        client.get('/api/my-nutrition-daily/today/')
        client.get('/api/my-nutrition-daily/today/')

        assert NutritionDailyLog.objects.filter(customer=customer, date=_today()).count() == 1
        assert MealEntry.objects.filter(daily_log__customer=customer).count() == 5

    @patch('core_app.views.nutrition_daily_views.get_daily_suggestions')
    def test_response_contains_meal_entries_list(self, mock_suggest):
        mock_suggest.return_value = _empty_suggestions()
        customer = _make_customer('today3@test.com')
        client = APIClient()
        _auth(client, customer)

        resp = client.get('/api/my-nutrition-daily/today/')
        assert resp.status_code == 200
        assert 'meal_entries' in resp.data
        assert len(resp.data['meal_entries']) == 5


@pytest.mark.django_db
class TestTodayNutritionViewWithPlan:
    def test_published_plan_suggestions_are_used_instead_of_auto_rotation(self):
        """When a WeeklyNutritionPlan covers today, its suggestions populate the log."""
        customer = _make_customer('todayplan@test.com')
        client = APIClient()
        _auth(client, customer)

        # Create a published plan covering today
        plan = WeeklyNutritionPlan.objects.create(
            customer=customer,
            goal='fat_loss',
            fitness_level=2,
            week_start=_today() - timedelta(days=_today().weekday()),
            week_end=_today() + timedelta(days=6 - _today().weekday()),
            status=WeeklyNutritionPlan.Status.PUBLISHED,
        )
        plan_day = WeeklyPlanDay.objects.create(plan=plan, day_number=1, date=_today())
        # No meals added to plan_day — that's fine; suggestions dict will be empty

        # get_daily_suggestions should NOT be called because plan exists
        with patch('core_app.views.nutrition_daily_views.get_daily_suggestions') as mock_suggest:
            resp = client.get('/api/my-nutrition-daily/today/')
            assert resp.status_code == 200
            mock_suggest.assert_not_called()

        assert NutritionDailyLog.objects.filter(customer=customer, date=_today()).count() == 1


# ---------------------------------------------------------------------------
# UpdateMealEntryView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestUpdateMealEntryView:
    @patch('core_app.views.nutrition_daily_views.get_daily_suggestions')
    def _setup(self, mock_suggest, email):
        mock_suggest.return_value = _empty_suggestions()
        customer = _make_customer(email)
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today())
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)
        return customer, client, log, entry

    def test_404_when_meal_entry_does_not_exist(self):
        customer = _make_customer('upd404@test.com')
        client = APIClient()
        _auth(client, customer)
        log = NutritionDailyLog.objects.create(customer=customer, date=_today())

        resp = client.patch(f'/api/my-nutrition-daily/{log.pk}/meals/99999/', {'status': 'completed'}, format='json')
        assert resp.status_code == 404

    def test_400_when_log_is_closed(self):
        customer = _make_customer('updclosed@test.com')
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today(), is_closed=True)
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)

        resp = client.patch(
            f'/api/my-nutrition-daily/{log.pk}/meals/{entry.pk}/',
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == 400
        assert 'cerrado' in resp.data['detail'].lower()

    def test_update_status_field_successfully(self):
        customer = _make_customer('updstatus@test.com')
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today())
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)

        resp = client.patch(
            f'/api/my-nutrition-daily/{log.pk}/meals/{entry.pk}/',
            {'status': 'completed'},
            format='json',
        )
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.status == MealEntry.Status.COMPLETED

    def test_update_notes_field_successfully(self):
        customer = _make_customer('updnotes@test.com')
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today())
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)

        resp = client.patch(
            f'/api/my-nutrition-daily/{log.pk}/meals/{entry.pk}/',
            {'notes': 'Felt good today'},
            format='json',
        )
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert entry.notes == 'Felt good today'

    def test_entry_from_another_customer_returns_404(self):
        """A customer cannot patch a meal entry that belongs to a different log/customer."""
        customer_a = _make_customer('upd_a@test.com')
        customer_b = _make_customer('upd_b@test.com')

        log_b = NutritionDailyLog.objects.create(customer=customer_b, date=_today())
        entry_b = MealEntry.objects.create(daily_log=log_b, meal_block=MealEntry.MealBlock.LUNCH)

        client = APIClient()
        _auth(client, customer_a)
        # customer_a tries to patch an entry belonging to customer_b's log
        resp = client.patch(
            f'/api/my-nutrition-daily/{log_b.pk}/meals/{entry_b.pk}/',
            {'status': 'skipped'},
            format='json',
        )
        assert resp.status_code == 404


# ---------------------------------------------------------------------------
# MealEntryPhotoView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestMealEntryPhotoView:
    def test_404_when_meal_entry_does_not_exist(self):
        customer = _make_customer('photo404@test.com')
        client = APIClient()
        _auth(client, customer)
        log = NutritionDailyLog.objects.create(customer=customer, date=_today())

        resp = client.post(
            f'/api/my-nutrition-daily/{log.pk}/meals/99999/photo/',
            {'photo': _make_jpeg_upload()},
            format='multipart',
        )
        assert resp.status_code == 404

    def test_400_when_log_is_closed(self):
        customer = _make_customer('photoclosed@test.com')
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today(), is_closed=True)
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)

        resp = client.post(
            f'/api/my-nutrition-daily/{log.pk}/meals/{entry.pk}/photo/',
            {'photo': _make_jpeg_upload()},
            format='multipart',
        )
        assert resp.status_code == 400
        assert 'cerrado' in resp.data['detail'].lower()

    def test_successful_photo_upload_saves_to_entry(self):
        customer = _make_customer('photopost@test.com')
        client = APIClient()
        _auth(client, customer)

        log = NutritionDailyLog.objects.create(customer=customer, date=_today())
        entry = MealEntry.objects.create(daily_log=log, meal_block=MealEntry.MealBlock.BREAKFAST)

        resp = client.post(
            f'/api/my-nutrition-daily/{log.pk}/meals/{entry.pk}/photo/',
            {'photo': _make_jpeg_upload()},
            format='multipart',
        )
        assert resp.status_code == 200
        entry.refresh_from_db()
        assert bool(entry.photo)


# ---------------------------------------------------------------------------
# NutritionHistoryView
# ---------------------------------------------------------------------------

@pytest.mark.django_db
class TestNutritionHistoryView:
    def test_returns_logs_from_last_30_days(self):
        customer = _make_customer('history30@test.com')
        client = APIClient()
        _auth(client, customer)

        recent_date = _today() - timedelta(days=10)
        NutritionDailyLog.objects.create(customer=customer, date=recent_date)

        resp = client.get('/api/my-nutrition-daily/history/')
        assert resp.status_code == 200
        dates = [r['date'] for r in resp.data]
        assert str(recent_date) in dates

    def test_does_not_return_logs_older_than_30_days(self):
        customer = _make_customer('history_old@test.com')
        client = APIClient()
        _auth(client, customer)

        old_date = _today() - timedelta(days=31)
        NutritionDailyLog.objects.create(customer=customer, date=old_date)

        resp = client.get('/api/my-nutrition-daily/history/')
        assert resp.status_code == 200
        dates = [r['date'] for r in resp.data]
        assert str(old_date) not in dates

    def test_results_are_ordered_by_date_descending(self):
        customer = _make_customer('historysort@test.com')
        client = APIClient()
        _auth(client, customer)

        older = _today() - timedelta(days=5)
        newer = _today() - timedelta(days=2)
        NutritionDailyLog.objects.create(customer=customer, date=older)
        NutritionDailyLog.objects.create(customer=customer, date=newer)

        resp = client.get('/api/my-nutrition-daily/history/')
        assert resp.status_code == 200
        dates = [r['date'] for r in resp.data]
        assert dates.index(str(newer)) < dates.index(str(older))

    def test_returns_empty_list_when_no_logs(self):
        customer = _make_customer('historyempty@test.com')
        client = APIClient()
        _auth(client, customer)

        resp = client.get('/api/my-nutrition-daily/history/')
        assert resp.status_code == 200
        assert resp.data == []
