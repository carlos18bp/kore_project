import pytest
from django.utils import timezone
from datetime import timedelta

from core_app.models import Package, Subscription, User
from core_app.services.admin_subscription_service import create_subscription_for_admin
from core_app.models.payment import Payment


@pytest.mark.django_db
def test_admin_purchase_copies_nutrition_flag():
    u = User.objects.create_user(email='n@example.com', password='x', first_name='N', last_name='U')
    pkg = Package.objects.create(title='Bundle', sessions_count=4, price=100000, includes_nutrition=True)
    now = timezone.now()
    sub = create_subscription_for_admin(
        customer=u, package=pkg, payment_method=Payment.Provider.CASH,
        starts_at=now, expires_at=now + timedelta(days=30), sessions_used=0,
    )
    assert sub.includes_nutrition is True


@pytest.mark.django_db
def test_subscription_flag_defaults_false():
    u = User.objects.create_user(email='n2@example.com', password='x', first_name='N', last_name='U')
    pkg = Package.objects.create(title='Solo', sessions_count=4, price=100000)
    sub = Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30))
    assert sub.includes_nutrition is False
    assert pkg.includes_nutrition is False


from core_app.models.nutrition_product import NutritionProduct
from core_app.services.nutrition_access import has_nutrition_access, active_nutrition_price


@pytest.mark.django_db
def test_has_nutrition_access():
    u = User.objects.create_user(email='a@example.com', password='x', first_name='A', last_name='B')
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=True)
    assert has_nutrition_access(u) is True


@pytest.mark.django_db
def test_no_access_without_flag():
    u = User.objects.create_user(email='a2@example.com', password='x', first_name='A', last_name='B')
    pkg = Package.objects.create(title='P', sessions_count=4, price=100000)
    Subscription.objects.create(customer=u, package=pkg, sessions_total=4, starts_at=timezone.now(), expires_at=timezone.now() + timedelta(days=30), status='active', includes_nutrition=False)
    assert has_nutrition_access(u) is False


@pytest.mark.django_db
def test_active_nutrition_price():
    assert active_nutrition_price() is None
    NutritionProduct.objects.create(name='Nutrición', price_cop=30000, is_active=True)
    assert active_nutrition_price() == 30000
