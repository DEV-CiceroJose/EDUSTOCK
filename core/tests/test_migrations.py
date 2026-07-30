from decimal import Decimal
from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class RepointDataMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0004_fundacao_grupo_bempermanente")
    migrate_to = ("core", "0005_repoint_produtos_para_grupo")

    def _migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_produto_vai_para_grupo_geral_e_volta(self):
        # estado em 0004 (categoria ainda existe, grupo nullable)
        apps = self._migrate(self.migrate_from)
        Categoria = apps.get_model("core", "Categoria")
        Produto = apps.get_model("core", "Produto")
        cat = Categoria.objects.create(name="Alimentos")
        Produto.objects.create(nome="Arroz", categoria=cat, quantidade=Decimal("10"), unidade="KG")

        # aplica 0005 (forward)
        apps = self._migrate(self.migrate_to)
        Produto = apps.get_model("core", "Produto")
        prod = Produto.objects.get(nome="Arroz")
        self.assertIsNotNone(prod.grupo_id)
        self.assertEqual(prod.grupo.nome, "Geral")
        self.assertEqual(prod.grupo.categoria.name, "Alimentos")
        self.assertEqual(prod.quantidade, Decimal("10"))

        # reverse para 0004 restaura categoria e remove "Geral"
        apps = self._migrate(self.migrate_from)
        Produto = apps.get_model("core", "Produto")
        Grupo = apps.get_model("core", "Grupo")
        prod = Produto.objects.get(nome="Arroz")
        self.assertEqual(prod.categoria.name, "Alimentos")
        self.assertEqual(Grupo.objects.filter(nome="Geral").count(), 0)

    def tearDown(self):
        # deixa o banco de teste na migração mais recente
        self._migrate(("core", "0005_repoint_produtos_para_grupo"))


class SaldoInicialMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0008_movimentacoes")
    migrate_to = ("core", "0009_saldo_inicial")

    def _migrate(self, target):
        from django.db.migrations.executor import MigrationExecutor
        from django.db import connection
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_saldo_inicial_nao_altera_saldo(self):
        from decimal import Decimal
        apps = self._migrate(self.migrate_from)
        Categoria = apps.get_model("core", "Categoria")
        Grupo = apps.get_model("core", "Grupo")
        Produto = apps.get_model("core", "Produto")
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        Produto.objects.create(nome="Arroz", grupo=grupo, quantidade=Decimal("10"), unidade="KG")

        apps = self._migrate(self.migrate_to)
        Produto = apps.get_model("core", "Produto")
        Movimentacao = apps.get_model("core", "Movimentacao")
        prod = Produto.objects.get(nome="Arroz")
        self.assertEqual(prod.quantidade, Decimal("10.000"))  # saldo não muda
        mov = Movimentacao.objects.get(produto=prod, motivo="saldo inicial")
        self.assertEqual(mov.tipo, "ENTRADA")
        self.assertEqual(mov.quantidade, Decimal("10.000"))

    def tearDown(self):
        self._migrate(("core", "0009_saldo_inicial"))


class ProtecaoPinMigrationTest(TransactionTestCase):
    migrate_from = ("core", "0015_delete_perfil")
    migrate_to = ("core", "0016_protect_pins_and_add_shared_cache")

    def _migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_pin_existente_e_convertido_sem_perder_acesso(self):
        from django.contrib.auth.hashers import check_password

        apps = self._migrate(self.migrate_from)
        Turma = apps.get_model("core", "Turma")
        PinAcesso = apps.get_model("core", "PinAcesso")
        turma = Turma.objects.create(
            nome="Turma Migração PIN",
            curso="DS",
            ano=1,
            turno="INTEGRAL",
        )
        PinAcesso.objects.create(
            papel="ALUNO_REP",
            turma=turma,
            pin="4321",
        )

        apps = self._migrate(self.migrate_to)
        PinAcesso = apps.get_model("core", "PinAcesso")
        protegido = PinAcesso.objects.get(turma__nome="Turma Migração PIN")
        self.assertNotEqual(protegido.pin, "4321")
        self.assertTrue(check_password("4321", protegido.pin))
        self.assertEqual(len(protegido.pin_fingerprint), 64)

    def tearDown(self):
        self._migrate(self.migrate_to)
