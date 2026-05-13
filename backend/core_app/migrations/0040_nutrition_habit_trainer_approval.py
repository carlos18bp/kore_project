from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0039_user_assigned_trainer'),
    ]

    operations = [
        migrations.AddField(
            model_name='nutritionhabit',
            name='trainer_notes',
            field=models.TextField(blank=True),
        ),
        migrations.AddField(
            model_name='nutritionhabit',
            name='trainer_approved_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
