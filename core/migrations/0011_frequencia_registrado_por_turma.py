"""
Adiciona o campo registrado_por_turma a FrequenciaDiaria.
Esse campo guarda o identificador/PIN da turma que registrou a frequência,
separando a rastreabilidade do app-alunos do usuário Django admin.
"""
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0010_operacao_merenda"),
    ]

    operations = [
        migrations.AddField(
            model_name="frequenciadiaria",
            name="registrado_por_turma",
            field=models.CharField(
                max_length=20,
                blank=True,
                default="",
                verbose_name="Registrado pela turma (PIN)",
                help_text="Identificador da turma que enviou a contagem via app-alunos.",
            ),
        ),
    ]
