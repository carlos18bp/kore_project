import random

from django.core.management.base import BaseCommand

from core_app.models import AnalyticsEvent, User


class Command(BaseCommand):
    help = 'Create fake analytics events'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=50)

    def handle(self, *args, **options):
        num = int(options['num'])

        users = list(User.objects.all())
        event_types = [t for t, _ in AnalyticsEvent.Type.choices]

        created = 0
        for _ in range(num):
            user = random.choice(users) if users and random.random() < 0.7 else None
            event_type = random.choice(event_types)

            AnalyticsEvent.objects.create(
                event_type=event_type,
                user=user,
                session_id='fake-session',
                path='/',
                referrer='',
                metadata={'source': 'fake_data'},
            )
            created += 1

        self.stdout.write(self.style.SUCCESS('Analytics events:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {AnalyticsEvent.objects.count()}')
