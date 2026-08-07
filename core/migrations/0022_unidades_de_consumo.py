from decimal import Decimal

import django.core.validators
from django.db import migrations, models


def preencher_conversoes_inequivocas(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")
    conversoes = {
        "KG": ("G", Decimal("1000")),
        "L": ("ML", Decimal("1000")),
        "UN": ("UN", Decimal("1")),
    }
    for unidade_estoque, (unidade_consumo, conteudo) in conversoes.items():
        Produto.objects.filter(unidade=unidade_estoque).update(
            unidade_consumo=unidade_consumo,
            conteudo_por_unidade=conteudo,
        )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0021_cardapios_lotes_e_idempotencia"),
    ]

    operations = [
        migrations.AddField(
            model_name="produto",
            name="unidade_consumo",
            field=models.CharField(
                blank=True,
                choices=[("G", "Grama"), ("ML", "Mililitro"), ("UN", "Unidade")],
                max_length=2,
                null=True,
            ),
        ),
        migrations.AddField(
            model_name="produto",
            name="conteudo_por_unidade",
            field=models.DecimalField(
                blank=True,
                decimal_places=3,
                max_digits=12,
                null=True,
                validators=[django.core.validators.MinValueValidator(Decimal("0.001"))],
            ),
        ),
        migrations.RunPython(
            preencher_conversoes_inequivocas,
            migrations.RunPython.noop,
        ),
        migrations.RenameField(
            model_name="fatorconsumo",
            old_name="gramas_por_aluno",
            new_name="quantidade_por_aluno",
        ),
        migrations.RenameField(
            model_name="receitaingrediente",
            old_name="gramas_por_aluno",
            new_name="quantidade_por_aluno",
        ),
    ]
