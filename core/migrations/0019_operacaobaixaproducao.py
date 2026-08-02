from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0018_alert_config_and_remove_legacy_product_fields"),
    ]

    operations = [
        migrations.CreateModel(
            name="OperacaoBaixaProducao",
            fields=[
                (
                    "id",
                    models.BigAutoField(
                        auto_created=True,
                        primary_key=True,
                        serialize=False,
                        verbose_name="ID",
                    ),
                ),
                ("operacao_id", models.UUIDField(editable=False, unique=True)),
                ("data", models.DateField(db_index=True)),
                (
                    "turno",
                    models.CharField(
                        choices=[
                            ("MANHA", "Manhã"),
                            ("TARDE", "Tarde"),
                            ("INTEGRAL", "Integral"),
                        ],
                        max_length=10,
                    ),
                ),
                ("itens_solicitados", models.JSONField(blank=True, default=list)),
                (
                    "status",
                    models.CharField(
                        choices=[("CONCLUIDA", "Concluída"), ("PARCIAL", "Parcial")],
                        max_length=10,
                    ),
                ),
                ("resultado", models.JSONField(default=dict)),
                ("criado_em", models.DateTimeField(auto_now_add=True)),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Operação de baixa de produção",
                "verbose_name_plural": "Operações de baixa de produção",
                "ordering": ["-criado_em"],
            },
        ),
    ]
