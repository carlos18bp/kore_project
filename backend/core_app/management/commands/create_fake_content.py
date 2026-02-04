from django.core.management.base import BaseCommand

from core_app.models import FAQItem, SiteSettings


class Command(BaseCommand):
    help = 'Create fake content (site settings + FAQs)'

    def handle(self, *args, **options):
        settings_obj = SiteSettings.load()
        updated = False

        if not settings_obj.company_name:
            settings_obj.company_name = 'KÓRE'
            updated = True
        if not settings_obj.email:
            settings_obj.email = 'hola@kore.com'
            updated = True
        if not settings_obj.whatsapp:
            settings_obj.whatsapp = '+57 300 000 0000'
            updated = True
        if not settings_obj.footer_text:
            settings_obj.footer_text = 'Reservas y pagos simplificados.'
            updated = True

        if updated:
            settings_obj.save()

        defaults = [
            ('¿Cómo reservo?', 'Selecciona un paquete, elige un horario disponible y confirma tu reserva.'),
            ('¿Necesito cuenta?', 'Sí. Para reservar necesitas iniciar sesión.'),
            ('¿Qué métodos de pago aceptan?', 'Pronto integraremos múltiples opciones de pago.'),
        ]

        created_faqs = 0
        for order, (q, a) in enumerate(defaults, start=1):
            _, created = FAQItem.objects.get_or_create(
                question=q,
                defaults={'answer': a, 'is_active': True, 'order': order},
            )
            if created:
                created_faqs += 1

        self.stdout.write(self.style.SUCCESS('Content:'))
        self.stdout.write(f'- settings_id: {SiteSettings.load().pk}')
        self.stdout.write(f'- faqs_created: {created_faqs}')
        self.stdout.write(f'- faqs_total: {FAQItem.objects.count()}')
