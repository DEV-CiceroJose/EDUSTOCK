from django.db import connection
from django.db.migrations.executor import MigrationExecutor
from django.test import TransactionTestCase


class SeedModulosMigrationTest(TransactionTestCase):
    def _migrate(self, target):
        executor = MigrationExecutor(connection)
        executor.loader.build_graph()
        executor.migrate([target])
        return executor.loader.project_state([target]).apps

    def test_seed_cria_seis_modulos_ativos_com_dependencia(self):
        # Garante estado limpo (0001) antes de migrar para frente: outras
        # suítes de TransactionTestCase (ex.: core.tests.test_migrations)
        # fazem flush de todas as tabelas ao final de cada teste, o que
        # apaga os dados semeados pela data migration sem desaplicá-la no
        # registro de migrations. Forçar a desaplicação aqui garante que a
        # migration 0002 realmente rode de novo, independente da ordem em
        # que os testes são executados.
        self._migrate(("plataforma", "0001_initial"))

        apps = self._migrate(("plataforma", "0002_seed_modulos"))
        Modulo = apps.get_model("plataforma", "Modulo")

        self.assertEqual(Modulo.objects.filter(ativo=True).count(), 6)
        merenda = Modulo.objects.get(slug="merenda")
        inventario = Modulo.objects.get(slug="inventario")
        self.assertEqual(merenda.depende_de_id, inventario.id)

        # reverte e confirma que a migration reversa funciona
        apps = self._migrate(("plataforma", "0001_initial"))
        Modulo = apps.get_model("plataforma", "Modulo")
        self.assertEqual(Modulo.objects.count(), 0)

    def test_seed_cria_financeiro_desativado_e_independente(self):
        # Garante estado limpo (0001) antes de migrar para frente
        self._migrate(("plataforma", "0001_initial"))

        apps = self._migrate(("plataforma", "0004_seed_modulo_financeiro"))
        Modulo = apps.get_model("plataforma", "Modulo")

        financeiro = Modulo.objects.get(slug="financeiro")
        self.assertFalse(financeiro.ativo)
        self.assertIsNone(financeiro.depende_de_id)
        # os outros 6 continuam ativos, este seed não mexe neles
        self.assertEqual(Modulo.objects.filter(ativo=True).count(), 6)

        # reverte e confirma que a migration reversa funciona
        apps = self._migrate(("plataforma", "0002_seed_modulos"))
        Modulo = apps.get_model("plataforma", "Modulo")
        self.assertFalse(Modulo.objects.filter(slug="financeiro").exists())

    def tearDown(self):
        executor = MigrationExecutor(connection)
        executor.migrate(executor.loader.graph.leaf_nodes())
        super().tearDown()
