import random
import uuid

from django.core.management.base import BaseCommand

from core_app.models import AnalyticsEvent, User

PATHS = [
    '/', '/programas', '/la-marca-kore', '/login', '/register',
    '/checkout', '/dashboard', '/book-session', '/my-sessions', '/subscription',
]

REFERRERS = [
    '', '', '',
    'https://www.google.com/', 'https://www.google.com/',
    'https://www.instagram.com/', 'https://www.facebook.com/',
    'https://wa.me/', 'https://www.tiktok.com/',
]


class Command(BaseCommand):
    help = 'Create fake analytics events'

    def add_arguments(self, parser):
        parser.add_argument('--num', type=int, default=100)

    def handle(self, *args, **options):
        num = int(options['num'])

        users = list(User.objects.all())
        event_types = [t for t, _ in AnalyticsEvent.Type.choices]

        # Pre-generate session IDs per user
        user_sessions = {u.pk: f'sess-{uuid.uuid4().hex[:8]}' for u in users}

        created = 0
        for _ in range(num):
            user = random.choice(users) if users and random.random() < 0.7 else None
            event_type = random.choice(event_types)
            session_id = user_sessions.get(user.pk, f'anon-{uuid.uuid4().hex[:8]}') if user else f'anon-{uuid.uuid4().hex[:8]}'

            AnalyticsEvent.objects.create(
                event_type=event_type,
                user=user,
                session_id=session_id,
                path=random.choice(PATHS),
                referrer=random.choice(REFERRERS),
                metadata={'source': 'fake_data'},
            )
            created += 1

        self.stdout.write(self.style.SUCCESS('Analytics events:'))
        self.stdout.write(f'- created: {created}')
        self.stdout.write(f'- total: {AnalyticsEvent.objects.count()}')
