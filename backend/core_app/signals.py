from django.db.models.signals import post_save
from django.dispatch import receiver

from core_app.models.user import User


@receiver(post_save, sender=User)
def create_customer_profile(sender, instance, created, **kwargs):
    """Auto-create a CustomerProfile when a customer user is created."""
    if created and instance.role == User.Role.CUSTOMER:
        from core_app.models.customer_profile import CustomerProfile
        CustomerProfile.objects.get_or_create(user=instance)
