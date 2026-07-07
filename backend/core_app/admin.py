from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as DjangoUserAdmin
from django.http import HttpResponseRedirect
from django.template.response import TemplateResponse
from django.urls import path, reverse
from django.utils import timezone
from django.utils.html import format_html

from core_app.forms import UserChangeForm, UserCreationForm
from core_app.models.posturometry import PosturometryEvaluation
from core_app.models.physical_evaluation import PhysicalEvaluation
from core_app.models.nutrition_habit import NutritionHabit
from core_app.models.parq_assessment import ParqAssessment
from core_app.models import (
    AnalyticsEvent,
    AnthropometryEvaluation,
    Booking,
    ContactMessage,
    CustomerProfile,
    DailyLog,
    Exercise,
    ExerciseLog,
    FAQCategory,
    FAQItem,
    MoodEntry,
    MonthlyProgram,
    Notification,
    Package,
    Payment,
    ProgramDay,
    ProgramExercise,
    SiteSettings,
    Subscription,
    SubscriptionGuest,
    TermsAcceptance,
    TrainerProfile,
    User,
    WeightEntry,
    Food,
    MealSuggestion,
    NutritionDailyLog,
    MealEntry,
    WaterGlassLog,
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



@admin.register(Booking)
class BookingAdmin(admin.ModelAdmin):
    list_display = ('id', 'customer', 'package', 'starts_at', 'trainer', 'subscription', 'status', 'created_at')
    list_filter = ('status', 'trainer')
    search_fields = ('customer__email',)
    autocomplete_fields = ('customer', 'package', 'trainer', 'subscription')


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
    list_display = ('id', 'customer', 'package', 'package_program', 'status', 'sessions_total', 'sessions_used', 'starts_at', 'expires_at', 'next_billing_date', 'renew_link')
    list_filter = ('status',)
    search_fields = ('customer__email', 'package__title')
    autocomplete_fields = ('customer', 'package')
    readonly_fields = ('sessions_total', 'payment_source_id', 'wompi_transaction_id')

    @admin.display(description='Program')
    def package_program(self, obj):
        return obj.package.get_category_display()

    @admin.display(description='Renovar')
    def renew_link(self, obj):
        is_expired = (
            obj.status == Subscription.Status.EXPIRED
            or (obj.status == Subscription.Status.ACTIVE and obj.expires_at <= timezone.now())
        )
        if not is_expired:
            return '-'
        url = reverse('admin:core_app_subscription_renew', args=[obj.pk])
        return format_html(
            '<a class="button" style="background:#28a745;color:#fff;padding:4px 12px;'
            'border-radius:4px;text-decoration:none;font-size:12px;" '
            'href="{}">Renovar</a>',
            url,
        )

    def get_urls(self):
        custom_urls = [
            path(
                '<int:subscription_id>/renew/',
                self.admin_site.admin_view(self.renew_subscription_view),
                name='core_app_subscription_renew',
            ),
        ]
        return custom_urls + super().get_urls()

    def renew_subscription_view(self, request, subscription_id):
        from datetime import timedelta

        old_sub = Subscription.objects.select_related('package', 'customer').get(pk=subscription_id)

        if request.method == 'POST':
            now = timezone.now()

            new_sub = Subscription.objects.create(
                customer=old_sub.customer,
                package=old_sub.package,
                sessions_total=old_sub.package.sessions_count,
                sessions_used=0,
                status=Subscription.Status.ACTIVE,
                starts_at=now,
                expires_at=now + timedelta(days=old_sub.package.validity_days),
                is_recurring=False,
            )

            if old_sub.status != Subscription.Status.EXPIRED:
                old_sub.status = Subscription.Status.EXPIRED
                old_sub.save(update_fields=['status'])

            Payment.objects.create(
                subscription=new_sub,
                customer=old_sub.customer,
                status=Payment.Status.CONFIRMED,
                amount=old_sub.package.price,
                currency=old_sub.package.currency,
                provider=Payment.Provider.CASH,
                confirmed_at=now,
                metadata={'renewed_from_subscription_id': old_sub.pk},
            )

            self.message_user(
                request,
                f'Suscripción renovada exitosamente. '
                f'Nueva suscripción #{new_sub.pk} creada para {old_sub.customer.email}.',
            )
            return HttpResponseRedirect(
                reverse('admin:core_app_subscription_changelist')
            )

        # GET — show confirmation page
        new_expires = timezone.now() + timedelta(days=old_sub.package.validity_days)
        context = {
            **self.admin_site.each_context(request),
            'title': 'Confirmar renovación de suscripción',
            'subscription': old_sub,
            'new_expires': new_expires,
            'opts': self.model._meta,
        }
        return TemplateResponse(
            request,
            'admin/core_app/subscription/renew_confirm.html',
            context,
        )

    def save_model(self, request, obj, form, change):
        if obj.package_id:
            obj.sessions_total = obj.package.sessions_count
        super().save_model(request, obj, form, change)


@admin.register(CustomerProfile)
class CustomerProfileAdmin(admin.ModelAdmin):
    list_display = ('user', 'sex', 'city', 'primary_goal', 'profile_completed')
    list_filter = ('sex', 'primary_goal', 'profile_completed')
    search_fields = ('user__email', 'user__first_name', 'user__last_name', 'city')
    autocomplete_fields = ('user',)
    readonly_fields = ('profile_completed', 'kore_start_date')


@admin.register(MoodEntry)
class MoodEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'score', 'date', 'created_at')
    list_filter = ('score', 'date')
    search_fields = ('user__email',)
    autocomplete_fields = ('user',)


