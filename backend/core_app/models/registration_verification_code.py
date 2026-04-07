import secrets
from datetime import timedelta

from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class RegistrationVerificationCode(TimestampedModel):
    """6-digit verification code sent via email during registration.

    Keyed on email (not a User FK) because the user does not exist yet.
    Codes expire after 10 minutes and are single-use.
    """

    CODE_LENGTH = 6
    EXPIRY_MINUTES = 10

    email = models.EmailField(db_index=True)
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Registration code for {self.email} ({'used' if self.used else 'active'})"

    def save(self, *args, **kwargs):
        if not self.code:
            self.code = self._generate_code()
        if not self.expires_at:
            self.expires_at = timezone.now() + timedelta(minutes=self.EXPIRY_MINUTES)
        super().save(*args, **kwargs)

    @property
    def is_valid(self):
        return not self.used and timezone.now() < self.expires_at

    @staticmethod
    def _generate_code():
        return ''.join(secrets.choice('0123456789') for _ in range(RegistrationVerificationCode.CODE_LENGTH))

    @classmethod
    def create_for_email(cls, email):
        """Invalidate previous codes and create a new one."""
        cls.objects.filter(email=email, used=False).update(used=True)
        return cls.objects.create(email=email)

    @classmethod
    def recent_count(cls, email, hours=1):
        """Count codes created for this email in the last N hours."""
        cutoff = timezone.now() - timedelta(hours=hours)
        return cls.objects.filter(email=email, created_at__gte=cutoff).count()
