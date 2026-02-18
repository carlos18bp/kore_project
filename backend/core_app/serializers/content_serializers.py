from rest_framework import serializers

from core_app.models import ContactMessage, FAQCategory, FAQItem, SiteSettings


class SiteSettingsSerializer(serializers.ModelSerializer):
    class Meta:
        model = SiteSettings
        fields = (
            'id',
            'company_name',
            'email',
            'phone',
            'whatsapp',
            'address',
            'city',
            'business_hours',
            'instagram_url',
            'facebook_url',
            'footer_text',
        )


class FAQCategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQCategory
        fields = (
            'id',
            'name',
            'slug',
            'order',
            'is_active',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')


class FAQItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(source='category.name', read_only=True, default=None)

    class Meta:
        model = FAQItem
        fields = (
            'id',
            'category',
            'category_name',
            'question',
            'answer',
            'is_active',
            'order',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')


class ContactMessageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContactMessage
        fields = (
            'id',
            'name',
            'email',
            'phone',
            'message',
            'status',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('status', 'created_at', 'updated_at')
