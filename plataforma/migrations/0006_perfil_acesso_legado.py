from django.db import migrations, models


def marcar_perfis_legados(apps, schema_editor):
    Perfil = apps.get_model("plataforma", "Perfil")
    Perfil.objects.filter(
        papel="OPERADOR",
        modulos__isnull=True,
    ).update(acesso_legado=True)


def desmarcar_perfis_legados(apps, schema_editor):
    Perfil = apps.get_model("plataforma", "Perfil")
    Perfil.objects.update(acesso_legado=False)


class Migration(migrations.Migration):
    dependencies = [("plataforma", "0005_seguranca_permissoes_auditoria")]

    operations = [
        migrations.AddField(
            model_name="perfil",
            name="acesso_legado",
            field=models.BooleanField(
                default=False,
                help_text=(
                    "Mantém o acesso amplo apenas para perfis migrados sem módulos explícitos."
                ),
            ),
        ),
        migrations.RunPython(marcar_perfis_legados, desmarcar_perfis_legados),
        migrations.AlterField(
            model_name="perfil",
            name="modulos",
            field=models.ManyToManyField(
                blank=True,
                help_text="Selecione explicitamente os módulos permitidos.",
                related_name="perfis_autorizados",
                to="plataforma.modulo",
            ),
        ),
    ]
