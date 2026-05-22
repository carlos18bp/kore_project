from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core_app.views.analytics_views import AnalyticsEventViewSet
from core_app.views.availability_views import AvailabilityView
from core_app.views.booking_views import BookingViewSet
from core_app.views.content_views import (
    ContactMessageViewSet,
    FAQCategoryViewSet,
    FAQItemViewSet,
    SiteSettingsView,
)
from core_app.views.notification_views import NotificationViewSet
from core_app.views.package_views import PackageViewSet
from core_app.views.payment_views import PaymentViewSet
from core_app.views.subscription_views import SubscriptionViewSet
from core_app.views.admin_user_views import AdminUserViewSet
from core_app.views.duo_invite_views import accept_invite, pending_invitation
from core_app.views.terms_views import TermsAcceptanceCreateView, TermsAcceptanceStatusView
from core_app.views.anthropometry_views import (
    ClientAnthropometryDetailView,
    ClientAnthropometryListView,
    TrainerAnthropometryDetailView,
    TrainerAnthropometryListCreateView,
)
from core_app.views.posturometry_views import (
    ClientPosturometryDetailView,
    ClientPosturometryListView,
    TrainerPosturometryDetailView,
    TrainerPosturometryListCreateView,
)
from core_app.views.physical_evaluation_views import (
    ClientPhysicalEvalDetailView,
    ClientPhysicalEvalListView,
    TrainerPhysicalEvalDetailView,
    TrainerPhysicalEvalListCreateView,
)
from core_app.views.pending_assessments_view import PendingAssessmentsView
from core_app.views.nutrition_views import (
    ClientNutritionDetailView,
    ClientNutritionListCreateView,
    TrainerNutritionDetailView,
    TrainerNutritionListView,
)
from core_app.views.parq_views import (
    ClientParqDetailView,
    ClientParqListCreateView,
    TrainerParqDetailView,
    TrainerParqListView,
)
from core_app.views.exercise_views import ExerciseListView
from core_app.views.monthly_program_views import (
    ApproveProgramView,
    CustomerProgramListView,
    DeleteProgramView,
    EditProgramExerciseView,
    GenerateProgramView,
    MyProgramView,
    ProgramDetailView,
    TodayProgramView,
    UpdateExerciseLogView,
    UpdateProgramNoteView,
    UpdateProgramWeekNoteView,
)
from core_app.views.trainer_client_views import (
    TrainerClientDetailView,
    TrainerAgendaView,
    TrainerClientFitnessLevelView,
    TrainerClientListView,
    TrainerClientSessionsView,
    TrainerDashboardStatsView,
)
from core_app.views.trainer_intelligence_views import (
    TrainerRiskDashboardView,
    TrainerClientKPIView,
    TrainerComparativeMetricsView,
    TrainerAlertCenterView,
    TrainerAlertResolveView,
    TrainerMessagesView,
    TrainerMessageDetailView,
    TrainerClientResumenView,
    TrainerClientAlertsView,
    TrainerProgramPauseView,
    TrainerProgramResumeView,
    TrainerClientDailyLogsView,
    TrainerClientNutritionLogsView,
    TrainerClientSessionsFullView,
    TrainerMessagesForCustomerView,
    TrainerMessageDismissView,
)
from core_app.views.trainer_profile_views import TrainerProfileViewSet
from core_app.views.nutrition_daily_views import (
    TodayNutritionView,
    UpdateMealEntryView,
    MealEntryPhotoView,
    NutritionHistoryView,
    WaterGlassLogCreateView,
)
from core_app.views.progress_views import WeeklySummaryView, ProjectionView, MonthlySummaryView
from core_app.views.trainer_assignment_views import TrainerAssignmentSummaryView
from core_app.views.nutrition_plan_views import (
    ApproveNutritionPlanView,
    CustomerNutritionPlanHistoryView,
    CustomerNutritionPlanListView,
    CustomerNutritionPlanWeekView,
    DeleteNutritionPlanView,
    EditPlanMealView,
    GenerateNutritionPlanView,
    MealSuggestionCatalogView,
    NutritionPlanDetailView,
    UpdateNutritionPlanNoteView,
)
from core_app.views.nutrition_week_note_views import (
    CustomerNutritionWeekNoteListView,
    UpdateNutritionWeekNoteView,
)

