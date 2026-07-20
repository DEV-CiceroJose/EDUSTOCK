from django.db import migrations


def seed_financeiro(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    Modulo.objects.create(
        slug="financeiro", nome="Financeiro",
        descricao="Exibição de preço/custo no cadastro de produtos, entradas e relatórios.",
        ativo=False,
    )


def remover_financeiro(apps, schema_editor):
    Modulo = apps.get_model("plataforma", "Modulo")
    Modulo.objects.filter(slug="financeiro").delete()


class Migration(migrations.Migration):
    dependencies = [("plataforma", "0003_alter_perfil_user")]
    operations = [migrations.RunPython(seed_financeiro, remover_financeiro)]
