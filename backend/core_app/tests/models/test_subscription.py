import pytest
from datetime import timedelta

from django.utils import timezone

from core_app.models import Package, Subscription, User


@pytest.fixture
def customer(db):
    return User.objects.create_user(email='sub_cust@example.com', password='p')


@pytest.fixture
def package(db):
    return Package.objects.create(title='Gold', sessions_count=12, validity_days=30, is_active=True)


@pytest.fixture
def subscription(customer, package):
    now = timezone.now()
    return Subscription.objects.create(
        customer=customer,
        package=package,
        sessions_total=12,
        sessions_used=3,
        status=Subscription.Status.ACTIVE,
        starts_at=now,
        expires_at=now + timedelta(days=30),
    )


@pytest.mark.django_db
class TestSubscriptionModel:
    def test_create_subscription(self, subscription):
        assert subscription.pk is not None
        assert subscription.status == 'active'
        assert subscription.sessions_total == 12
        assert subscription.sessions_used == 3

    def test_sessions_remaining_property(self, subscription):
        assert subscription.sessions_remaining == 9

    def test_sessions_remaining_floors_at_zero(self, customer, package):
        now = timezone.now()
        sub = Subscription.objects.create(
            customer=customer,
            package=package,
            sessions_total=5,
            sessions_used=10,
            starts_at=now,
            expires_at=now + timedelta(days=30),
        )
        assert sub.sessions_remaining == 0

    def test_str_representation(self, subscription):
        s = str(subscription)
        assert 'sub_cust@example.com' in s
        assert 'Gold' in s

    def test_status_choices(self):
        assert Subscription.Status.ACTIVE == 'active'
        assert Subscription.Status.EXPIRED == 'expired'
        assert Subscription.Status.CANCELED == 'canceled'

    def test_protect_on_customer_delete(self, subscription):
        with pytest.raises(Exception):
            subscription.customer.delete()

    def test_protect_on_package_delete(self, subscription):
        with pytest.raises(Exception):
            subscription.package.delete()

    def test_ordering_by_created_at_desc(self, customer, package):
        now = timezone.now()
        s1 = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=1, starts_at=now, expires_at=now + timedelta(days=1),
        )
        s2 = Subscription.objects.create(
            customer=customer, package=package,
            sessions_total=1, starts_at=now, expires_at=now + timedelta(days=1),
        )
        ids = list(Subscription.objects.values_list('id', flat=True))
        assert ids == [s2.id, s1.id]
