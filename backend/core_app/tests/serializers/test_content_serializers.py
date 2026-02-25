"""Tests for content-related serializers."""

import pytest

from core_app.models import ContactMessage, FAQCategory, FAQItem, SiteSettings
from core_app.serializers import (
    ContactMessageSerializer,
    FAQCategorySerializer,
    FAQItemSerializer,
    SiteSettingsSerializer,
)


@pytest.mark.django_db
class TestSiteSettingsSerializer:
    """Validate serialization and update behavior for site settings."""

    def test_serialization_fields(self):
        """Expose the expected public fields and persisted values in serializer output."""
        obj = SiteSettings.load()
        obj.company_name = 'KÓRE'
        obj.city = 'Medellín'
        obj.business_hours = '9-18'
        obj.save()
        data = SiteSettingsSerializer(obj).data
        expected_fields = {
            'id', 'company_name', 'email', 'phone', 'whatsapp',
            'address', 'city', 'business_hours', 'instagram_url', 'facebook_url', 'footer_text',
        }
        assert set(data.keys()) == expected_fields
        assert data['company_name'] == 'KÓRE'
        assert data['city'] == 'Medellín'
        assert data['business_hours'] == '9-18'

    def test_partial_update(self):
        """Persist partial updates without requiring full payload input."""
        obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(obj, data={'phone': '555-1234'}, partial=True)
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.phone == '555-1234'


@pytest.mark.django_db
class TestFAQCategorySerializer:
    """Validate FAQ category serializer read and write behavior."""

    def test_serialization_fields(self):
        """Expose expected FAQ category fields and values in serialized output."""
        cat = FAQCategory.objects.create(name='General', slug='general', order=1)
        data = FAQCategorySerializer(cat).data
        expected_fields = {
            'id', 'name', 'slug', 'order', 'is_active',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['name'] == 'General'
        assert data['slug'] == 'general'

    def test_deserialization_creates_category(self):
        """Create FAQ category instances from valid serializer input."""
        serializer = FAQCategorySerializer(data={'name': 'New', 'slug': 'new'})
        assert serializer.is_valid(), serializer.errors
        cat = serializer.save()
        assert cat.pk is not None
        assert cat.name == 'New'


@pytest.mark.django_db
class TestFAQItemSerializer:
    """Validate FAQ item serializer field mapping and persistence behavior."""

    def test_serialization_fields(self):
        """Expose FAQ item fields including derived category_name in output."""
        cat = FAQCategory.objects.create(name='General', slug='general')
        faq = FAQItem.objects.create(question='Q?', answer='A.', order=1, category=cat)
        data = FAQItemSerializer(faq).data
        expected_fields = {
            'id', 'category', 'category_name', 'question', 'answer', 'is_active', 'order',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['question'] == 'Q?'
        assert data['category'] == cat.id
        assert data['category_name'] == 'General'

    def test_read_only_timestamps(self):
        """Ignore created_at input to preserve read-only timestamp semantics."""
        serializer = FAQItemSerializer(data={
            'question': 'Q?',
            'answer': 'A.',
            'created_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        faq = serializer.save()
        assert str(faq.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_faq(self):
        """Create FAQ items when serializer input is valid."""
        serializer = FAQItemSerializer(data={'question': 'New?', 'answer': 'Yes.'})
        assert serializer.is_valid(), serializer.errors
        faq = serializer.save()
        assert faq.pk is not None
        assert faq.question == 'New?'

    def test_category_name_null_when_no_category(self):
        """Return null category_name when FAQ item has no linked category."""
        faq = FAQItem.objects.create(question='Q?', answer='A.')
        data = FAQItemSerializer(faq).data
        assert data['category'] is None
        assert data['category_name'] is None


@pytest.mark.django_db
class TestContactMessageSerializer:
    """Validate contact message serializer read and write behavior."""

    def test_serialization_fields(self):
        """Serialize contact messages with expected fields and default status value."""
        msg = ContactMessage.objects.create(
            name='John',
            email='john@example.com',
            phone='+57 300',
            message='Hello!',
        )
        data = ContactMessageSerializer(msg).data
        expected_fields = {
            'id', 'name', 'email', 'phone', 'message', 'status',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['name'] == 'John'
        assert data['status'] == 'new'

    def test_status_read_only(self):
        """Ignore status input and keep default NEW status on creation."""
        serializer = ContactMessageSerializer(data={
            'name': 'Test',
            'email': 'test@test.com',
            'message': 'Hi',
            'status': 'replied',
        })
        assert serializer.is_valid(), serializer.errors
        msg = serializer.save()
        assert msg.status == ContactMessage.Status.NEW

    def test_deserialization_creates_message(self):
        """Persist contact message records from valid serializer payloads."""
        serializer = ContactMessageSerializer(data={
            'name': 'Jane',
            'email': 'jane@example.com',
            'message': 'Question',
        })
        assert serializer.is_valid(), serializer.errors
        msg = serializer.save()
        assert msg.pk is not None
        assert msg.name == 'Jane'
