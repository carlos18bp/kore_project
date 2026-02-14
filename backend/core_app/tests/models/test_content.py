import pytest

from core_app.models import FAQItem, SiteSettings


@pytest.mark.django_db
class TestSiteSettingsModel:
    def test_singleton_always_pk_1(self):
        obj = SiteSettings.load()
        assert obj.pk == 1

        obj.company_name = 'KÓRE'
        obj.save()

        obj2 = SiteSettings.load()
        assert obj2.pk == 1
        assert obj2.company_name == 'KÓRE'
        assert SiteSettings.objects.count() == 1

    def test_save_forces_pk_1(self):
        obj = SiteSettings()
        obj.company_name = 'Test'
        obj.save()
        assert obj.pk == 1

    def test_str(self):
        obj = SiteSettings.load()
        assert str(obj) == 'Site settings'


@pytest.mark.django_db
class TestFAQItemModel:
    def test_defaults(self):
        faq = FAQItem.objects.create(question='Q?', answer='A.')
        assert faq.is_active is True
        assert faq.order == 0

    def test_str_returns_question(self):
        faq = FAQItem.objects.create(question='How?', answer='Like this.')
        assert str(faq) == 'How?'

    def test_ordering_by_order_then_id(self):
        f2 = FAQItem.objects.create(question='Second', answer='a', order=2)
        f1 = FAQItem.objects.create(question='First', answer='a', order=1)
        f3 = FAQItem.objects.create(question='Third', answer='a', order=1)
        ids = list(FAQItem.objects.values_list('id', flat=True))
        assert ids == [f1.id, f3.id, f2.id]
