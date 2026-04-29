"""Development-specific settings for core_project.

Imported automatically by ``settings.py`` when ``DJANGO_ENV != 'production'``.
"""

DEBUG = True

ALLOWED_HOSTS = ['localhost', '127.0.0.1', '*']

EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'

CORS_ALLOW_ALL_ORIGINS = True

RECAPTCHA_SITE_KEY = ''
RECAPTCHA_SECRET_KEY = ''

FRONTEND_BASE_URL = 'http://192.168.56.10:3000'
