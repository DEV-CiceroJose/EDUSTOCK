from django.db import migrations


def criar_saldo_inicial(apps, schema_editor):
    from django.utils import timezone
    Produto = apps.get_model("core", "Produto")
    Movimentacao = apps.get_model("core", "Movimentacao")
    hoje = timezone.localdate()
    movs = [
        Movimentacao(produto=p, tipo="ENTRADA", quantidade=p.quantidade,
                     motivo="saldo inicial", data=hoje)
        for p in Produto.objects.filter(quantidade__gt=0)
    ]
    Movimentacao.objects.bulk_create(movs)


def remover_saldo_inicial(apps, schema_editor):
    Movimentacao = apps.get_model("core", "Movimentacao")
    Movimentacao.objects.filter(motivo="saldo inicial").delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0008_movimentacoes")]
    operations = [migrations.RunPython(criar_saldo_inicial, remover_saldo_inicial)]
