"""Django base settings for core_project.

Shared settings used by both development and production environments.
Environment-specific overrides are auto-imported at the end of this file
from ``settings_dev.py`` or ``settings_prod.py`` based on the
``DJANGO_ENV`` environment variable.

For more information on this file, see
https://docs.djangoproject.com/en/4.2/topics/settings/
"""

from datetime import timedelta
from pathlib import Path
from urllib.parse import urlparse

from decouple import Csv, config

# Build paths inside the project like this: BASE_DIR / 'subdir'.
BASE_DIR = Path(__file__).resolve().parent.parent

# ---------------------------------------------------------------------------
# Environment detection
# ---------------------------------------------------------------------------
DJANGO_ENV = config('DJANGO_ENV', default='development')
IS_PRODUCTION = DJANGO_ENV == 'production'

# ---------------------------------------------------------------------------
# Core Django settings
# ---------------------------------------------------------------------------
SECRET_KEY = config('DJANGO_SECRET_KEY', default='change-me-please-set-a-long-random-secret-key')
ALLOWED_HOSTS = config('DJANGO_ALLOWED_HOSTS', default='localhost,127.0.0.1', cast=Csv())


# Application definition

INSTALLED_APPS = [
    'django.contrib.admin',
    'django.contrib.auth',
    'django.contrib.contenttypes',
    'django.contrib.sessions',
    'django.contrib.messages',
    'django.contrib.staticfiles',

    'corsheaders',
    'rest_framework',
    'rest_framework_simplejwt.token_blacklist',
    'huey.contrib.djhuey',
    'dbbackup',

    'core_app.apps.CoreAppConfig',
]

MIDDLEWARE = [
    'django.middleware.security.SecurityMiddleware',
    'django.contrib.sessions.middleware.SessionMiddleware',
    'corsheaders.middleware.CorsMiddleware',
    'django.middleware.common.CommonMiddleware',
    'django.middleware.csrf.CsrfViewMiddleware',
    'django.contrib.auth.middleware.AuthenticationMiddleware',
    'django.contrib.messages.middleware.MessageMiddleware',
    'django.middleware.clickjacking.XFrameOptionsMiddleware',
]

ROOT_URLCONF = 'core_project.urls'

TEMPLATES_DIR = BASE_DIR / 'templates'

TEMPLATES = [
    {
        'BACKEND': 'django.template.backends.django.DjangoTemplates',
        'DIRS': [TEMPLATES_DIR, BASE_DIR / 'core_app' / 'templates'],
        'APP_DIRS': True,
        'OPTIONS': {
            'context_processors': [
                'django.template.context_processors.debug',
                'django.template.context_processors.request',
                'django.contrib.auth.context_processors.auth',
                'django.contrib.messages.context_processors.messages',
            ],
        },
    },
]

WSGI_APPLICATION = 'core_project.wsgi.application'


AUTH_USER_MODEL = 'core_app.User'


# Database
# https://docs.djangoproject.com/en/4.2/ref/settings/#databases
# Production uses MySQL via env vars; development defaults to SQLite.

_DB_ENGINE = config('DB_ENGINE', default='django.db.backends.sqlite3')

if _DB_ENGINE == 'django.db.backends.sqlite3':
    DATABASES = {
        'default': {
            'ENGINE': _DB_ENGINE,
            'NAME': BASE_DIR / config('DB_NAME', default='db.sqlite3'),
        }
    }
else:
    DATABASES = {
        'default': {
            'ENGINE': _DB_ENGINE,
            'NAME': config('DB_NAME', default='core_project'),
            'USER': config('DB_USER', default=''),
            'PASSWORD': config('DB_PASSWORD', default=''),
            'HOST': config('DB_HOST', default='localhost'),
            'PORT': config('DB_PORT', default='3306'),
        }
    }


# Password validation
# https://docs.djangoproject.com/en/4.2/ref/settings/#auth-password-validators

AUTH_PASSWORD_VALIDATORS = [
    {
        'NAME': 'django.contrib.auth.password_validation.UserAttributeSimilarityValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.MinimumLengthValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.CommonPasswordValidator',
    },
    {
        'NAME': 'django.contrib.auth.password_validation.NumericPasswordValidator',
    },
]


# Internationalization
# https://docs.djangoproject.com/en/4.2/topics/i18n/

LANGUAGE_CODE = 'en-us'

