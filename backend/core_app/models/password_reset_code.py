import secrets
from datetime import timedelta

from django.conf import settings
from django.db import models
from django.utils import timezone

from core_app.models.base import TimestampedModel


class PasswordResetCode(TimestampedModel):
    """6-digit verification code sent via email for password reset.

    Codes expire after 10 minutes and are single-use.
    """

    CODE_LENGTH = 6
    EXPIRY_MINUTES = 10

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='password_reset_codes',
    )
    code = models.CharField(max_length=6)
    expires_at = models.DateTimeField()
    used = models.BooleanField(default=False)

    class Meta:
        ordering = ('-created_at',)

    def __str__(self):
        return f"Reset code for {self.user.email} ({'used' if self.used else 'active'})"

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
        return ''.join(secrets.choice('0123456789') for _ in range(PasswordResetCode.CODE_LENGTH))

    @classmethod
    def create_for_user(cls, user):
        """Invalidate previous codes and create a new one."""
        cls.objects.filter(user=user, used=False).update(used=True)
        return cls.objects.create(user=user)
