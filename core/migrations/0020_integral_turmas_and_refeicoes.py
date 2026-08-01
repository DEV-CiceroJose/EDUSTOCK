from django.db import migrations, models


def normalizar_dados(apps, schema_editor):
    Turma = apps.get_model("core", "Turma")
    OperacaoBaixaProducao = apps.get_model("core", "OperacaoBaixaProducao")

    Turma.objects.exclude(turno="INTEGRAL").update(turno="INTEGRAL")

    mapa_refeicoes = {
        "MANHA": "CAFE_MANHA",
        "TARDE": "LANCHE_TARDE",
        "INTEGRAL": "ALMOCO",
    }
    for turno_antigo, refeicao in mapa_refeicoes.items():
        OperacaoBaixaProducao.objects.filter(refeicao=turno_antigo).update(
            refeicao=refeicao
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0019_operacaobaixaproducao"),
    ]

    operations = [
        migrations.RenameField(
            model_name="operacaobaixaproducao",
            old_name="turno",
            new_name="refeicao",
        ),
        migrations.AlterField(
            model_name="operacaobaixaproducao",
            name="refeicao",
            field=models.CharField(
                choices=[
                    ("CAFE_MANHA", "Café da manhã"),
                    ("ALMOCO", "Almoço"),
                    ("LANCHE_TARDE", "Lanche da tarde"),
                ],
                max_length=12,
            ),
        ),
        migrations.RunPython(normalizar_dados, migrations.RunPython.noop),
        migrations.AddConstraint(
            model_name="operacaobaixaproducao",
            constraint=models.UniqueConstraint(
                fields=("data", "refeicao"),
                name="unique_baixa_producao_por_refeicao_dia",
            ),
        ),
        migrations.AlterField(
            model_name="turma",
            name="turno",
            field=models.CharField(
                choices=[("INTEGRAL", "Integral")],
                default="INTEGRAL",
                max_length=10,
            ),
        ),
    ]
