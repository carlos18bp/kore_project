from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core_app.forms import UserChangeForm, UserCreationForm
from core_app.models import (
    AnalyticsEvent,
    AvailabilitySlot,
    Booking,
    ContactMessage,
    FAQCategory,
    FAQItem,
    Notification,
    Package,
    Payment,
    SiteSettings,
    Subscription,
    TrainerProfile,
    User,
)


class SubscriptionAdminForm(forms.ModelForm):
    class Meta:
        model = Subscription
        fields = '__all__'

    def clean(self):
        cleaned_data = super().clean()
        package = cleaned_data.get('package')

        if package:
            cleaned_data['sessions_total'] = package.sessions_count
            self.instance.sessions_total = package.sessions_count

        return cleaned_data


@admin.register(User)
class UserAdmin(DjangoUserAdmin):
    add_form = UserCreationForm
    form = UserChangeForm
    model = User

    ordering = ('email',)
    list_display = ('email', 'first_name', 'last_name', 'role', 'is_staff', 'is_active')
    list_filter = ('role', 'is_staff', 'is_active')
    search_fields = ('email', 'first_name', 'last_name')

    fieldsets = (
        (None, {'fields': ('email', 'password')}),
        ('Personal info', {'fields': ('first_name', 'last_name', 'phone')}),
        ('Role', {'fields': ('role',)}),
        (
            'Permissions',
            {
                'fields': (
                    'is_active',
                    'is_staff',
                    'is_superuser',
                    'groups',
                    'user_permissions',
                )
            },
        ),
        ('Important dates', {'fields': ('last_login', 'date_joined')}),
    )

    add_fieldsets = (
        (
            None,
            {
                'classes': ('wide',),
                'fields': ('email', 'password1', 'password2', 'role'),
            },
        ),
    )

    readonly_fields = ('date_joined',)
    filter_horizontal = ('groups', 'user_permissions')


@admin.register(Package)
class PackageAdmin(admin.ModelAdmin):
    list_display = ('title', 'category', 'sessions_count', 'price', 'currency', 'validity_days', 'is_active', 'order')
    list_filter = ('is_active', 'currency', 'category')
    search_fields = ('title', 'category')
    ordering = ('order', 'id')


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ('starts_at', 'ends_at', 'trainer', 'is_active', 'is_blocked')
    list_filter = ('is_active', 'is_blocked', 'trainer')
    ordering = ('starts_at',)
    search_fields = ('starts_at', 'ends_at')
    autocomplete_fields = ('trainer',)


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'package', 'slot', 'trainer', 'subscription', 'status', 'created_at')
    list_filter = ('status', 'trainer')
    search_fields = ('customer__email',)
    autocomplete_fields = ('customer', 'package', 'slot', 'trainer', 'subscription')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'subscription', 'customer', 'status', 'amount', 'currency', 'provider', 'created_at')
    list_filter = ('status', 'provider', 'currency')
    search_fields = ('provider_reference', 'customer__email')
    autocomplete_fields = ('booking', 'subscription', 'customer')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'notification_type', 'status', 'sent_to', 'created_at')
    list_filter = ('notification_type', 'status')
    search_fields = ('sent_to', 'provider_message_id')
    autocomplete_fields = ('booking', 'payment')


@admin.register(FAQCategory)
class FAQCategoryAdmin(admin.ModelAdmin):
    list_display = ('name', 'slug', 'is_active', 'order', 'created_at')
    list_filter = ('is_active',)
    ordering = ('order', 'id')
    search_fields = ('name', 'slug')
    prepopulated_fields = {'slug': ('name',)}


@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = ('question', 'category', 'is_active', 'order', 'created_at')
    list_filter = ('is_active', 'category')
    ordering = ('order', 'id')
    search_fields = ('question',)
    autocomplete_fields = ('category',)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'email', 'phone', 'whatsapp', 'city', 'business_hours')


@admin.register(ContactMessage)
class ContactMessageAdmin(admin.ModelAdmin):
    list_display = ('name', 'email', 'phone', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('name', 'email', 'phone', 'message')
    readonly_fields = ('name', 'email', 'phone', 'message', 'created_at', 'updated_at')
    ordering = ('-created_at',)


@admin.register(TrainerProfile)
class TrainerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'specialty', 'location', 'session_duration_minutes')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'specialty')
    autocomplete_fields = ('user',)


@admin.register(Subscription)
class SubscriptionAdmin(admin.ModelAdmin):
    form = SubscriptionAdminForm
    list_display = ('id', 'customer', 'package', 'package_program', 'status', 'sessions_total', 'sessions_used', 'starts_at', 'expires_at', 'next_billing_date')
    list_filter = ('status',)
    search_fields = ('customer__email', 'package__title')
    autocomplete_fields = ('customer', 'package')
    readonly_fields = ('sessions_total', 'payment_source_id', 'wompi_transaction_id')

    @admin.display(description='Program')
    def package_program(self, obj):
        return obj.package.get_category_display()

    def save_model(self, request, obj, form, change):
        if obj.package_id:
            obj.sessions_total = obj.package.sessions_count
        super().save_model(request, obj, form, change)


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'user', 'path', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('user__email', 'path', 'referrer', 'session_id')
