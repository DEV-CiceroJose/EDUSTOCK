from decimal import Decimal

from django.db import migrations, models


def migrar_dados_legados(apps, schema_editor):
    Produto = apps.get_model("core", "Produto")
    Entrada = apps.get_model("core", "Entrada")
    Movimentacao = apps.get_model("core", "Movimentacao")

    # Primeiro transfere a NF antiga para entradas reais que ainda estavam sem
    # número, apenas quando todos os itens apontam para a mesma nota.
    for entrada in Entrada.objects.filter(numero_nota_fiscal="").iterator():
        notas = set(
            Movimentacao.objects.filter(entrada_id=entrada.pk)
            .exclude(produto__numero_nota_fiscal__isnull=True)
            .exclude(produto__numero_nota_fiscal="")
            .values_list("produto__numero_nota_fiscal", flat=True)
        )
        if len(notas) == 1:
            entrada.numero_nota_fiscal = notas.pop()
            entrada.save(update_fields=["numero_nota_fiscal"])

    # Produtos antigos sem uma entrada vinculada eram tratados como documentos
    # fictícios pelo relatório. Eles passam a ter uma Entrada/Movimentação real,
    # sem alterar o saldo já armazenado em Produto.quantidade.
    produtos = (
        Produto.objects.exclude(numero_nota_fiscal__isnull=True, preco__isnull=True)
        .select_related("fornecedor")
        .iterator()
    )
    for produto in produtos:
        if Movimentacao.objects.filter(
            produto_id=produto.pk, entrada__isnull=False
        ).exists():
            continue
        if not produto.numero_nota_fiscal and produto.preco is None:
            continue

        data_entrada = produto.criado_em.date()
        entrada = Entrada.objects.create(
            fornecedor_id=produto.fornecedor_id,
            numero_nota_fiscal=produto.numero_nota_fiscal or "",
            data=data_entrada,
            observacao="Histórico convertido automaticamente na Fase 4.",
            criado_por_id=produto.criado_por_id,
        )
        Movimentacao.objects.create(
            produto_id=produto.pk,
            tipo="ENTRADA",
            quantidade=produto.quantidade or Decimal("0"),
            preco_unitario=produto.preco,
            entrada_id=entrada.pk,
            motivo="Conversão de cadastro legado",
            data=data_entrada,
            criado_por_id=produto.criado_por_id,
        )


def criar_configuracao_padrao(apps, schema_editor):
    ConfiguracaoAlertas = apps.get_model("core", "ConfiguracaoAlertas")
    ConfiguracaoAlertas.objects.get_or_create(
        pk=1,
        defaults={
            "critico_dias": 7,
            "alerta_dias": 30,
            "estoque_percentual": 20,
        },
    )


class Migration(migrations.Migration):
    dependencies = [
        ("core", "0017_add_inventory_query_indexes"),
    ]

    operations = [
        migrations.CreateModel(
            name="ConfiguracaoAlertas",
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
                (
                    "critico_dias",
                    models.PositiveSmallIntegerField(
                        default=7,
                        help_text="Produtos com menos dias que este valor são classificados como críticos.",
                        verbose_name="Prazo crítico de validade (dias)",
                    ),
                ),
                (
                    "alerta_dias",
                    models.PositiveSmallIntegerField(
                        default=30,
                        help_text="Janela padrão usada para listar produtos próximos do vencimento.",
                        verbose_name="Antecedência padrão de validade (dias)",
                    ),
                ),
                (
                    "estoque_percentual",
                    models.PositiveSmallIntegerField(
                        default=20,
                        help_text="Percentual do estoque mínimo abaixo do qual o produto gera alerta.",
                        verbose_name="Limiar de estoque baixo (%)",
                    ),
                ),
                ("atualizado_em", models.DateTimeField(auto_now=True)),
            ],
            options={
                "verbose_name": "Configuração de alertas",
                "verbose_name_plural": "Configuração de alertas",
            },
        ),
        migrations.RunPython(criar_configuracao_padrao, migrations.RunPython.noop),
        migrations.RunPython(migrar_dados_legados, migrations.RunPython.noop),
        migrations.RemoveField(model_name="produto", name="numero_nota_fiscal"),
        migrations.RemoveField(model_name="produto", name="preco"),
    ]
