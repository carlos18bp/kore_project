from rest_framework import serializers

from core_app.models import FAQItem, SiteSettings


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
            'instagram_url',
            'facebook_url',
            'footer_text',
        )


class FAQItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = FAQItem
        fields = (
            'id',
            'question',
            'answer',
            'is_active',
            'order',
            'created_at',
            'updated_at',
        )
        read_only_fields = ('created_at', 'updated_at')
