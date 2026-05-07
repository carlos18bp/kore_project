from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class TrainerMessage(TimestampedModel):
    class TriggerType(models.TextChoices):
        POST_SESSION = 'post_session', 'Post sesión'
        POST_MILESTONE = 'post_milestone', 'Post hito'
        MANUAL = 'manual', 'Manual'

    customer = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='trainer_messages',
        limit_choices_to={'role': 'customer'},
    )
    trainer = models.ForeignKey(
        'core_app.TrainerProfile',
        on_delete=models.CASCADE,
        related_name='sent_messages',
    )
    trigger_type = models.CharField(
        max_length=20,
        choices=TriggerType.choices,
        default=TriggerType.MANUAL,
    )
    trigger_ref_id = models.PositiveIntegerField(null=True, blank=True)
    message = models.TextField()
    is_visible = models.BooleanField(default=True)
    seen_by_customer = models.BooleanField(default=False, db_index=True)
    seen_at = models.DateTimeField(null=True, blank=True)
    dismissed_at = models.DateTimeField(null=True, blank=True, db_index=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.trainer} → {self.customer}: {self.trigger_type}'
