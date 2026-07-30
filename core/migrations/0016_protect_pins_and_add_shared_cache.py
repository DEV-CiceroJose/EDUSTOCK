from django.contrib.auth.hashers import make_password
from django.conf import settings
from django.db import migrations, models
from django.utils.crypto import salted_hmac


def proteger_pins_existentes(apps, schema_editor):
    PinAcesso = apps.get_model("core", "PinAcesso")
    for pin_acesso in PinAcesso.objects.all().iterator():
        if pin_acesso.pin and len(pin_acesso.pin) == 4 and pin_acesso.pin.isdigit():
            pin_acesso.pin_fingerprint = salted_hmac(
                "core.PinAcesso.pin",
                pin_acesso.pin,
                secret=settings.PIN_LOOKUP_SECRET,
                algorithm="sha256",
            ).hexdigest()
            pin_acesso.pin = make_password(pin_acesso.pin)
            pin_acesso.save(update_fields=["pin", "pin_fingerprint"])


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0015_delete_perfil"),
    ]

    operations = [
        migrations.AlterField(
            model_name="pinacesso",
            name="pin",
            field=models.CharField(editable=False, max_length=128),
        ),
        migrations.AddField(
            model_name="pinacesso",
            name="pin_fingerprint",
            field=models.CharField(
                editable=False,
                max_length=64,
                null=True,
            ),
        ),
        migrations.RunPython(proteger_pins_existentes, migrations.RunPython.noop),
        migrations.AlterField(
            model_name="pinacesso",
            name="pin_fingerprint",
            field=models.CharField(
                editable=False,
                max_length=64,
                unique=True,
            ),
        ),
        migrations.CreateModel(
            name="CacheEntry",
            fields=[
                (
                    "cache_key",
                    models.CharField(max_length=255, primary_key=True, serialize=False),
                ),
                ("value", models.TextField()),
                ("expires", models.DateTimeField(db_index=True)),
            ],
            options={
                "verbose_name": "Entrada interna de cache",
                "verbose_name_plural": "Entradas internas de cache",
                "db_table": "edustock_cache",
            },
        ),
    ]
