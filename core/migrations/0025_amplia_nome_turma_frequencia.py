from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0024_materializa_lotes_legados"),
    ]

    operations = [
        migrations.AlterField(
            model_name="frequenciadiaria",
            name="turma",
            field=models.CharField(max_length=100),
        ),
        migrations.AlterField(
            model_name="frequenciadiaria",
            name="registrado_por_turma",
            field=models.CharField(
                blank=True,
                default="",
                max_length=100,
                verbose_name="Registrado pela turma (PIN)",
            ),
        ),
    ]
