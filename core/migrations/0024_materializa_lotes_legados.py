from decimal import Decimal

from django.db import migrations
from django.db.models import Sum


PREFIXO_LOTE_LEGADO = "LEGADO-0024-"


def materializar_lotes_legados(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")
    LoteEstoque = apps.get_model("core", "LoteEstoque")

    for produto in Produto.objects.filter(quantidade__gt=0).iterator():
        total_lotes = (
            LoteEstoque.objects.filter(produto_id=produto.pk)
            .aggregate(total=Sum("quantidade"))["total"]
            or Decimal("0")
        )
        diferenca = produto.quantidade - total_lotes
        if diferenca > 0:
            codigo = f"{PREFIXO_LOTE_LEGADO}{produto.pk}"
            if LoteEstoque.objects.filter(
                produto_id=produto.pk, codigo=codigo
            ).exists():
                raise RuntimeError(
                    f"Código reservado de lote legado já existe para o produto {produto.pk}."
                )
            LoteEstoque.objects.create(
                produto_id=produto.pk,
                codigo=codigo,
                quantidade=diferenca,
            )


def remover_lotes_legados(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")
    LoteEstoque = apps.get_model("core", "LoteEstoque")
    for produto_id in Produto.objects.values_list("pk", flat=True).iterator():
        LoteEstoque.objects.filter(
            produto_id=produto_id,
            codigo=f"{PREFIXO_LOTE_LEGADO}{produto_id}",
        ).delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0023_estorno_movimentacao")]

    operations = [
        migrations.RunPython(materializar_lotes_legados, remover_lotes_legados),
    ]
