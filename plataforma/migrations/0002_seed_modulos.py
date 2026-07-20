from django.db import migrations


def seed_modulos(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    inventario = Modulo.objects.create(
        slug="inventario", nome="Inventário",
        descricao="Produtos, categorias, grupos e bens permanentes.", ativo=True,
    )
    Modulo.objects.create(
        slug="movimentacoes", nome="Movimentações",
        descricao="Entradas e saídas de estoque.", ativo=True,
    )
    Modulo.objects.create(
        slug="fornecedores", nome="Fornecedores",
        descricao="Cadastro de fornecedores.", ativo=True,
    )
    Modulo.objects.create(
        slug="alertas", nome="Alertas",
        descricao="Alertas de validade e estoque crítico.", ativo=True,
    )
    Modulo.objects.create(
        slug="relatorios", nome="Relatórios",
        descricao="Prestação de contas e relatórios.", ativo=True,
    )
    Modulo.objects.create(
        slug="merenda", nome="Merenda",
        descricao="Contagem de frequência e produção da cozinha.",
        ativo=True, depende_de=inventario,
    )


def remover_modulos(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    # merenda primeiro: depende_de=inventario é PROTECT, então o dependente
    # precisa ser removido antes do módulo do qual ele depende.
    Modulo.objects.filter(slug="merenda").delete()
    Modulo.objects.filter(
        slug__in=["inventario", "movimentacoes", "fornecedores", "alertas", "relatorios"]
    ).delete()


class Migration(migrations.Migration):
    dependencies = [("plataforma", "0001_initial")]
    operations = [migrations.RunPython(seed_modulos, remover_modulos)]
