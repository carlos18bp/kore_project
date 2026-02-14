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
    - Customer must not have another pending/confirmed future booking
      ("only next session" rule).
    - No time-overlap with the customer's other active bookings.
    - If a subscription is provided, it must have remaining sessions.
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
        2. "Only next session" — customer has no pending/confirmed future booking.
        3. Anti-overlap — requested slot does not overlap another active booking
           of the same customer.
        4. Subscription (if provided) has remaining sessions.

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
            self._validate_only_next_session(customer)
            self._validate_no_overlap(customer, slot)

        subscription = attrs.get('subscription')
        if subscription and subscription.sessions_remaining <= 0:
            raise serializers.ValidationError(
                {'subscription_id': 'Subscription has no remaining sessions.'}
            )

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
            raise serializers.ValidationError({'slot_id': 'Slot is not active.'})
        if slot.is_blocked:
            raise serializers.ValidationError({'slot_id': 'Slot is blocked.'})
        if slot.ends_at <= timezone.now():
            raise serializers.ValidationError({'slot_id': 'Slot is in the past.'})
        if Booking.objects.filter(slot=slot).exclude(status=Booking.Status.CANCELED).exists():
            raise serializers.ValidationError({'slot_id': 'Slot is already booked.'})

    @staticmethod
    def _validate_only_next_session(customer):
        """Ensure the customer does not already have a future active booking.

        Args:
            customer: User instance.

        Raises:
            serializers.ValidationError: If a future active booking exists.
        """
        has_active_future = Booking.objects.filter(
            customer=customer,
            status__in=[Booking.Status.PENDING, Booking.Status.CONFIRMED],
            slot__ends_at__gt=timezone.now(),
        ).exists()
        if has_active_future:
            raise serializers.ValidationError(
                {'non_field_errors': 'You already have an upcoming session. Cancel or complete it before booking another.'}
            )

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
                {'slot_id': 'This time overlaps with another active booking.'}
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
            raise serializers.ValidationError('Authentication required.')

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
                raise serializers.ValidationError({'slot_id': 'Slot is not available.'})

            slot.is_blocked = True
            slot.save(update_fields=['is_blocked'])

            if subscription:
                sub = Subscription.objects.select_for_update().get(pk=subscription.pk)
                if sub.sessions_remaining <= 0:
                    raise serializers.ValidationError(
                        {'subscription_id': 'Subscription has no remaining sessions.'}
                    )
                sub.sessions_used = db_models.F('sessions_used') + 1
                sub.save(update_fields=['sessions_used'])
                validated_data['subscription'] = sub

            booking = Booking.objects.create(
                customer=customer,
                status=Booking.Status.CONFIRMED,
                **validated_data,
            )

        return booking
