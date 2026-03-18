"""Migrate MoodEntry from text choices (motivated/neutral/tired) to 1-10 scale.

Steps:
1. Add score (nullable) and notes columns.
2. Convert existing mood text → score (tired=3, neutral=6, motivated=9).
3. Make score non-nullable.
4. Remove the old mood column.
"""

from django.db import migrations, models


def convert_mood_to_score(apps, schema_editor):
    MoodEntry = apps.get_model('core_app', 'MoodEntry')
    mapping = {'tired': 3, 'neutral': 6, 'motivated': 9}
    for entry in MoodEntry.objects.all():
        entry.score = mapping.get(entry.mood, 6)
        entry.save(update_fields=['score'])


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0018_remove_height_weight_from_profile'),
    ]

    operations = [
        migrations.AddField(
            model_name='moodentry',
            name='score',
            field=models.PositiveSmallIntegerField(
                null=True,
                help_text='Mood score from 1 (worst) to 10 (best).',
            ),
        ),
        migrations.AddField(
            model_name='moodentry',
            name='notes',
            field=models.TextField(
                blank=True,
                default='',
                help_text='Optional notes about how the user feels.',
            ),
        ),
        migrations.RunPython(convert_mood_to_score, migrations.RunPython.noop),
        migrations.AlterField(
            model_name='moodentry',
            name='score',
            field=models.PositiveSmallIntegerField(
                help_text='Mood score from 1 (worst) to 10 (best).',
            ),
        ),
        migrations.RemoveField(
            model_name='moodentry',
            name='mood',
        ),
    ]