TIME_ZONE = 'UTC'

USE_I18N = True

USE_TZ = True


# Static files (CSS, JavaScript, Images)
# https://docs.djangoproject.com/en/4.2/howto/static-files/

STATIC_URL = '/static/'
STATIC_ROOT = BASE_DIR / 'staticfiles'

MEDIA_URL = '/media/'
MEDIA_ROOT = BASE_DIR / 'media'


STORAGES = {
    'default': {
        'BACKEND': 'django.core.files.storage.FileSystemStorage',
    },
    'staticfiles': {
        'BACKEND': 'django.contrib.staticfiles.storage.StaticFilesStorage',
    },
}


CORS_ALLOWED_ORIGINS = config('CORS_ALLOWED_ORIGINS', default='http://localhost:3000,http://localhost:3001', cast=Csv())
CSRF_TRUSTED_ORIGINS = config('CSRF_TRUSTED_ORIGINS', default='', cast=Csv())


REST_FRAMEWORK = {
    'DEFAULT_AUTHENTICATION_CLASSES': (
        'rest_framework_simplejwt.authentication.JWTAuthentication',
    ),
    'DEFAULT_PERMISSION_CLASSES': (
        'rest_framework.permissions.IsAuthenticated',
    ),
    'DEFAULT_PAGINATION_CLASS': 'rest_framework.pagination.PageNumberPagination',
    'PAGE_SIZE': 10,
}


SIMPLE_JWT = {
    'ACCESS_TOKEN_LIFETIME': timedelta(days=config('JWT_ACCESS_TOKEN_LIFETIME_DAYS', default=1, cast=int)),
    'REFRESH_TOKEN_LIFETIME': timedelta(days=config('JWT_REFRESH_TOKEN_LIFETIME_DAYS', default=7, cast=int)),
    'ROTATE_REFRESH_TOKENS': False,
    'BLACKLIST_AFTER_ROTATION': True,
}

# Default primary key field type
# https://docs.djangoproject.com/en/4.2/ref/settings/#default-auto-field

DEFAULT_AUTO_FIELD = 'django.db.models.BigAutoField'


# Email configuration (Gmail SMTP)
EMAIL_BACKEND = 'django.core.mail.backends.smtp.EmailBackend'
EMAIL_HOST = 'smtp.gmail.com'
EMAIL_PORT = 587
EMAIL_USE_TLS = True
EMAIL_HOST_USER = config('EMAIL_HOST_USER', default='')
EMAIL_HOST_PASSWORD = config('EMAIL_HOST_PASSWORD', default='')
DEFAULT_FROM_EMAIL = config('DEFAULT_FROM_EMAIL', default='KÓRE <noreply@korehealths.com>')


# Wompi payment gateway configuration
WOMPI_ENVIRONMENT = config('WOMPI_ENVIRONMENT', default='test')
WOMPI_PUBLIC_KEY = config('WOMPI_PUBLIC_KEY', default='')
WOMPI_PRIVATE_KEY = config('WOMPI_PRIVATE_KEY', default='')
WOMPI_INTEGRITY_KEY = config('WOMPI_INTEGRITY_KEY', default='')
WOMPI_EVENTS_KEY = config('WOMPI_EVENTS_KEY', default='')


def _resolve_wompi_base_url(environment: str) -> str:
    """Resolve the Wompi API base URL from the configured environment name.

    Accepts common sandbox aliases used in local/dev setups while preserving
    production behavior for any non-sandbox value.

    Args:
        environment: Wompi environment string from settings/env.

    Returns:
        str: Wompi API base URL.
    """
    normalized = str(environment or '').strip().lower()
    sandbox_aliases = {'test', 'sandbox', 'uat'}
    if normalized in sandbox_aliases:
        return 'https://sandbox.wompi.co/v1'
    return 'https://production.wompi.co/v1'


WOMPI_API_BASE_URL = _resolve_wompi_base_url(WOMPI_ENVIRONMENT)


def _huey_connection_from_url(redis_url: str) -> dict:
    """Parse Redis connection details from a URL string."""
    parsed = urlparse(redis_url)
    if not parsed.scheme or not parsed.hostname:
        return {}
    db_path = parsed.path.lstrip('/')
    connection = {
        'host': parsed.hostname,
        'port': parsed.port or 6379,
        'db': int(db_path) if db_path else 0,
    }
    if parsed.password:
        connection['password'] = parsed.password
    if parsed.scheme == 'rediss':
        connection['ssl'] = True
    return connection


