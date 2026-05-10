from django.db import migrations, models
import django.db.models.deletion


def backfill_assigned_trainer(apps, schema_editor):
    User = apps.get_model('core_app', 'User')
    Booking = apps.get_model('core_app', 'Booking')
    for user in User.objects.filter(role='customer', assigned_trainer__isnull=True):
        last_booking = (
            Booking.objects.filter(customer=user, trainer__isnull=False)
            .order_by('-created_at')
            .first()
        )
        if last_booking is not None:
            user.assigned_trainer_id = last_booking.trainer_id
            user.save(update_fields=['assigned_trainer'])


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0038_add_transfer_payment_provider'),
    ]

    operations = [
        migrations.AddField(
            model_name='user',
            name='assigned_trainer',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='assigned_clients',
                to='core_app.trainerprofile',
                help_text='Trainer who owns this customer. Only meaningful for role=customer.',
            ),
        ),
        migrations.RunPython(backfill_assigned_trainer, noop_reverse),
    ]
