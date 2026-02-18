import pytest

from core_app.models import ContactMessage, FAQCategory, FAQItem, SiteSettings


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

    def test_city_and_business_hours_fields(self):
        obj = SiteSettings.load()
        obj.city = 'Medellín'
        obj.business_hours = 'Lunes a Viernes: 9-18'
        obj.save()

        obj2 = SiteSettings.load()
        assert obj2.city == 'Medellín'
        assert obj2.business_hours == 'Lunes a Viernes: 9-18'


@pytest.mark.django_db
class TestFAQCategoryModel:
    def test_defaults(self):
        cat = FAQCategory.objects.create(name='General', slug='general')
        assert cat.is_active is True
        assert cat.order == 0

    def test_str_returns_name(self):
        cat = FAQCategory.objects.create(name='Payments', slug='payments')
        assert str(cat) == 'Payments'

    def test_ordering_by_order_then_id(self):
        c2 = FAQCategory.objects.create(name='Cat2', slug='cat2', order=2)
        c1 = FAQCategory.objects.create(name='Cat1', slug='cat1', order=1)
        c3 = FAQCategory.objects.create(name='Cat3', slug='cat3', order=1)
        ids = list(FAQCategory.objects.values_list('id', flat=True))
        assert ids == [c1.id, c3.id, c2.id]

    def test_slug_unique(self):
        FAQCategory.objects.create(name='Test', slug='test')
        with pytest.raises(Exception):
            FAQCategory.objects.create(name='Test2', slug='test')


@pytest.mark.django_db
class TestFAQItemModel:
    def test_defaults(self):
        faq = FAQItem.objects.create(question='Q?', answer='A.')
        assert faq.is_active is True
        assert faq.order == 0
        assert faq.category is None

    def test_str_returns_question(self):
        faq = FAQItem.objects.create(question='How?', answer='Like this.')
        assert str(faq) == 'How?'

    def test_ordering_by_order_then_id(self):
        f2 = FAQItem.objects.create(question='Second', answer='a', order=2)
        f1 = FAQItem.objects.create(question='First', answer='a', order=1)
        f3 = FAQItem.objects.create(question='Third', answer='a', order=1)
        ids = list(FAQItem.objects.values_list('id', flat=True))
        assert ids == [f1.id, f3.id, f2.id]

    def test_category_fk_optional(self):
        cat = FAQCategory.objects.create(name='General', slug='general')
        faq = FAQItem.objects.create(question='Q?', answer='A.', category=cat)
        assert faq.category == cat
        assert faq in cat.items.all()

    def test_category_set_null_on_delete(self):
        cat = FAQCategory.objects.create(name='Test', slug='test')
        faq = FAQItem.objects.create(question='Q?', answer='A.', category=cat)
        cat.delete()
        faq.refresh_from_db()
        assert faq.category is None


@pytest.mark.django_db
class TestContactMessageModel:
    def test_defaults(self):
        msg = ContactMessage.objects.create(
            name='John Doe',
            email='john@example.com',
            message='Hello!',
        )
        assert msg.status == ContactMessage.Status.NEW
        assert msg.phone == ''

    def test_str_returns_name_and_email(self):
        msg = ContactMessage.objects.create(
            name='Jane',
            email='jane@example.com',
            message='Hi',
        )
        assert 'Jane' in str(msg)
        assert 'jane@example.com' in str(msg)

    def test_ordering_by_created_at_desc(self):
        m1 = ContactMessage.objects.create(name='First', email='a@a.com', message='m')
        m2 = ContactMessage.objects.create(name='Second', email='b@b.com', message='m')
        ids = list(ContactMessage.objects.values_list('id', flat=True))
        assert ids == [m2.id, m1.id]

    def test_status_choices(self):
        msg = ContactMessage.objects.create(
            name='Test',
            email='test@test.com',
            message='Test',
            status=ContactMessage.Status.REPLIED,
        )
        assert msg.status == 'replied'
