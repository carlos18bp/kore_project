from django.db import models

from .base import TimestampedModel


class Food(TimestampedModel):

    class Category(models.TextChoices):
        PROTEIN = 'proteina', 'Proteína'
        CARB = 'carbohidrato', 'Carbohidrato'
        HEALTHY_FAT = 'grasa_saludable', 'Grasa saludable'
        FRUIT = 'fruta', 'Fruta'
        VEGETABLE = 'verdura', 'Verdura'
        DAIRY = 'lacteo', 'Lácteo'
        SNACK = 'snack', 'Snack'
        BEVERAGE = 'bebida', 'Bebida'

    class Source(models.TextChoices):
        TACO = 'taco', 'TACO Brasil'
        OPENFOODFACTS = 'openfoodfacts', 'Open Food Facts'
        CURATED = 'curated', 'Curado manualmente'

    name = models.CharField(max_length=255)
    category = models.CharField(max_length=30, choices=Category.choices)
    subcategory = models.CharField(max_length=100, blank=True)
    calories_per_100g = models.DecimalField(max_digits=7, decimal_places=2, null=True, blank=True)
    protein_per_100g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    carbs_per_100g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    fat_per_100g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    fiber_per_100g = models.DecimalField(max_digits=6, decimal_places=2, null=True, blank=True)
    nova_group = models.PositiveSmallIntegerField(null=True, blank=True, help_text='1=unprocessed … 4=ultra-processed')
    nutri_score = models.CharField(max_length=1, blank=True, help_text='A–E')
    source = models.CharField(max_length=20, choices=Source.choices, default=Source.CURATED)
    is_active = models.BooleanField(default=True)

    class Meta:
        unique_together = [('name', 'source')]
        indexes = [
            models.Index(fields=['category']),
            models.Index(fields=['is_active']),
        ]

    def __str__(self):
        return self.name
