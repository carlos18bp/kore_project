from django.db import migrations


def remap_descuento(apps, schema_editor):
    StoreItem = apps.get_model('core_app', 'StoreItem')
    StoreItem.objects.filter(item_type='descuento').update(item_type='servicio')


class Migration(migrations.Migration):

    dependencies = [
        ('core_app', '0061_store_delivery_photo'),
    ]

    operations = [
        migrations.RunPython(remap_descuento, migrations.RunPython.noop),
    ]
