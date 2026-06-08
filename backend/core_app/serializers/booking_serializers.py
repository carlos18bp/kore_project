from datetime import timedelta

from django.db import models as db_models, transaction
from django.utils import timezone
from rest_framework import serializers
from rest_framework.exceptions import APIException

from core_app.models import Booking, Package, ProgramDay, Subscription, TrainerProfile, User
from core_app.permissions import is_admin_user
from core_app.serializers.package_serializers import PackageSerializer
from core_app.serializers.trainer_profile_serializers import TrainerProfileSerializer
from core_app.services.slot_schedule import (
    MIN_ADVANCE_HOURS,
    is_start_time_available,
    session_window,
)


class NoTrainerAssignedException(APIException):
    """Raised when a customer without an assigned trainer attempts to book."""

    status_code = 400

    def __init__(self):
        self.detail = {
            'detail': 'Aún no puedes agendar. Espera a que te asignen un entrenador.',
            'code': 'no_trainer_assigned',
        }


class BookingSerializer(serializers.ModelSerializer):
    """Serializer for creating and reading Booking instances.

    On **write**, accepts ``package_id``, ``starts_at``, ``trainer_id``, and
    ``subscription_id``.  On **read**, nests full representations of package
    and trainer; exposes ``starts_at`` / ``ends_at`` directly.

    Validations enforced on create:
    - ``starts_at`` must be a currently-bookable start-time for the trainer
      (on the 15-min schedule grid, ≥16 h advance, ≤30 day horizon, no
      conflicting bookings within ±45 min).
    - If a subscription is provided, it must have remaining sessions.
    - The customer must have an assigned trainer.
    """

    customer_id = serializers.PrimaryKeyRelatedField(
        queryset=User.objects.filter(role=User.Role.CUSTOMER),
        source='customer',
        required=False,
    )

    package = PackageSerializer(read_only=True)
    trainer = TrainerProfileSerializer(read_only=True)
    subscription_id_display = serializers.IntegerField(
        source='subscription.id', read_only=True, allow_null=True,
    )
    program_day_exercises = serializers.SerializerMethodField()

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.all(),
        write_only=True,
        source='package',
    )
    starts_at = serializers.DateTimeField()
    ends_at = serializers.DateTimeField(read_only=True)
    trainer_id = serializers.PrimaryKeyRelatedField(
        queryset=TrainerProfile.objects.all(),
        write_only=True,
        source='trainer',
        required=False,
        allow_null=True,
    )
    subscription_id = serializers.PrimaryKeyRelatedField(
        queryset=Subscription.objects.all(),
        write_only=True,
        source='subscription',
        required=False,
        allow_null=True,
    )

    class Meta:
        model = Booking
        fields = (
            'id',
            'customer_id',
            'package',
            'trainer',
            'subscription_id_display',
            'package_id',
            'starts_at',
            'ends_at',
            'trainer_id',
            'subscription_id',
            'status',
            'notes',
            'canceled_reason',
            'session_objective',
            'session_notes_for_customer',
            'program_day_exercises',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('status', 'ends_at', 'created_at', 'updated_at')

    def get_program_day_exercises(self, obj):
        """Return planned exercises for the booking's date from the customer's active program."""
        date = obj.starts_at.date() if obj.starts_at else None
        if not date:
            return []
        program_day = (
            ProgramDay.objects.filter(
                program__customer=obj.customer,
                program__status='published',
                date=date,
            )
            .prefetch_related('exercises__exercise')
            .first()
        )
        if not program_day:
            return []
        return [
            {
                'name': pe.exercise.name,
                'sets': pe.sets,
                'reps': pe.reps,
                'duration_seconds': pe.duration_seconds,
            }
            for pe in program_day.exercises.all()
        ]

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self, attrs):
        request = self.context.get('request')
        actor = getattr(request, 'user', None) if request else None
        if actor is None or not getattr(actor, 'is_authenticated', False):
            raise serializers.ValidationError('Autenticación requerida.')

        actor_role = getattr(actor, 'role', None)
        is_trainer_actor = actor_role == User.Role.TRAINER
        is_admin_actor = is_admin_user(actor)
        payload_customer = attrs.get('customer')

        if is_trainer_actor or is_admin_actor:
            if payload_customer is None:
                raise serializers.ValidationError(
                    {'customer_id': 'Se requiere customer_id cuando un trainer agenda en nombre de un cliente.'}
                )
            if is_trainer_actor:
                trainer_profile = getattr(actor, 'trainer_profile', None)
                if trainer_profile is None:
                    raise serializers.ValidationError(
                        {'customer_id': 'El usuario no tiene un perfil de entrenador asociado.'}
                    )
                if payload_customer.assigned_trainer_id != trainer_profile.pk:
                    raise serializers.ValidationError(
                        {'customer_id': 'Este cliente no está asignado a tu cuenta.'}
                    )
                attrs['trainer'] = trainer_profile
            min_advance_hours = 0
        else:
            # Customer flow: actor IS the customer. Ignore any customer_id sent
            # in the payload to prevent users from booking on behalf of others.
            if actor_role == User.Role.CUSTOMER:
                assigned = getattr(actor, 'assigned_trainer', None)
                if assigned is None:
                    raise NoTrainerAssignedException()
                attrs['trainer'] = assigned
            attrs['customer'] = actor
            min_advance_hours = MIN_ADVANCE_HOURS

        trainer = attrs.get('trainer')
        starts_at = attrs.get('starts_at')

        if trainer is None:
            raise serializers.ValidationError({'trainer_id': 'Se requiere un entrenador.'})

        if not is_start_time_available(trainer, starts_at, min_advance_hours=min_advance_hours):
            raise serializers.ValidationError({'starts_at': 'Ese horario no está disponible.'})

        attrs['ends_at'] = session_window(trainer, starts_at)[1]

        subscription = attrs.get('subscription')
        if subscription and subscription.sessions_remaining <= 0:
            raise serializers.ValidationError(
                {'subscription_id': 'La suscripción no tiene sesiones disponibles.'}
            )
        # Defense in depth: when a trainer/admin acts on behalf of a customer,
        # the subscription must belong to that customer.
        if subscription and attrs.get('customer') and subscription.customer_id != attrs['customer'].id:
            raise serializers.ValidationError(
                {'subscription_id': 'La suscripción no pertenece al cliente.'}
            )

        return attrs

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, validated_data):
        request = self.context.get('request')
        actor = getattr(request, 'user', None)
        if not actor or not actor.is_authenticated:
            raise serializers.ValidationError('Autenticación requerida.')

        actor_role = getattr(actor, 'role', None)
        is_trainer_actor = actor_role == User.Role.TRAINER
        is_admin_actor = is_admin_user(actor)
        min_advance_hours = 0 if (is_trainer_actor or is_admin_actor) else MIN_ADVANCE_HOURS

        customer = validated_data.pop('customer', None) or actor
        trainer = validated_data['trainer']
        starts_at = validated_data['starts_at']
        subscription = validated_data.get('subscription')

        with transaction.atomic():
            TrainerProfile.objects.select_for_update().get(pk=trainer.pk)
            if not is_start_time_available(
                trainer, starts_at, now=timezone.now(), min_advance_hours=min_advance_hours,
            ):
                raise serializers.ValidationError(
                    {'starts_at': 'Ese horario ya no está disponible.'}
                )
            if subscription:
                sub = Subscription.objects.select_for_update().get(pk=subscription.pk)
                if sub.sessions_remaining <= 0:
                    raise serializers.ValidationError(
                        {'subscription_id': 'La suscripción no tiene sesiones disponibles.'}
                    )
                sub.sessions_used = db_models.F('sessions_used') + 1
                sub.save(update_fields=['sessions_used'])
                validated_data['subscription'] = sub

            booking = Booking.objects.create(
                customer=customer,
                status=Booking.Status.PENDING,
                **validated_data,
            )

        return booking