@admin.register(WeightEntry)
class WeightEntryAdmin(admin.ModelAdmin):
    list_display = ('user', 'weight_kg', 'date', 'created_at')
    list_filter = ('date',)
    search_fields = ('user__email',)
    autocomplete_fields = ('user',)


@admin.register(AnalyticsEvent)
class AnalyticsEventAdmin(admin.ModelAdmin):
    list_display = ('event_type', 'user', 'path', 'created_at')
    list_filter = ('event_type',)
    search_fields = ('user__email', 'path', 'referrer', 'session_id')


@admin.register(TermsAcceptance)
class TermsAcceptanceAdmin(admin.ModelAdmin):
    list_display = ('user', 'terms_version', 'ip_address', 'accepted_at', 'created_at')
    list_filter = ('terms_version',)
    search_fields = ('user__email', 'ip_address')
    readonly_fields = ('user', 'terms_version', 'ip_address', 'user_agent', 'accepted_at', 'created_at')


@admin.register(AnthropometryEvaluation)
class AnthropometryEvaluationAdmin(admin.ModelAdmin):
    list_display = ('customer', 'trainer', 'evaluation_date', 'bmi', 'bmi_category', 'body_fat_pct', 'created_at')
    list_filter = ('bmi_color', 'bf_color', 'created_at')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = (
        'age_at_evaluation', 'bmi', 'bmi_category', 'bmi_color',
        'waist_hip_ratio', 'whr_risk', 'whr_color',
        'waist_height_ratio', 'whe_risk', 'whe_color',
        'body_fat_pct', 'bf_category', 'bf_color',
        'fat_mass_kg', 'lean_mass_kg', 'waist_risk', 'waist_risk_color',
    )


@admin.register(PosturometryEvaluation)
class PosturometryEvaluationAdmin(admin.ModelAdmin):
    list_display = ('customer', 'trainer', 'evaluation_date', 'global_index', 'global_category', 'created_at')
    list_filter = ('global_color', 'created_at')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = (
        'global_index', 'global_category', 'global_color',
        'upper_index', 'upper_category', 'upper_color',
        'central_index', 'central_category', 'central_color',
        'lower_index', 'lower_category', 'lower_color',
        'segment_scores', 'findings',
    )


@admin.register(PhysicalEvaluation)
class PhysicalEvaluationAdmin(admin.ModelAdmin):
    list_display = ('customer', 'trainer', 'evaluation_date', 'general_index', 'general_category', 'created_at')
    list_filter = ('general_color', 'created_at')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = (
        'age_at_evaluation', 'sex_at_evaluation',
        'squats_score', 'pushups_score', 'plank_score', 'walk_score', 'unipodal_score',
        'strength_index', 'strength_category', 'strength_color',
        'endurance_index', 'endurance_category', 'endurance_color',
        'mobility_index', 'mobility_category', 'mobility_color',
        'balance_index', 'balance_category', 'balance_color',
        'general_index', 'general_category', 'general_color',
        'cross_module_alerts',
    )


@admin.register(NutritionHabit)
class NutritionHabitAdmin(admin.ModelAdmin):
    list_display = ('customer', 'habit_score', 'habit_category', 'created_at')
    list_filter = ('habit_color', 'created_at')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = ('habit_score', 'habit_category', 'habit_color')


@admin.register(ParqAssessment)
class ParqAssessmentAdmin(admin.ModelAdmin):
    list_display = ('customer', 'yes_count', 'risk_label', 'risk_color', 'created_at')
    list_filter = ('risk_color', 'created_at')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = ('yes_count', 'risk_classification', 'risk_label', 'risk_color')


@admin.register(SubscriptionGuest)
class SubscriptionGuestAdmin(admin.ModelAdmin):
    list_display = ('subscription', 'invited_email', 'guest', 'status', 'accepted_at', 'created_at')
    list_filter = ('status', 'created_at')
    search_fields = ('invited_email', 'guest__email', 'subscription__customer__email')
    readonly_fields = ('token', 'accepted_at', 'created_at', 'updated_at')


@admin.register(Exercise)
class ExerciseAdmin(admin.ModelAdmin):
    list_display = ('name', 'pattern', 'exercise_type', 'main_implement', 'fitness_level_min', 'is_corrective', 'is_active')
    list_filter = ('fitness_level_min', 'is_corrective', 'is_active', 'exercise_type', 'pattern')
    search_fields = ('name', 'pattern', 'main_implement', 'primary_muscles')
    readonly_fields = ('created_at', 'updated_at')
    list_per_page = 50


