from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.http import JsonResponse
from django.urls import include, path, re_path
from django.views.static import serve as static_serve

from core_project.views import serve_nextjs_page, serve_nextjs_rsc


def health_check(request):
    return JsonResponse({"status": "ok", "project": "kore_project"})

TEMPLATES_DIR = settings.BASE_DIR / 'templates'

urlpatterns = [
    # Health check
    path('api/health/', health_check, name='health-check'),
    # Django admin & API
    path('admin/', admin.site.urls),
    path('api/', include('core_app.urls.api_urls')),
    path('api/auth/', include('core_app.urls.auth_urls')),
    path('api/wompi/', include('core_app.urls.wompi_urls')),
    path('api/google-captcha/', include('core_app.urls.captcha_urls')),

    # Next.js static assets (JS/CSS chunks, images, icons, favicon)
    re_path(r'^_next/(?P<path>.*)$', static_serve, {'document_root': TEMPLATES_DIR / '_next'}),
    re_path(r'^images/(?P<path>.*)$', static_serve, {'document_root': TEMPLATES_DIR / 'images'}),
    re_path(r'^icons/(?P<path>.*)$', static_serve, {'document_root': TEMPLATES_DIR / 'icons'}),
    re_path(r'^favicon\.ico$', static_serve, {'document_root': str(TEMPLATES_DIR), 'path': 'favicon.ico'}),
    re_path(r'^apple-icon\.png$', static_serve, {'document_root': str(TEMPLATES_DIR), 'path': 'apple-icon.png'}),
    re_path(r'^sitemap\.xml$', static_serve, {'document_root': str(TEMPLATES_DIR), 'path': 'sitemap.xml'}),
    re_path(r'^robots\.txt$', static_serve, {'document_root': str(TEMPLATES_DIR), 'path': 'robots.txt'}),

    # Django static files (admin CSS/JS) — needed in production
    re_path(r'^static/(?P<path>.*)$', static_serve, {'document_root': settings.STATIC_ROOT}),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)

# Next.js RSC payload files (.txt) — must be before catch-all
urlpatterns += [
    re_path(r'^(?P<path>(?:.+/)?__next\..+\.txt)$', serve_nextjs_rsc, name='nextjs-rsc'),
]

# Next.js pages (catch-all must be last)
urlpatterns += [
    path('', serve_nextjs_page, name='home'),
    re_path(r'^(?!admin(?:/|$))(?!static/)(?!api/)(?P<page>.+?)/?$', serve_nextjs_page, name='nextjs-page'),
]

handler404 = 'core_project.views.custom_404'
