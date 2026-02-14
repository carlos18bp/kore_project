import pytest

from core_app.models import FAQItem, SiteSettings
from core_app.serializers import FAQItemSerializer, SiteSettingsSerializer


@pytest.mark.django_db
class TestSiteSettingsSerializer:
    def test_serialization_fields(self):
        obj = SiteSettings.load()
        obj.company_name = 'KÓRE'
        obj.save()
        data = SiteSettingsSerializer(obj).data
        expected_fields = {
            'id', 'company_name', 'email', 'phone', 'whatsapp',
            'address', 'instagram_url', 'facebook_url', 'footer_text',
        }
        assert set(data.keys()) == expected_fields
        assert data['company_name'] == 'KÓRE'

    def test_partial_update(self):
        obj = SiteSettings.load()
        serializer = SiteSettingsSerializer(obj, data={'phone': '555-1234'}, partial=True)
        assert serializer.is_valid(), serializer.errors
        updated = serializer.save()
        assert updated.phone == '555-1234'


@pytest.mark.django_db
class TestFAQItemSerializer:
    def test_serialization_fields(self):
        faq = FAQItem.objects.create(question='Q?', answer='A.', order=1)
        data = FAQItemSerializer(faq).data
        expected_fields = {
            'id', 'question', 'answer', 'is_active', 'order',
            'created_at', 'updated_at',
        }
        assert set(data.keys()) == expected_fields
        assert data['question'] == 'Q?'

    def test_read_only_timestamps(self):
        serializer = FAQItemSerializer(data={
            'question': 'Q?',
            'answer': 'A.',
            'created_at': '2020-01-01T00:00:00Z',
        })
        assert serializer.is_valid(), serializer.errors
        faq = serializer.save()
        assert str(faq.created_at) != '2020-01-01 00:00:00+00:00'

    def test_deserialization_creates_faq(self):
        serializer = FAQItemSerializer(data={'question': 'New?', 'answer': 'Yes.'})
        assert serializer.is_valid(), serializer.errors
        faq = serializer.save()
        assert faq.pk is not None
        assert faq.question == 'New?'
