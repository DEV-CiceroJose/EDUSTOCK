from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0011_frequencia_registrado_por_turma"),
    ]

    operations = [
        migrations.AlterField(
            model_name="frequenciadiaria",
            name="registrado_por_turma",
            field=models.CharField(
                max_length=20,
                blank=True,
                default="",
                verbose_name="Registrado pela turma (PIN)",
            ),
        ),
    ]
