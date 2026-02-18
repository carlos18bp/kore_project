from django.core.management.base import BaseCommand

from core_app.models import FAQCategory, FAQItem, SiteSettings


FAQ_CATEGORIES = [
    {'name': 'General', 'slug': 'general', 'order': 1},
    {'name': 'Reservas', 'slug': 'reservas', 'order': 2},
    {'name': 'Pagos', 'slug': 'pagos', 'order': 3},
    {'name': 'Programas', 'slug': 'programas', 'order': 4},
]

FAQ_ITEMS_BY_CATEGORY = {
    'general': [
        ('¿Qué es KÓRE?', 'KÓRE es una plataforma de bienestar y entrenamiento personalizado que conecta a personas con programas de movimiento consciente.'),
        ('¿Dónde están ubicados?', 'Estamos ubicados en Medellín, Colombia. También ofrecemos sesiones virtuales.'),
    ],
    'reservas': [
        ('¿Cómo reservo una sesión?', 'Selecciona un paquete, elige un horario disponible y confirma tu reserva desde tu dashboard.'),
        ('¿Necesito crear una cuenta?', 'Sí. Para reservar necesitas registrarte e iniciar sesión.'),
        ('¿Puedo cancelar o reprogramar?', 'Sí. Puedes cancelar o reprogramar desde la sección "Mis Sesiones" con al menos 24 horas de anticipación.'),
    ],
    'pagos': [
        ('¿Qué métodos de pago aceptan?', 'Aceptamos pagos con tarjeta de crédito y débito a través de Wompi.'),
        ('¿Puedo pagar en efectivo?', 'Por el momento solo aceptamos pagos en línea para garantizar tu reserva.'),
        ('¿Recibiré un comprobante de pago?', 'Sí. Recibirás un comprobante por email después de cada pago confirmado.'),
    ],
    'programas': [
        ('¿Cuáles son los tipos de programas?', 'Ofrecemos programas Personalizado, Semi-personalizado y Terapéutico, cada uno adaptado a diferentes necesidades.'),
        ('¿Qué incluye cada paquete?', 'Cada paquete incluye un número determinado de sesiones, con duración y vigencia específicas según el programa.'),
    ],
}


class Command(BaseCommand):
    help = 'Create fake content (site settings + FAQ categories + FAQs)'

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
        if not settings_obj.city:
            settings_obj.city = 'Medellín'
            updated = True
        if not settings_obj.business_hours:
            settings_obj.business_hours = 'Lunes a Viernes: 6:00 AM - 8:00 PM | Sábados: 7:00 AM - 2:00 PM'
            updated = True

        if updated:
            settings_obj.save()

        created_categories = 0
        category_map = {}
        for cat_data in FAQ_CATEGORIES:
            cat, created = FAQCategory.objects.get_or_create(
                slug=cat_data['slug'],
                defaults={'name': cat_data['name'], 'order': cat_data['order'], 'is_active': True},
            )
            category_map[cat_data['slug']] = cat
            if created:
                created_categories += 1

        created_faqs = 0
        global_order = 1
        for cat_slug, items in FAQ_ITEMS_BY_CATEGORY.items():
            category = category_map.get(cat_slug)
            for q, a in items:
                _, created = FAQItem.objects.get_or_create(
                    question=q,
                    defaults={'answer': a, 'category': category, 'is_active': True, 'order': global_order},
                )
                if created:
                    created_faqs += 1
                global_order += 1

        self.stdout.write(self.style.SUCCESS('Content:'))
        self.stdout.write(f'- settings_id: {SiteSettings.load().pk}')
        self.stdout.write(f'- faq_categories_created: {created_categories}')
        self.stdout.write(f'- faq_categories_total: {FAQCategory.objects.count()}')
        self.stdout.write(f'- faqs_created: {created_faqs}')
        self.stdout.write(f'- faqs_total: {FAQItem.objects.count()}')
