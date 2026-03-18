from django.apps import AppConfig


class CoreAppConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'core_app'

    def ready(self):
        import core_app.signals  # noqa: F401
        import core_project.tasks  # noqa: F401 — Huey periodic task discovery
