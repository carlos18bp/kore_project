"""Production-specific settings for core_project.

Imported automatically by ``settings.py`` when ``DJANGO_ENV == 'production'``.
"""

import os

# ---------------------------------------------------------------------------
# DEBUG — hardcoded to False, never from environment
# ---------------------------------------------------------------------------
DEBUG = False

# ---------------------------------------------------------------------------
# Required settings — fail fast if missing
# ---------------------------------------------------------------------------
if not os.getenv('DJANGO_SECRET_KEY'):
    raise ValueError('DJANGO_SECRET_KEY is required in production')
if not os.getenv('DJANGO_ALLOWED_HOSTS'):
    raise ValueError('DJANGO_ALLOWED_HOSTS is required in production')

# ---------------------------------------------------------------------------
# Security hardening
# ---------------------------------------------------------------------------
SECURE_SSL_REDIRECT = True
SESSION_COOKIE_SECURE = True
CSRF_COOKIE_SECURE = True
SECURE_HSTS_SECONDS = 31_536_000  # 1 year
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True
SECURE_CONTENT_TYPE_NOSNIFF = True
SECURE_BROWSER_XSS_FILTER = True
X_FRAME_OPTIONS = 'DENY'

# ---------------------------------------------------------------------------
# Production email (SMTP — configured via env vars in base settings)
# ---------------------------------------------------------------------------
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

# ---------------------------------------------------------------------------
# Reverse proxy (Nginx terminates SSL, forwards HTTP to Gunicorn)
# ---------------------------------------------------------------------------
SECURE_PROXY_SSL_HEADER = ('HTTP_X_FORWARDED_PROTO', 'https')
