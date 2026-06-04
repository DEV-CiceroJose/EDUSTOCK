from django.db import migrations


def criar_grupos_geral(apps, schema_editor):
    Categoria = apps.get_model("core", "Categoria")
    Grupo = apps.get_model("core", "Grupo")
    Produto = apps.get_model("core", "Produto")
    for cat in Categoria.objects.all():
        grupo, _ = Grupo.objects.get_or_create(categoria=cat, nome="Geral")
        Produto.objects.filter(categoria=cat, grupo__isnull=True).update(grupo=grupo)


def reverter(apps, schema_editor):
    Grupo = apps.get_model("core", "Grupo")
    Produto = apps.get_model("core", "Produto")
    for produto in Produto.objects.select_related("grupo__categoria").all():
        if produto.grupo_id:
            produto.categoria_id = produto.grupo.categoria_id
            produto.grupo_id = None
            produto.save(update_fields=["categoria", "grupo"])
    Grupo.objects.filter(nome="Geral").delete()


class Migration(migrations.Migration):
    dependencies = [("core", "0004_fundacao_grupo_bempermanente")]
    operations = [migrations.RunPython(criar_grupos_geral, reverter)]
