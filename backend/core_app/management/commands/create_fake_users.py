from django.core.management.base import BaseCommand

from core_app.models import User


class Command(BaseCommand):
    help = 'Create fake users (customers + optional admin)'

    def add_arguments(self, parser):
        parser.add_argument('--customers', type=int, default=10)
        parser.add_argument('--customer-password', type=str, default='customer123456')
        parser.add_argument('--admin-email', type=str, default='admin@kore.com')
        parser.add_argument('--admin-password', type=str, default='admin123456')
        parser.add_argument('--no-admin', action='store_true', default=False)

    def handle(self, *args, **options):
        customers = int(options['customers'])
        customer_password = options['customer_password']
        admin_email = options['admin_email']
        admin_password = options['admin_password']
        no_admin = bool(options['no_admin'])

        created_customers = 0
        created_admin = 0

        if not no_admin:
            admin_user, created = User.objects.get_or_create(
                email=admin_email,
                defaults={
                    'first_name': 'Admin',
                    'last_name': 'Kore',
                    'role': User.Role.ADMIN,
                    'is_staff': True,
                    'is_superuser': True,
                },
            )
            if created:
                admin_user.set_password(admin_password)
                admin_user.save(update_fields=['password'])
                created_admin = 1

        for i in range(1, customers + 1):
            email = f'customer{i}@kore.com'
            user, created = User.objects.get_or_create(
                email=email,
                defaults={
                    'first_name': f'Customer{i}',
                    'last_name': 'Kore',
                    'role': User.Role.CUSTOMER,
                },
            )
            if created:
                user.set_password(customer_password)
                user.save(update_fields=['password'])
                created_customers += 1

        total_users = User.objects.count()
        total_customers = User.objects.filter(role=User.Role.CUSTOMER).count()

        self.stdout.write(self.style.SUCCESS('Users:'))
        self.stdout.write(f'- admin_created: {created_admin}')
        self.stdout.write(f'- customers_created: {created_customers}')
        self.stdout.write(f'- total_users: {total_users}')
        self.stdout.write(f'- total_customers: {total_customers}')
