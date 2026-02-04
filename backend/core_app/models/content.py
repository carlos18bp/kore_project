from django.db import models

from core_app.models.base import SingletonModel, TimestampedModel


class SiteSettings(SingletonModel):
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    whatsapp = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=255, blank=True)

    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)

    footer_text = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'Site settings'
        verbose_name_plural = 'Site settings'

    def __str__(self):
        return 'Site settings'


class FAQItem(TimestampedModel):
    question = models.CharField(max_length=255)
    answer = models.TextField()

    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ('order', 'id')

    def __str__(self):
        return self.question
