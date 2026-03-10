from django.conf import settings
from django.db import models

from core_app.models.base import TimestampedModel


class CustomerProfile(TimestampedModel):
    """Profile for users with the 'customer' role.

    Stores customer-specific data such as personal info, identification,
    fitness goal, city, and profile photo. Linked 1-to-1 with a User
    instance whose role must be 'customer'.
    """

    class Sex(models.TextChoices):
        MASCULINO = 'masculino', 'Masculino'
        FEMENINO = 'femenino', 'Femenino'
        OTRO = 'otro', 'Otro'
        PREFIERO_NO_DECIR = 'prefiero_no_decir', 'Prefiero no decir'

    class Goal(models.TextChoices):
        FAT_LOSS = 'fat_loss', 'Perder grasa'
        MUSCLE_GAIN = 'muscle_gain', 'Ganar masa muscular'
        REHAB = 'rehab', 'Rehabilitación'
        GENERAL_HEALTH = 'general_health', 'Salud general'
        SPORTS_PERFORMANCE = 'sports_performance', 'Rendimiento deportivo'

    class IdType(models.TextChoices):
        TI = 'ti', 'Tarjeta de identidad'
        CC = 'cc', 'Cédula de ciudadanía'
        CE = 'ce', 'Cédula de extranjería'
        PASAPORTE = 'pasaporte', 'Pasaporte'
        DNI = 'dni', 'DNI'

    user = models.OneToOneField(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='customer_profile',
        limit_choices_to={'role': 'customer'},
    )
    avatar = models.ImageField(upload_to='avatars/', blank=True)
    sex = models.CharField(max_length=20, choices=Sex.choices, blank=True)
    date_of_birth = models.DateField(
        null=True, blank=True,
        help_text='Fecha de nacimiento del cliente.',
    )
    eps = models.CharField(
        max_length=255, blank=True,
        help_text='EPS del cliente.',
    )
    id_type = models.CharField(
        max_length=20, choices=IdType.choices, blank=True,
        help_text='Tipo de documento de identidad.',
    )
    id_number = models.CharField(
        max_length=50, blank=True,
        help_text='Número de documento de identidad.',
    )
    id_expedition_date = models.DateField(
        null=True, blank=True,
        help_text='Fecha de expedición del documento.',
    )
    address = models.CharField(
        max_length=500, blank=True,
        help_text='Dirección de residencia.',
    )
    height_cm = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text='Estatura en centímetros (dato del entrenador).',
    )
    current_weight_kg = models.DecimalField(
        max_digits=5, decimal_places=1, null=True, blank=True,
        help_text='Peso actual en kilogramos (dato del entrenador).',
    )
    city = models.CharField(max_length=255, blank=True)
    primary_goal = models.CharField(
        max_length=30, choices=Goal.choices, blank=True,
    )
    kore_start_date = models.DateField(
        null=True, blank=True,
        help_text='Fecha de inicio en KÓRE. Se auto-asigna desde date_joined si no se indica.',
    )
    profile_completed = models.BooleanField(default=False)

    class Meta:
        ordering = ('user__first_name',)

    def __str__(self):
        return f"{self.user.first_name} {self.user.last_name} — perfil cliente"

    def save(self, *args, **kwargs):
        if not self.kore_start_date and self.user_id:
            self.kore_start_date = self.user.date_joined.date()
        self._compute_profile_completed()
        super().save(*args, **kwargs)

    def _compute_profile_completed(self):
        """Mark profile as completed when key fields are filled."""
        self.profile_completed = all([
            self.user.first_name,
            self.user.last_name,
            self.sex,
            self.date_of_birth is not None,
            self.city,
            self.primary_goal,
        ])
