from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core_app.views.analytics_views import AnalyticsEventViewSet
from core_app.views.availability_views import AvailabilitySlotViewSet
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
from core_app.views.trainer_client_views import (
    TrainerClientDetailView,
    TrainerClientListView,
    TrainerClientSessionsView,
    TrainerDashboardStatsView,
)
from core_app.views.trainer_profile_views import TrainerProfileViewSet

router = DefaultRouter()
router.register('packages', PackageViewSet, basename='package')
router.register('trainers', TrainerProfileViewSet, basename='trainer')
router.register('subscriptions', SubscriptionViewSet, basename='subscription')
router.register('availability-slots', AvailabilitySlotViewSet, basename='availability-slot')
router.register('bookings', BookingViewSet, basename='booking')
router.register('payments', PaymentViewSet, basename='payment')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('faq-categories', FAQCategoryViewSet, basename='faq-category')
router.register('faqs', FAQItemViewSet, basename='faq')
router.register('contact-messages', ContactMessageViewSet, basename='contact-message')
router.register('analytics-events', AnalyticsEventViewSet, basename='analytics-event')

urlpatterns = [
    path('', include(router.urls)),
    path('site-settings/', SiteSettingsView.as_view(), name='site-settings'),
    path('terms-acceptance/status/', TermsAcceptanceStatusView.as_view(), name='terms-acceptance-status'),
    path('terms-acceptance/accept/', TermsAcceptanceCreateView.as_view(), name='terms-acceptance-accept'),
    path('trainer/my-clients/', TrainerClientListView.as_view(), name='trainer-client-list'),
    path('trainer/my-clients/<int:customer_id>/', TrainerClientDetailView.as_view(), name='trainer-client-detail'),
    path('trainer/my-clients/<int:customer_id>/sessions/', TrainerClientSessionsView.as_view(), name='trainer-client-sessions'),
    path('trainer/dashboard-stats/', TrainerDashboardStatsView.as_view(), name='trainer-dashboard-stats'),
    path('trainer/my-clients/<int:customer_id>/anthropometry/', TrainerAnthropometryListCreateView.as_view(), name='trainer-anthropometry-list-create'),
    path('trainer/my-clients/<int:customer_id>/anthropometry/<int:eval_id>/', TrainerAnthropometryDetailView.as_view(), name='trainer-anthropometry-detail'),
    path('my-anthropometry/', ClientAnthropometryListView.as_view(), name='client-anthropometry-list'),
    path('my-anthropometry/<int:eval_id>/', ClientAnthropometryDetailView.as_view(), name='client-anthropometry-detail'),
    path('trainer/my-clients/<int:customer_id>/posturometry/', TrainerPosturometryListCreateView.as_view(), name='trainer-posturometry-list-create'),
    path('trainer/my-clients/<int:customer_id>/posturometry/<int:eval_id>/', TrainerPosturometryDetailView.as_view(), name='trainer-posturometry-detail'),
    path('my-posturometry/', ClientPosturometryListView.as_view(), name='client-posturometry-list'),
    path('my-posturometry/<int:eval_id>/', ClientPosturometryDetailView.as_view(), name='client-posturometry-detail'),
]
