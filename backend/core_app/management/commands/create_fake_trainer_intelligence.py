"""Create fake Trainer Intelligence data for development and testing.

Populates the trainer-intelligence domain that ``create_fake_data`` omits:
ClientRiskScore (via the real ``risk_score_service``), TrainerAlertResolution
(one per detected signal) and TrainerMessage.

The risk score is computed from each customer's published MonthlyProgram and
evaluation history, so this command should run after ``create_fake_programs``
and ``create_fake_diagnostics``.  Re-running is safe: customers that already
have a fresh (non-stale) score are not recomputed unless ``--reset`` is passed.
"""

import random

from django.core.management.base import BaseCommand

from core_app.models import (
    ClientRiskScore,
    TrainerAlertResolution,
    TrainerMessage,
    TrainerProfile,
    User,
)
from core_app.services.risk_score_service import recompute_risk_score

RESOLUTION_TYPES = [
    TrainerAlertResolution.ResolutionType.MARK_REVIEWED,
    TrainerAlertResolution.ResolutionType.PRIVATE_NOTE,
    TrainerAlertResolution.ResolutionType.PUBLIC_NOTE,
    TrainerAlertResolution.ResolutionType.SCHEDULE_EVAL,
    TrainerAlertResolution.ResolutionType.GO_TO_MODULE,
]

RESOLUTION_NOTES = [
    'Revisado. Sigo monitoreando la evolución esta semana.',
    'Le escribí para reforzar la adherencia al plan.',
    'Agendo una nueva evaluación para descartar riesgos.',
    'Ajusto la carga del programa según lo observado.',
]

TRAINER_MESSAGES = [
    '¡Buen trabajo esta semana! Seguimos con el mismo enfoque.',
    'Recordá hidratarte bien antes de cada sesión.',
    'Vi tu progreso, vamos a subir un poco la intensidad.',
    'Cualquier molestia me avisás y ajustamos el plan.',
]


class Command(BaseCommand):
    help = 'Create fake trainer intelligence data (risk scores, resolutions, messages)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--messages-per-customer', type=int, default=2,
            help='Number of trainer messages to create per customer (default: 2).',
        )
        parser.add_argument(
            '--seed', type=int, default=None,
            help='Random seed for reproducible messages/resolutions.',
        )
        parser.add_argument(
            '--reset', action='store_true', default=False,
            help='Delete existing risk scores and messages for customers first.',
        )

    def handle(self, *args, **options):
        seed = options.get('seed')
        if seed is not None:
            random.seed(seed)

        messages_per_customer = max(int(options['messages_per_customer']), 0)
        customers = list(User.objects.filter(role=User.Role.CUSTOMER))
        if not customers:
            self.stdout.write(self.style.WARNING('No customers found. Run create_fake_users first.'))
            return

        default_trainer = TrainerProfile.objects.first()

        if options['reset']:
            customer_ids = [c.pk for c in customers]
            ClientRiskScore.objects.filter(customer_id__in=customer_ids).delete()
            TrainerMessage.objects.filter(customer_id__in=customer_ids).delete()
            self.stdout.write(self.style.WARNING('Existing risk scores and messages deleted.'))

        counts = {'risk_scores': 0, 'resolutions': 0, 'messages': 0}

        for customer in customers:
            score = self._ensure_risk_score(customer)
            if score is not None:
                counts['risk_scores'] += 1
                counts['resolutions'] += self._create_resolutions(score)

            trainer = score.trainer if score else self._resolve_trainer(customer, default_trainer)
            if trainer is not None:
                counts['messages'] += self._create_messages(
                    customer, trainer, messages_per_customer,
                )

        self.stdout.write(self.style.SUCCESS('Trainer intelligence:'))
        self.stdout.write(f"- risk_scores_created: {counts['risk_scores']}")
        self.stdout.write(f"- resolutions_created: {counts['resolutions']}")
        self.stdout.write(f"- messages_created: {counts['messages']}")
        self.stdout.write(f"- total_customers_processed: {len(customers)}")

    @staticmethod
    def _resolve_trainer(customer, default_trainer):
        if customer.assigned_trainer_id:
            return customer.assigned_trainer
        return default_trainer

    def _ensure_risk_score(self, customer):
        """Return the customer's fresh ClientRiskScore, computing one if needed."""
        fresh = (
            ClientRiskScore.objects
            .filter(customer=customer, is_stale=False)
            .order_by('-computed_at')
            .first()
        )
        if fresh is not None:
            return fresh

        created = recompute_risk_score(customer)
        if not created:
            return None
        return (
            ClientRiskScore.objects
            .filter(customer=customer, is_stale=False)
            .order_by('-computed_at')
            .first()
        )

    def _create_resolutions(self, score):
        """Create one TrainerAlertResolution per behavioral/clinical signal."""
        signals = list(score.behavioral_signals or []) + list(score.clinical_signals or [])
        created = 0
        for idx, signal in enumerate(signals):
            resolution_type = RESOLUTION_TYPES[idx % len(RESOLUTION_TYPES)]
            is_public = resolution_type == TrainerAlertResolution.ResolutionType.PUBLIC_NOTE
            _, was_created = TrainerAlertResolution.objects.get_or_create(
                risk_score=score,
                trainer=score.trainer,
                signal_type=signal.get('type', 'unknown'),
                resolution_type=resolution_type,
                defaults={
                    'note': random.choice(RESOLUTION_NOTES),
                    'is_public': is_public,
                },
            )
            if was_created:
                created += 1
        return created

    def _create_messages(self, customer, trainer, target_count):
        """Top up TrainerMessages for the customer to the requested count."""
        existing = TrainerMessage.objects.filter(customer=customer).count()
        to_create = max(0, target_count - existing)
        created = 0
        for _ in range(to_create):
            TrainerMessage.objects.create(
                customer=customer,
                trainer=trainer,
                trigger_type=TrainerMessage.TriggerType.MANUAL,
                message=random.choice(TRAINER_MESSAGES),
                is_visible=True,
                seen_by_customer=random.random() < 0.5,
            )
            created += 1
        return created
