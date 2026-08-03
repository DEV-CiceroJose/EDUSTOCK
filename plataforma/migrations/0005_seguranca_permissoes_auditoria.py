from django.conf import settings
from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):
    dependencies = [
        ("plataforma", "0004_seed_modulo_financeiro"),
        migrations.swappable_dependency(settings.AUTH_USER_MODEL),
    ]

    operations = [
        # Tokens duram poucas horas e não podem ser migrados sem manter o segredo
        # antigo em texto puro. O deploy invalida as sessões administrativas abertas.
        migrations.DeleteModel(name="TokenAcesso"),
        migrations.CreateModel(
            name="TokenAcesso",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("token_hash", models.CharField(editable=False, max_length=64, unique=True)),
                ("token_prefixo", models.CharField(editable=False, max_length=12)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("expira_em", models.DateTimeField()),
                ("user", models.ForeignKey(on_delete=django.db.models.deletion.CASCADE, related_name="tokens_acesso", to=settings.AUTH_USER_MODEL)),
            ],
            options={"verbose_name": "Token de acesso", "verbose_name_plural": "Tokens de acesso"},
        ),
        migrations.AddField(
            model_name="perfil",
            name="modulos",
            field=models.ManyToManyField(
                blank=True,
                help_text="Vazio mantém acesso a todos os módulos ativos para compatibilidade.",
                related_name="perfis_autorizados",
                to="plataforma.modulo",
            ),
        ),
        migrations.CreateModel(
            name="RegistroAuditoria",
            fields=[
                ("id", models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name="ID")),
                ("acao", models.CharField(max_length=40)),
                ("recurso", models.CharField(max_length=80)),
                ("objeto_id", models.CharField(blank=True, max_length=80)),
                ("detalhes", models.JSONField(blank=True, default=dict)),
                ("criado_em", models.DateTimeField(auto_now_add=True, db_index=True)),
                ("user", models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name="registros_auditoria", to=settings.AUTH_USER_MODEL)),
            ],
            options={
                "verbose_name": "Registro de auditoria",
                "verbose_name_plural": "Registros de auditoria",
                "ordering": ["-criado_em"],
            },
        ),
    ]
