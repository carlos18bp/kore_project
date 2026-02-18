from django.db import models

from core_app.models.base import SingletonModel, TimestampedModel


class SiteSettings(SingletonModel):
    company_name = models.CharField(max_length=255, blank=True)
    email = models.EmailField(blank=True)
    phone = models.CharField(max_length=50, blank=True)
    whatsapp = models.CharField(max_length=50, blank=True)
    address = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    business_hours = models.CharField(max_length=255, blank=True)

    instagram_url = models.URLField(blank=True)
    facebook_url = models.URLField(blank=True)

    footer_text = models.CharField(max_length=255, blank=True)

    class Meta:
        verbose_name = 'Site settings'
        verbose_name_plural = 'Site settings'

    def __str__(self):
        return 'Site settings'


class FAQCategory(TimestampedModel):
    name = models.CharField(max_length=100)
    slug = models.SlugField(max_length=100, unique=True)
    order = models.PositiveIntegerField(default=0, db_index=True)
    is_active = models.BooleanField(default=True, db_index=True)

    class Meta:
        ordering = ('order', 'id')
        verbose_name = 'FAQ category'
        verbose_name_plural = 'FAQ categories'

    def __str__(self):
        return self.name


class FAQItem(TimestampedModel):
    category = models.ForeignKey(
        FAQCategory,
        on_delete=models.SET_NULL,
        related_name='items',
        null=True,
        blank=True,
    )
    question = models.CharField(max_length=255)
    answer = models.TextField()

    is_active = models.BooleanField(default=True, db_index=True)
    order = models.PositiveIntegerField(default=0, db_index=True)

    class Meta:
        ordering = ('order', 'id')

    def __str__(self):
        return self.question


class ContactMessage(TimestampedModel):
    class Status(models.TextChoices):
        NEW = 'new', 'New'
        READ = 'read', 'Read'
        REPLIED = 'replied', 'Replied'
        ARCHIVED = 'archived', 'Archived'

    name = models.CharField(max_length=150)
    email = models.EmailField()
    phone = models.CharField(max_length=50, blank=True)
    message = models.TextField()
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.NEW,
        db_index=True,
    )

    class Meta:
        ordering = ('-created_at',)
        verbose_name = 'Contact message'
        verbose_name_plural = 'Contact messages'

    def __str__(self):
        return f'{self.name} — {self.email}'
