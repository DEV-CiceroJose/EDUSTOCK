import django.core.validators
import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("core", "0012_alter_frequenciadiaria_registrado_por_turma"),
    ]

    operations = [
        migrations.CreateModel(
            name="Turma",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("nome", models.CharField(max_length=50, unique=True)),
                ("curso", models.CharField(choices=[("DS", "Desenvolvimento de Sistemas"), ("TET", "Eletrotécnica")], max_length=3)),
                ("ano", models.PositiveSmallIntegerField()),
                ("turno", models.CharField(choices=[("MANHA", "Manhã"), ("TARDE", "Tarde"), ("INTEGRAL", "Integral")], default="INTEGRAL", max_length=10)),
                ("ativo", models.BooleanField(default=True)),
            ],
            options={
                "verbose_name": "Turma",
                "verbose_name_plural": "Turmas",
                "ordering": ["curso", "ano", "nome"],
            },
        ),
        migrations.CreateModel(
            name="PinAcesso",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("papel", models.CharField(choices=[("ALUNO_REP", "Representante de turma"), ("COZINHA", "Equipe da cozinha")], default="ALUNO_REP", max_length=10)),
                ("pin", models.CharField(max_length=4, unique=True, validators=[django.core.validators.RegexValidator("^\\d{4}$", "PIN deve ter exatamente 4 dígitos.")])),
                ("titular", models.CharField(blank=True, default="", max_length=100, verbose_name="Nome de quem escolheu o PIN")),
                ("ativo", models.BooleanField(default=True)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("turma", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.CASCADE, related_name="pins", to="core.turma")),
            ],
            options={
                "verbose_name": "PIN de acesso",
                "verbose_name_plural": "PINs de acesso",
                "ordering": ["turma__nome", "papel"],
                "constraints": [models.CheckConstraint(condition=models.Q(models.Q(("papel", "ALUNO_REP"), ("turma__isnull", False)), models.Q(("papel", "COZINHA"), ("turma__isnull", True)), _connector="OR"), name="turma_obrigatoria_apenas_para_aluno_rep")],
            },
        ),
    ]