@admin.register(MonthlyProgram)
class MonthlyProgramAdmin(admin.ModelAdmin):
    list_display = ('customer', 'fitness_level', 'goal', 'start_date', 'end_date', 'status', 'approved_at')
    list_filter = ('status', 'fitness_level', 'goal')
    search_fields = ('customer__email', 'customer__first_name')
    readonly_fields = ('created_at', 'updated_at', 'approved_at')


@admin.register(ProgramDay)
class ProgramDayAdmin(admin.ModelAdmin):
    list_display = ('program', 'day_number', 'date', 'day_type')
    list_filter = ('day_type',)


@admin.register(ProgramExercise)
class ProgramExerciseAdmin(admin.ModelAdmin):
    list_display = ('program_day', 'exercise', 'sets', 'reps', 'order')
    search_fields = ('exercise__name',)


@admin.register(DailyLog)
class DailyLogAdmin(admin.ModelAdmin):
    list_display = ('customer', 'date', 'is_closed', 'closed_at')
    list_filter = ('is_closed',)
    search_fields = ('customer__email',)


@admin.register(ExerciseLog)
class ExerciseLogAdmin(admin.ModelAdmin):
    list_display = ('daily_log', 'program_exercise', 'status')
    list_filter = ('status',)


@admin.register(Food)
class FoodAdmin(admin.ModelAdmin):
    list_display = ('name', 'category', 'source', 'calories_per_100g', 'nova_group', 'nutri_score', 'is_active')
    list_filter = ('category', 'source', 'nova_group', 'nutri_score', 'is_active')
    search_fields = ('name',)


@admin.register(MealSuggestion)
class MealSuggestionAdmin(admin.ModelAdmin):
    list_display = ('title', 'meal_block', 'calories_estimate', 'fitness_level_min', 'fitness_level_max', 'is_active')
    list_filter = ('meal_block', 'is_active')
    search_fields = ('title', 'description')
    filter_horizontal = ('foods',)


@admin.register(NutritionDailyLog)
class NutritionDailyLogAdmin(admin.ModelAdmin):
    list_display = ('customer', 'date', 'is_closed', 'closed_at')
    list_filter = ('is_closed',)
    search_fields = ('customer__email',)


@admin.register(MealEntry)
class MealEntryAdmin(admin.ModelAdmin):
    list_display = ('daily_log', 'meal_block', 'suggestion', 'status')
    list_filter = ('meal_block', 'status')


@admin.register(WaterGlassLog)
class WaterGlassLogAdmin(admin.ModelAdmin):
    list_display = ('daily_log', 'created_at')
    list_filter = ('created_at',)
    search_fields = ('daily_log__customer__email',)


from core_app.models.store import StoreItem, RedemptionRequest


@admin.register(StoreItem)
class StoreItemAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_credits', 'item_type', 'is_active')
    list_filter = ('item_type', 'is_active')
    search_fields = ('name', 'description')


@admin.register(RedemptionRequest)
class RedemptionRequestAdmin(admin.ModelAdmin):
    list_display = ('customer', 'item', 'credits_spent', 'status', 'created_at')
    list_filter = ('status',)
    raw_id_fields = ('customer', 'item', 'resolved_by')


from core_app.models.credit_package import CreditPackage
from core_app.models.credit_purchase import CreditPurchase


@admin.register(CreditPackage)
class CreditPackageAdmin(admin.ModelAdmin):
    list_display = ('name', 'credits', 'price_cop', 'is_active')
    list_editable = ('is_active',)
    list_filter = ('is_active',)


@admin.register(CreditPurchase)
class CreditPurchaseAdmin(admin.ModelAdmin):
    list_display = ('reference', 'customer', 'credits', 'amount_cop', 'status', 'resolved_at')
    list_filter = ('status',)
    search_fields = ('reference', 'customer__email')
    readonly_fields = ('customer', 'credit_package', 'credits', 'amount_cop', 'reference', 'wompi_transaction_id', 'status', 'resolved_at')

    def has_add_permission(self, request):
        return False


from core_app.models.nutrition_product import NutritionProduct
from core_app.models.nutrition_upgrade import NutritionUpgrade


@admin.register(NutritionProduct)
class NutritionProductAdmin(admin.ModelAdmin):
    list_display = ('name', 'price_cop', 'is_active')
    list_editable = ('price_cop', 'is_active')


@admin.register(NutritionUpgrade)
class NutritionUpgradeAdmin(admin.ModelAdmin):
    list_display = ('reference', 'customer', 'amount_cop', 'status', 'resolved_at')
    list_filter = ('status',)
    search_fields = ('reference', 'customer__email')
    readonly_fields = ('customer', 'subscription', 'amount_cop', 'reference', 'wompi_transaction_id', 'status', 'resolved_at')

    def has_add_permission(self, request):
        return False
