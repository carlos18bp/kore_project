"""Recompute wallet balances from the confirmed ledger and report/repair drift."""
from django.core.management.base import BaseCommand
from django.db.models import Sum

from core_app.models.credit import CreditTransaction, CreditWallet


class Command(BaseCommand):
    help = 'Report (and optionally fix) CreditWallet balances that drifted from the ledger.'

    def add_arguments(self, parser):
        parser.add_argument('--fix', action='store_true', help='Repair drifted balances.')

    def handle(self, *args, **options):
        drifted = 0
        for wallet in CreditWallet.objects.select_related('customer'):
            expected = (
                CreditTransaction.objects.filter(
                    customer=wallet.customer,
                    status=CreditTransaction.Status.CONFIRMED,
                ).aggregate(total=Sum('amount'))['total'] or 0
            )
            if wallet.balance != expected:
                drifted += 1
                self.stdout.write(
                    f'drift: {wallet.customer} balance={wallet.balance} expected={expected}'
                )
                if options['fix']:
                    wallet.balance = expected
                    wallet.save(update_fields=['balance', 'updated_at'])
        self.stdout.write(
            f'checked={CreditWallet.objects.count()} drifted={drifted} '
            f'fixed={drifted if options["fix"] else 0}'
        )
