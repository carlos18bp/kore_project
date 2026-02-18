from django.db import models as db_models, transaction
from django.utils import timezone
from rest_framework import serializers

from core_app.models import AvailabilitySlot, Booking, Package, Subscription, TrainerProfile
from core_app.serializers.availability_serializers import AvailabilitySlotSerializer
from core_app.serializers.package_serializers import PackageSerializer
from core_app.serializers.trainer_profile_serializers import TrainerProfileSerializer


class BookingSerializer(serializers.ModelSerializer):
    """Serializer for creating and reading Booking instances.

    On **read**, nests full representations of package, slot, and trainer.
    On **write**, accepts ``package_id``, ``slot_id``, ``trainer_id``, and
    ``subscription_id`` as primary-key references.

    Validations enforced on create:
    - Slot must be active, unblocked, and in the future.
    - Slot must not already be booked.
    - No time-overlap with the customer's other active bookings.
    - If a subscription is provided, it must have remaining sessions.
    - New session must start after the end of the last session in the same subscription.
    """

    customer_id = serializers.IntegerField(read_only=True, source='customer.id')

    package = PackageSerializer(read_only=True)
    slot = AvailabilitySlotSerializer(read_only=True)
    trainer = TrainerProfileSerializer(read_only=True)
    subscription_id_display = serializers.IntegerField(
        source='subscription.id', read_only=True, allow_null=True,
    )

    package_id = serializers.PrimaryKeyRelatedField(
        queryset=Package.objects.all(),
        write_only=True,
        source='package',
    )
    slot_id = serializers.PrimaryKeyRelatedField(
        queryset=AvailabilitySlot.objects.all(),
        write_only=True,
        source='slot',
    )
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
            'slot',
            'trainer',
            'subscription_id_display',
            'package_id',
            'slot_id',
            'trainer_id',
            'subscription_id',
            'status',
            'notes',
            'canceled_reason',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')

    # ------------------------------------------------------------------
    # Validation
    # ------------------------------------------------------------------

    def validate(self, attrs):
        """Run all booking creation validations.

        Checks performed:
        1. Slot is active, unblocked, future, and not already booked.
        2. Anti-overlap — requested slot does not overlap another active booking
           of the same customer.
        3. Subscription (if provided) has remaining sessions.

        Returns:
            dict: Validated attributes.

        Raises:
            serializers.ValidationError: If any check fails.
        """
        slot = attrs.get('slot')
        request = self.context.get('request')
        customer = getattr(request, 'user', None) if request else None

        if slot:
            self._validate_slot_available(slot)

        if customer and customer.is_authenticated and slot:
            self._validate_no_overlap(customer, slot)

        subscription = attrs.get('subscription')
        if subscription and subscription.sessions_remaining <= 0:
            raise serializers.ValidationError(
                {'subscription_id': 'La suscripción no tiene sesiones disponibles.'}
            )

        if subscription and slot:
            self._validate_chronological_order(subscription, slot)

        return attrs

    @staticmethod
    def _validate_slot_available(slot):
        """Ensure the slot is bookable (active, unblocked, future, free).

        Args:
            slot: AvailabilitySlot instance.

        Raises:
            serializers.ValidationError: If the slot cannot be booked.
        """
        if not slot.is_active:
            raise serializers.ValidationError({'slot_id': 'El horario no está activo.'})
        if slot.is_blocked:
            raise serializers.ValidationError({'slot_id': 'El horario está bloqueado.'})
        if slot.ends_at <= timezone.now():
            raise serializers.ValidationError({'slot_id': 'El horario ya pasó.'})
        if Booking.objects.filter(slot=slot).exclude(status=Booking.Status.CANCELED).exists():
            raise serializers.ValidationError({'slot_id': 'El horario ya está reservado.'})

    @staticmethod
    def _validate_no_overlap(customer, slot):
        """Ensure the requested slot does not overlap another active booking.

        Args:
            customer: User instance.
            slot: AvailabilitySlot to check against.

        Raises:
            serializers.ValidationError: If an overlapping booking exists.
        """
        overlapping = Booking.objects.filter(
            customer=customer,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            slot__starts_at__lt=slot.ends_at,
            slot__ends_at__gt=slot.starts_at,
        ).exists()
        if overlapping:
            raise serializers.ValidationError(
                {'slot_id': 'Este horario se cruza con otra reserva activa.'}
            )

    @staticmethod
    def _validate_chronological_order(subscription, slot):
        """Ensure the new session starts after the end of the last session in the same subscription.

        Args:
            subscription: Subscription instance.
            slot: AvailabilitySlot to check against.

        Raises:
            serializers.ValidationError: If the slot starts before the last session ends.
        """
        last_booking = Booking.objects.filter(
            subscription=subscription,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
        ).select_related('slot').order_by('-slot__ends_at').first()

        if last_booking and slot.starts_at < last_booking.slot.ends_at:
            raise serializers.ValidationError(
                {'slot_id': 'La sesión debe iniciar después del final de la última sesión del programa.'}
            )

    # ------------------------------------------------------------------
    # Create
    # ------------------------------------------------------------------

    def create(self, validated_data):
        """Create a booking with atomic slot locking and subscription decrement.

        Locks the slot row with ``select_for_update`` to prevent race conditions,
        marks it as blocked, creates the booking, and decrements the subscription's
        ``sessions_used`` counter when a subscription is provided.

        Args:
            validated_data: Dict of validated fields.

        Returns:
            Booking: The newly created booking instance.

        Raises:
            serializers.ValidationError: If the slot becomes unavailable between
                validation and creation (race condition guard).
        """
        request = self.context.get('request')
        customer = getattr(request, 'user', None)
        if not customer or not customer.is_authenticated:
            raise serializers.ValidationError('Autenticación requerida.')

        slot = validated_data['slot']
        subscription = validated_data.get('subscription')

        with transaction.atomic():
            slot = AvailabilitySlot.objects.select_for_update().get(pk=slot.pk)
            if (
                not slot.is_active
                or slot.is_blocked
                or slot.ends_at <= timezone.now()
                or Booking.objects.filter(slot=slot).exclude(status=Booking.Status.CANCELED).exists()
            ):
                raise serializers.ValidationError({'slot_id': 'El horario no está disponible.'})

            slot.is_blocked = True
            slot.save(update_fields=['is_blocked'])

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
