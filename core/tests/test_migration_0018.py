from datetime import date
from decimal import Decimal

from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class LegacyProductDataMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0017_add_inventory_query_indexes")
    migrate_to = ("core", "0018_alert_config_and_remove_legacy_product_fields")

    def setUp(self):
        super().setUp()
        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_from])
        old_apps = executor.loader.project_state([self.migrate_from]).apps

        Categoria = old_apps.get_model("core", "Categoria")
        Grupo = old_apps.get_model("core", "Grupo")
        Produto = old_apps.get_model("core", "Produto")
        categoria = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=categoria)
        self.produto_id = Produto.objects.create(
            nome="Arroz histórico",
            numero_nota_fiscal="NF-LEG-1",
            grupo=grupo,
            quantidade=Decimal("12.000"),
            unidade="KG",
            preco=Decimal("5.50"),
        ).pk

        executor = MigrationExecutor(connection)
        executor.migrate([self.migrate_to])
        self.apps = executor.loader.project_state([self.migrate_to]).apps

    def test_converte_campos_antigos_em_entrada_real(self):
        Produto = self.apps.get_model("core", "Produto")
        Entrada = self.apps.get_model("core", "Entrada")
        Movimentacao = self.apps.get_model("core", "Movimentacao")
        ConfiguracaoAlertas = self.apps.get_model("core", "ConfiguracaoAlertas")

        produto = Produto.objects.get(pk=self.produto_id)
        movimento = Movimentacao.objects.get(produto_id=produto.pk)
        self.assertEqual(movimento.quantidade, Decimal("12.000"))
        self.assertEqual(movimento.preco_unitario, Decimal("5.50"))
        self.assertEqual(movimento.entrada.numero_nota_fiscal, "NF-LEG-1")
        self.assertEqual(Entrada.objects.count(), 1)
        self.assertEqual(ConfiguracaoAlertas.objects.get(pk=1).estoque_percentual, 20)
        self.assertFalse(hasattr(produto, "preco"))
        self.assertFalse(hasattr(produto, "numero_nota_fiscal"))

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate(executor.loader.graph.leaf_nodes())
