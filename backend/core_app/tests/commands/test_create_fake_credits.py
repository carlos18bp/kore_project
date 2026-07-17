"""Tests for the create_fake_credits management command."""

from datetime import timedelta
from io import StringIO

import pytest
from django.core.management import call_command
from django.db.models import Sum
from django.utils import timezone

from core_app.models import Booking, Package, TrainerProfile, User
from core_app.models.credit import CreditSettings, CreditTransaction, CreditWallet
from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase
from core_app.models.nutrition_product import NutritionProduct
from core_app.models.session_rating import SessionRating
from core_app.models.store import RedemptionRequest, StoreItem


def _run(**kwargs):
    out = StringIO()
    call_command('create_fake_credits', stdout=out, **kwargs)
    return out.getvalue()


def _confirmed_sum(customer):
    return (
        CreditTransaction.objects.filter(
            customer=customer, status=CreditTransaction.Status.CONFIRMED,
        ).aggregate(total=Sum('amount'))['total'] or 0
    )


@pytest.fixture
def fake_customers_with_past_bookings(db):
    """Two fake customers, a trainer, and four past unset bookings for the first."""
    trainer_user = User.objects.create_user(
        email='trainer-credits@kore.com', password='p',
        first_name='Tere', last_name='Trainer', role=User.Role.TRAINER,
    )
    trainer = TrainerProfile.objects.create(user=trainer_user)
    package = Package.objects.create(title='Plan Credits', sessions_count=8)
    customers = [
        User.objects.create_user(
            email=f'customer-credits{i}@kore.com', password='p',
            first_name=f'C{i}', last_name='Credits', role=User.Role.CUSTOMER,
        )
        for i in (1, 2)
    ]
    base = timezone.now() - timedelta(days=10)
    for k in range(4):
        start = base + timedelta(days=k)
        Booking.objects.create(
            customer=customers[0], package=package, trainer=trainer,
            starts_at=start, ends_at=start + timedelta(hours=1),
            status=Booking.Status.CONFIRMED,
            attendance_status=Booking.AttendanceStatus.UNSET,
        )
    return customers, trainer_user


@pytest.mark.django_db
class TestCreateFakeCredits:
    """Validates the credit-economy seeder output and its accounting invariants."""

    def test_materializes_credit_settings_singleton(self):
        """Running the command materializes the CreditSettings singleton with preset values."""
        _run(seed=1)

        settings_obj = CreditSettings.objects.get()
        assert settings_obj.action_values != {}
        assert settings_obj.streak_bonuses != {}

    def test_creates_catalogs(self):
        """The command seeds credit packages, store items and the nutrition product."""
        _run(seed=1)

        assert CreditPackage.objects.count() == 3
        assert StoreItem.objects.count() == 5
        assert NutritionProduct.objects.count() == 1

    def test_catalogs_only_when_no_fake_customers(self):
        """Without @kore.com customers the command seeds catalogs and reports a warning."""
        output = _run(seed=1)

        assert 'seeded catalogs only' in output
        assert CreditWallet.objects.count() == 0

    def test_wallet_balance_matches_confirmed_ledger(self, fake_customers_with_past_bookings):
        """Each wallet balance equals the sum of its confirmed ledger amounts."""
        customers, _ = fake_customers_with_past_bookings

        _run(days=3, seed=1)

        for customer in customers:
            wallet = CreditWallet.objects.get(customer=customer)
            assert wallet.balance == _confirmed_sum(customer)

    def test_records_attendance_with_deterministic_no_show_rule(
        self, fake_customers_with_past_bookings,
    ):
        """Past unset bookings become 3 attended + 1 no-show (every 4th is a no-show)."""
        customers, _ = fake_customers_with_past_bookings

        _run(days=3, seed=1)

        statuses = list(
            Booking.objects.filter(customer=customers[0])
            .order_by('starts_at')
            .values_list('attendance_status', flat=True)
        )
        assert statuses == [
            Booking.AttendanceStatus.ATTENDED,
            Booking.AttendanceStatus.ATTENDED,
            Booking.AttendanceStatus.ATTENDED,
            Booking.AttendanceStatus.NO_SHOW,
        ]

    def test_rates_attended_bookings_and_awards_credit(
        self, fake_customers_with_past_bookings,
    ):
        """Attended bookings get a customer rating plus its session_rated ledger entry."""
        customers, _ = fake_customers_with_past_bookings

        _run(days=3, seed=1)

        rating = SessionRating.objects.filter(
            booking__customer=customers[0],
            rater_role=SessionRating.RaterRole.CUSTOMER,
        ).first()
        assert rating is not None
        tx = CreditTransaction.objects.get(
            customer=customers[0],
            action=CreditTransaction.Action.SESSION_RATED,
            reference_type='booking',
            reference_id=str(rating.booking_id),
        )
        assert tx.amount > 0

    def test_purchase_awards_package_credits(self, fake_customers_with_past_bookings):
        """Approved fake top-ups add exactly the purchased credits to the ledger."""
        customers, _ = fake_customers_with_past_bookings

        _run(days=3, seed=1)

        purchase = CreditPurchase.objects.get(customer=customers[0])
        assert purchase.status == CreditPurchase.Status.APPROVED
        tx = CreditTransaction.objects.get(
            customer=customers[0], action=CreditTransaction.Action.PURCHASE,
        )
        assert tx.amount == purchase.credits

    def test_redemption_spends_credits_for_funded_customer(
        self, fake_customers_with_past_bookings,
    ):
        """The first (even-indexed) funded customer redeems one item, spending its price."""
        customers, _ = fake_customers_with_past_bookings

        _run(days=3, seed=1)

        request = RedemptionRequest.objects.get(customer=customers[0])
        tx = CreditTransaction.objects.get(
            customer=customers[0],
            action=CreditTransaction.Action.REDEMPTION,
            reference_id=str(request.pk),
        )
        assert tx.amount == -request.credits_spent
        assert CreditWallet.objects.get(customer=customers[0]).balance >= 0

    def test_rerun_is_idempotent(self, fake_customers_with_past_bookings):
        """A second run creates no duplicate ledger, catalog or redemption rows."""
        _run(days=3, seed=1)
        tx_count = CreditTransaction.objects.count()
        redemption_count = RedemptionRequest.objects.count()
        package_count = CreditPackage.objects.count()

        _run(days=3, seed=1)

        assert CreditTransaction.objects.count() == tx_count
        assert RedemptionRequest.objects.count() == redemption_count
        assert CreditPackage.objects.count() == package_count
