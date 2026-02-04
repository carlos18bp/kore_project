from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin

from core_app.forms import UserChangeForm, UserCreationForm
from core_app.models import (
    AnalyticsEvent,
    AvailabilitySlot,
    Booking,
    FAQItem,
    Notification,
    Package,
    Payment,
    SiteSettings,
    User,
)


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
    list_display = ('title', 'sessions_count', 'price', 'currency', 'validity_days', 'is_active', 'order')
    list_filter = ('is_active', 'currency')
    search_fields = ('title',)
    ordering = ('order', 'id')


@admin.register(AvailabilitySlot)
class AvailabilitySlotAdmin(admin.ModelAdmin):
    list_display = ('starts_at', 'ends_at', 'is_active', 'is_blocked')
    list_filter = ('is_active', 'is_blocked')
    ordering = ('starts_at',)
    search_fields = ('starts_at', 'ends_at')


@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'package', 'slot', 'status', 'created_at')
    list_filter = ('status',)
    search_fields = ('customer__email',)
    autocomplete_fields = ('customer', 'package', 'slot')


@admin.register(Payment)
class PaymentAdmin(admin.ModelAdmin):
    list_display = ('id', 'booking', 'customer', 'status', 'amount', 'currency', 'provider', 'created_at')
    list_filter = ('status', 'provider', 'currency')
    search_fields = ('provider_reference', 'customer__email')
    autocomplete_fields = ('booking', 'customer')


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ('id', 'notification_type', 'status', 'sent_to', 'created_at')
    list_filter = ('notification_type', 'status')
    search_fields = ('sent_to', 'provider_message_id')
    autocomplete_fields = ('booking', 'payment')


@admin.register(FAQItem)
class FAQItemAdmin(admin.ModelAdmin):
    list_display = ('question', 'is_active', 'order', 'created_at')
    list_filter = ('is_active',)
    ordering = ('order', 'id')
    search_fields = ('question',)


@admin.register(SiteSettings)
class SiteSettingsAdmin(admin.ModelAdmin):
    list_display = ('company_name', 'email', 'phone', 'whatsapp')


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'user', 'path', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('user__email', 'path', 'referrer', 'session_id')
