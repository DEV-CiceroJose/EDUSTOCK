import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0005_repoint_produtos_para_grupo"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="produto",
            name="categoria",
        ),
        migrations.AlterField(
            model_name="produto",
            name="grupo",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.PROTECT,
                related_name="produtos",
                to="core.grupo",
            ),
        ),
    ]
