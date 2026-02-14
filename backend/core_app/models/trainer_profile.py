from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class TrainerProfile(TimestampedModel):
    """Profile for users with the 'trainer' role.

    Stores trainer-specific data such as specialty, bio, training location,
    and default session duration. Linked 1-to-1 with a User instance whose
    role must be 'trainer'.

    Attributes:
        user: One-to-one link to the User model (role=trainer).
        specialty: Short description of the trainer's specialty.
        bio: Extended biography or description (optional).
        location: Physical address where in-person sessions take place.
        session_duration_minutes: Default session length in minutes.
    """

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trainer_profile',
        limit_choices_to={'role': 'trainer'},
    )
    specialty = models.CharField(max_length=255)
    bio = models.TextField(blank=True)
    location = models.CharField(
        max_length=500,
        blank=True,
        help_text='Physical address for in-person training sessions.',
    )
    session_duration_minutes = models.PositiveIntegerField(default=60)

    class Meta:
        ordering = ('user__first_name',)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} — {self.specialty}"
