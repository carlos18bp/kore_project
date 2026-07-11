from django.db import migrations, models


def enable_workout_captures(apps, schema_editor):
    CreditSettings = apps.get_model('core_app', 'CreditSettings')
    CreditSettings.objects.update_or_create(pk=1, defaults={'require_workout_captures': True})


def noop_reverse(apps, schema_editor):
    pass


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0066_nutritionproduct_nutritionupgrade'),
    ]

    operations = [
        migrations.AlterField(
            model_name='creditsettings',
            name='require_workout_captures',
            field=models.BooleanField(default=True),
        ),
        migrations.RunPython(enable_workout_captures, noop_reverse),
    ]