# Huey configuration
_HUEY_REDIS_URL = config('HUEY_REDIS_URL', default='redis://localhost:6379/0')
HUEY = {
    'huey_class': 'huey.RedisHuey',
    'name': 'core_project',
    'connection': _huey_connection_from_url(_HUEY_REDIS_URL),
    'results': True,
    'store_none': False,
    'immediate': config('HUEY_IMMEDIATE', default=False, cast=bool),
    'utc': True,
}


# Google reCAPTCHA configuration
RECAPTCHA_SITE_KEY = config('RECAPTCHA_SITE_KEY', default='')
RECAPTCHA_SECRET_KEY = config('RECAPTCHA_SECRET_KEY', default='')


# ---------------------------------------------------------------------------
# Backups (django-dbbackup)
# ---------------------------------------------------------------------------
DBBACKUP_STORAGE = 'django.core.files.storage.FileSystemStorage'
DBBACKUP_STORAGE_OPTIONS = {
    'location': config('BACKUP_STORAGE_PATH', default='/var/backups/kore_project'),
}
DBBACKUP_FILENAME_TEMPLATE = '{datetime}.sql'
DBBACKUP_MEDIA_FILENAME_TEMPLATE = '{datetime}.tar'
DBBACKUP_COMPRESS = True
DBBACKUP_CLEANUP_KEEP = 5
DBBACKUP_CLEANUP_KEEP_MEDIA = 5


# ---------------------------------------------------------------------------
# Silk profiling (conditional — enabled via ENABLE_SILK env var)
# ---------------------------------------------------------------------------
ENABLE_SILK = config('ENABLE_SILK', default=False, cast=bool)

if ENABLE_SILK:
    INSTALLED_APPS += ['silk']  # noqa: F405 — INSTALLED_APPS defined above
    MIDDLEWARE.insert(0, 'silk.middleware.SilkyMiddleware')

    SILKY_PYTHON_PROFILER = False
    SILKY_PYTHON_PROFILER_BINARY = False
    SILKY_META = False
    SILKY_ANALYZE_QUERIES = True

    SILKY_AUTHENTICATION = True
    SILKY_AUTHORISATION = True

    def silk_permissions(user):
        return user.is_staff

    SILKY_PERMISSIONS = silk_permissions

    SILKY_MAX_RECORDED_REQUESTS = 10_000
    SILKY_MAX_RECORDED_REQUESTS_CHECK_PERCENT = 10

    SILKY_IGNORE_PATHS = [
        '/admin/',
        '/static/',
        '/media/',
        '/silk/',
    ]

    SILKY_MAX_REQUEST_BODY_SIZE = 0
    SILKY_MAX_RESPONSE_BODY_SIZE = 0

    SLOW_QUERY_THRESHOLD_MS = 500
    N_PLUS_ONE_THRESHOLD = 10


# ---------------------------------------------------------------------------
# Logging
# ---------------------------------------------------------------------------
LOG_LEVEL = config('DJANGO_LOG_LEVEL', default='INFO')

LOGGING = {
    'version': 1,
    'disable_existing_loggers': False,
    'formatters': {
        'verbose': {
            'format': '{levelname} {asctime} {module} {message}',
            'style': '{',
        },
    },
    'handlers': {
        'console': {
            'class': 'logging.StreamHandler',
            'formatter': 'verbose',
        },
        'backup_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'backups.log',
            'formatter': 'verbose',
        },
        'silk_monitor_file': {
            'level': 'INFO',
            'class': 'logging.FileHandler',
            'filename': BASE_DIR / 'logs' / 'silk-monitor.log',
            'formatter': 'verbose',
        },
    },
    'loggers': {
        'django': {
            'handlers': ['console'],
            'level': LOG_LEVEL,
        },
        'backups': {
            'handlers': ['backup_file', 'console'],
            'level': 'INFO',
        },
        'silk_monitor': {
            'handlers': ['silk_monitor_file', 'console'],
            'level': 'INFO',
        },
    },
}


# ---------------------------------------------------------------------------
# Environment-specific settings (auto-imported)
# ---------------------------------------------------------------------------
if IS_PRODUCTION:
    from .settings_prod import *  # noqa: F401, F403
else:
    from .settings_dev import *  # noqa: F401, F403