router = DefaultRouter()
router.register('packages', PackageViewSet, basename='package')
router.register('trainers', TrainerProfileViewSet, basename='trainer')
router.register('subscriptions', SubscriptionViewSet, basename='subscription')
router.register('bookings', BookingViewSet, basename='booking')
router.register('payments', PaymentViewSet, basename='payment')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('faq-categories', FAQCategoryViewSet, basename='faq-category')
router.register('faqs', FAQItemViewSet, basename='faq')
router.register('contact-messages', ContactMessageViewSet, basename='contact-message')
router.register('analytics-events', AnalyticsEventViewSet, basename='analytics-event')
router.register('admin/users', AdminUserViewSet, basename='admin-user')

urlpatterns = [
    path('subscriptions/accept-invite/', accept_invite, name='subscription-accept-invite'),
    path('subscriptions/pending-invitation/', pending_invitation, name='subscription-pending-invitation'),
    path('', include(router.urls)),
    path('availability/', AvailabilityView.as_view(), name='availability'),
    path('site-settings/', SiteSettingsView.as_view(), name='site-settings'),
    path('terms-acceptance/status/', TermsAcceptanceStatusView.as_view(), name='terms-acceptance-status'),
    path('terms-acceptance/accept/', TermsAcceptanceCreateView.as_view(), name='terms-acceptance-accept'),
    path('trainer/my-clients/', TrainerClientListView.as_view(), name='trainer-client-list'),
    path('trainer/my-clients/<int:customer_id>/', TrainerClientDetailView.as_view(), name='trainer-client-detail'),
    path('trainer/my-clients/<int:customer_id>/sessions/', TrainerClientSessionsView.as_view(), name='trainer-client-sessions'),
    path('trainer/my-clients/<int:customer_id>/fitness-level/', TrainerClientFitnessLevelView.as_view(), name='trainer-client-fitness-level'),
    path('trainer/dashboard-stats/', TrainerDashboardStatsView.as_view(), name='trainer-dashboard-stats'),
    path('trainer/agenda/', TrainerAgendaView.as_view(), name='trainer-agenda'),
    path('trainer/my-clients/<int:customer_id>/anthropometry/', TrainerAnthropometryListCreateView.as_view(), name='trainer-anthropometry-list-create'),
    path('trainer/my-clients/<int:customer_id>/anthropometry/<int:eval_id>/', TrainerAnthropometryDetailView.as_view(), name='trainer-anthropometry-detail'),
    path('my-anthropometry/', ClientAnthropometryListView.as_view(), name='client-anthropometry-list'),
    path('my-anthropometry/<int:eval_id>/', ClientAnthropometryDetailView.as_view(), name='client-anthropometry-detail'),
    path('trainer/my-clients/<int:customer_id>/posturometry/', TrainerPosturometryListCreateView.as_view(), name='trainer-posturometry-list-create'),
    path('trainer/my-clients/<int:customer_id>/posturometry/<int:eval_id>/', TrainerPosturometryDetailView.as_view(), name='trainer-posturometry-detail'),
    path('my-posturometry/', ClientPosturometryListView.as_view(), name='client-posturometry-list'),
    path('my-posturometry/<int:eval_id>/', ClientPosturometryDetailView.as_view(), name='client-posturometry-detail'),
    path('trainer/my-clients/<int:customer_id>/physical-evaluation/', TrainerPhysicalEvalListCreateView.as_view(), name='trainer-physical-eval-list-create'),
    path('trainer/my-clients/<int:customer_id>/physical-evaluation/<int:eval_id>/', TrainerPhysicalEvalDetailView.as_view(), name='trainer-physical-eval-detail'),
    path('my-physical-evaluation/', ClientPhysicalEvalListView.as_view(), name='client-physical-eval-list'),
    path('my-physical-evaluation/<int:eval_id>/', ClientPhysicalEvalDetailView.as_view(), name='client-physical-eval-detail'),
    path('my-pending-assessments/', PendingAssessmentsView.as_view(), name='client-pending-assessments'),
    path('my-nutrition/', ClientNutritionListCreateView.as_view(), name='client-nutrition-list-create'),
    path('my-nutrition/<int:eval_id>/', ClientNutritionDetailView.as_view(), name='client-nutrition-detail'),
    path('trainer/my-clients/<int:customer_id>/nutrition/', TrainerNutritionListView.as_view(), name='trainer-nutrition-list'),
    path('trainer/my-clients/<int:customer_id>/nutrition/<int:eval_id>/', TrainerNutritionDetailView.as_view(), name='trainer-nutrition-detail'),
    path('my-parq/', ClientParqListCreateView.as_view(), name='client-parq-list-create'),
    path('my-parq/<int:eval_id>/', ClientParqDetailView.as_view(), name='client-parq-detail'),
    path('trainer/my-clients/<int:customer_id>/parq/', TrainerParqListView.as_view(), name='trainer-parq-list'),
    path('trainer/my-clients/<int:customer_id>/parq/<int:eval_id>/', TrainerParqDetailView.as_view(), name='trainer-parq-detail'),
    path('exercises/', ExerciseListView.as_view(), name='exercise-list'),
    path('monthly-programs/customer/<int:customer_id>/', CustomerProgramListView.as_view(), name='customer-program-list'),
    path('monthly-programs/generate/', GenerateProgramView.as_view(), name='monthly-program-generate'),
    path('monthly-programs/<int:program_id>/', ProgramDetailView.as_view(), name='monthly-program-detail'),
    path('monthly-programs/<int:program_id>/approve/', ApproveProgramView.as_view(), name='monthly-program-approve'),
    path('monthly-programs/<int:program_id>/note/', UpdateProgramNoteView.as_view(), name='monthly-program-note'),
    path('monthly-programs/<int:program_id>/week-notes/<int:week_number>/', UpdateProgramWeekNoteView.as_view(), name='monthly-program-week-note'),
    path('monthly-programs/<int:program_id>/delete/', DeleteProgramView.as_view(), name='monthly-program-delete'),
    path('monthly-programs/<int:program_id>/days/<int:day_id>/exercises/<int:ex_id>/', EditProgramExerciseView.as_view(), name='monthly-program-edit-exercise'),
    path('my-program/', MyProgramView.as_view(), name='my-program'),
    path('my-program/today/', TodayProgramView.as_view(), name='my-program-today'),
    path('my-program/logs/<int:log_id>/exercises/<int:ex_log_id>/', UpdateExerciseLogView.as_view(), name='my-program-update-exercise-log'),
    path('my-program/weekly-summary/', WeeklySummaryView.as_view(), name='my-program-weekly-summary'),
    path('my-program/projection/', ProjectionView.as_view(), name='my-program-projection'),
    path('my-program/monthly-summary/', MonthlySummaryView.as_view(), name='my-program-monthly-summary'),
    # Trainer Intelligence Center
    path('trainer/risk-dashboard/', TrainerRiskDashboardView.as_view(), name='trainer-risk-dashboard'),
    path('trainer/comparative-metrics/', TrainerComparativeMetricsView.as_view(), name='trainer-comparative-metrics'),
    path('trainer/alerts/', TrainerAlertCenterView.as_view(), name='trainer-alerts'),
    path('trainer/alerts/<int:risk_score_id>/resolve/', TrainerAlertResolveView.as_view(), name='trainer-alert-resolve'),
    path('trainer/messages/', TrainerMessagesView.as_view(), name='trainer-messages'),
    path('trainer/messages/<int:message_id>/', TrainerMessageDetailView.as_view(), name='trainer-message-detail'),
    path('trainer/my-clients/<int:customer_id>/kpi/', TrainerClientKPIView.as_view(), name='trainer-client-kpi'),
    path('trainer/my-clients/<int:customer_id>/resumen/', TrainerClientResumenView.as_view(), name='trainer-client-resumen'),
    path('trainer/my-clients/<int:customer_id>/alerts/', TrainerClientAlertsView.as_view(), name='trainer-client-alerts'),
    path('trainer/my-clients/<int:customer_id>/daily-logs/', TrainerClientDailyLogsView.as_view(), name='trainer-client-daily-logs'),
    path('trainer/my-clients/<int:customer_id>/nutrition-logs/', TrainerClientNutritionLogsView.as_view(), name='trainer-client-nutrition-logs'),
    path('trainer/my-clients/<int:customer_id>/sessions-full/', TrainerClientSessionsFullView.as_view(), name='trainer-client-sessions-full'),
    path('trainer/my-clients/<int:customer_id>/program/<int:program_id>/pause/', TrainerProgramPauseView.as_view(), name='trainer-program-pause'),
    path('trainer/my-clients/<int:customer_id>/program/<int:program_id>/resume/', TrainerProgramResumeView.as_view(), name='trainer-program-resume'),
    path('my-trainer-messages/', TrainerMessagesForCustomerView.as_view(), name='my-trainer-messages'),
    path('my-trainer-messages/<int:message_id>/dismiss/', TrainerMessageDismissView.as_view(), name='my-trainer-messages-dismiss'),
    # Nutrition daily
    path('my-nutrition-daily/today/', TodayNutritionView.as_view(), name='my-nutrition-daily-today'),
    path('my-nutrition-daily/<int:log_id>/meals/<int:meal_id>/', UpdateMealEntryView.as_view(), name='my-nutrition-daily-update-meal'),
    path('my-nutrition-daily/<int:log_id>/meals/<int:meal_id>/photo/', MealEntryPhotoView.as_view(), name='my-nutrition-daily-meal-photo'),
    path('my-nutrition-daily/<int:log_id>/water-glasses/', WaterGlassLogCreateView.as_view(), name='my-nutrition-daily-water-glass-create'),
    path('my-nutrition-daily/history/', NutritionHistoryView.as_view(), name='my-nutrition-daily-history'),
    path('admin/trainers/assignment-summary/', TrainerAssignmentSummaryView.as_view(), name='admin-trainer-assignment-summary'),
    # Nutrition plans (trainer-curated weekly plans)
    path('nutrition-plans/customer/<int:customer_id>/', CustomerNutritionPlanListView.as_view(), name='nutrition-plan-list'),
    path('nutrition-plans/generate/', GenerateNutritionPlanView.as_view(), name='nutrition-plan-generate'),
    path('nutrition-plans/<int:plan_id>/', NutritionPlanDetailView.as_view(), name='nutrition-plan-detail'),
    path('nutrition-plans/<int:plan_id>/approve/', ApproveNutritionPlanView.as_view(), name='nutrition-plan-approve'),
    path('nutrition-plans/<int:plan_id>/note/', UpdateNutritionPlanNoteView.as_view(), name='nutrition-plan-note'),
    path('nutrition-plans/<int:plan_id>/delete/', DeleteNutritionPlanView.as_view(), name='nutrition-plan-delete'),
    path('nutrition-plans/<int:plan_id>/days/<int:day_id>/meals/<int:meal_id>/', EditPlanMealView.as_view(), name='nutrition-plan-edit-meal'),
    path('nutrition-week-notes/customer/<int:customer_id>/', CustomerNutritionWeekNoteListView.as_view(), name='nutrition-week-note-list'),
    path('nutrition-week-notes/customer/<int:customer_id>/<int:cycle_number>/<int:week_number>/', UpdateNutritionWeekNoteView.as_view(), name='nutrition-week-note-update'),
    path('meal-suggestions/', MealSuggestionCatalogView.as_view(), name='meal-suggestions'),
    path('my-nutrition-plan/', CustomerNutritionPlanWeekView.as_view(), name='my-nutrition-plan'),
    path('my-nutrition-plans/', CustomerNutritionPlanHistoryView.as_view(), name='my-nutrition-plans'),
]
