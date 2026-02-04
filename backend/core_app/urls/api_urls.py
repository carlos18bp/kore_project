from django.urls import include, path
from rest_framework.routers import DefaultRouter

from core_app.views.analytics_views import AnalyticsEventViewSet
from core_app.views.availability_views import AvailabilitySlotViewSet
from core_app.views.booking_views import BookingViewSet
from core_app.views.content_views import FAQItemViewSet, SiteSettingsView
from core_app.views.notification_views import NotificationViewSet
from core_app.views.package_views import PackageViewSet
from core_app.views.payment_views import PaymentViewSet

router = DefaultRouter()
router.register('packages', PackageViewSet, basename='package')
router.register('availability-slots', AvailabilitySlotViewSet, basename='availability-slot')
router.register('bookings', BookingViewSet, basename='booking')
router.register('payments', PaymentViewSet, basename='payment')
router.register('notifications', NotificationViewSet, basename='notification')
router.register('faqs', FAQItemViewSet, basename='faq')
router.register('analytics-events', AnalyticsEventViewSet, basename='analytics-event')

urlpatterns = [
    path('', include(router.urls)),
    path('site-settings/', SiteSettingsView.as_view(), name='site-settings'),
]
