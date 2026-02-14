"""Celery application configuration for the KÓRE project.

Auto-discovers tasks from all installed Django apps.
"""

import os

from celery import Celery

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core_project.settings')

app = Celery('core_project')
app.config_from_object('django.conf:settings', namespace='CELERY')
app.autodiscover_tasks()
