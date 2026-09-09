from datetime import date, timedelta

from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import Categoria, FrequenciaDiaria, Grupo, Produto, RegistroRefeicao, Turma
from core.tests.utils import AutenticadoAPITestCase
from plataforma.models import Escola, Modulo, Perfil, VinculoUsuario, escola_padrao_id


class DashboardOperacionalApiTest(AutenticadoAPITestCase):
    def test_exige_autenticacao(self):
        self.client.credentials()
        resposta = self.client.get("/api/dashboard/operacao/")
        self.assertEqual(resposta.status_code, 401)

    def test_rejeita_data_invalida(self):
        resposta = self.client.get("/api/dashboard/operacao/?data=08-09-2026")
        self.assertEqual(resposta.status_code, 400)
        self.assertEqual(resposta.json()["detail"], "Data inválida. Use YYYY-MM-DD.")

    def test_retorna_contrato_vazio_da_escola_autenticada(self):
        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["data"], date(2026, 9, 8).isoformat())
        self.assertEqual(corpo["presenca"]["total_alunos"], 0)
        self.assertEqual(corpo["refeicoes"]["previstas"], 0)
        self.assertEqual(corpo["estoque"]["itens"], 0)
        self.assertEqual(corpo["proximas_acoes"], [])
        self.assertEqual(corpo["tendencia"], [])
        self.assertEqual(corpo["atividade_recente"], [])


class DashboardOperacionalEscopoTest(AutenticadoAPITestCase):
    data_dashboard = date(2026, 9, 8)

    def setUp(self):
        super().setUp()
        self.escola = Escola.objects.get(pk=escola_padrao_id())
        Turma.objects.filter(escola=self.escola).update(ativo=False)
        VinculoUsuario.objects.filter(user=self.user).delete()
        VinculoUsuario.objects.create(
            user=self.user,
            municipio=self.escola.municipio,
            escola=self.escola,
            papel=VinculoUsuario.GESTOR_ESCOLA,
        )
        self.token.escola = self.escola
        self.token.municipio = self.escola.municipio
        self.token.papel_rede = VinculoUsuario.GESTOR_ESCOLA
        self.token.save(update_fields=["escola", "municipio", "papel_rede"])
        self.outra_escola = Escola.objects.create(
            municipio=self.escola.municipio,
            nome="Escola Fora do Escopo",
            slug="fora-do-escopo",
        )

    def _criar_dados_da_escola(self, escola, *, alunos, nome):
        turma = Turma.objects.create(
            escola=escola,
            nome=f"Turma {nome}",
            curso=Turma.DS,
            ano=1,
            turno=Turma.INTEGRAL,
            ativo=True,
        )
        FrequenciaDiaria.objects.create(
            escola=escola,
            data=self.data_dashboard,
            turno=FrequenciaDiaria.INTEGRAL,
            turma=turma.nome,
            quantidade_alunos=alunos,
        )
        categoria = Categoria.objects.create(escola=escola, name=f"Categoria {nome}")
        grupo = Grupo.objects.create(escola=escola, categoria=categoria, nome=f"Grupo {nome}")
        Produto.objects.create(
            escola=escola,
            nome=f"Produto {nome}",
            grupo=grupo,
            unidade="KG",
            quantidade=0,
            estoque_minimo=10,
            validade=timezone.localdate() + timedelta(days=1),
        )
        RegistroRefeicao.objects.create(
            escola=escola,
            data=self.data_dashboard,
            refeicao="ALMOCO",
            porcoes_planejadas=alunos,
            porcoes_produzidas=alunos - 1,
            porcoes_servidas=alunos - 2,
            descarte_kg="1.250",
        )

    def test_retorna_apenas_dados_da_escola_do_token_ignorando_escola_id(self):
        self._criar_dados_da_escola(self.escola, alunos=31, nome="Autorizada")
        self._criar_dados_da_escola(self.outra_escola, alunos=99, nome="Externa")

        resposta = self.client.get(
            f"/api/dashboard/operacao/?data=2026-09-08&escola_id={self.outra_escola.id}"
        )

        self.assertEqual(resposta.status_code, 200, resposta.content)
        corpo = resposta.json()
        self.assertEqual(corpo["escola"]["id"], self.escola.id)
        self.assertEqual(corpo["presenca"]["total_alunos"], 31)
        self.assertEqual(corpo["presenca"]["turmas_registradas"], 1)
        self.assertEqual(corpo["presenca"]["turmas_esperadas"], 1)
        self.assertEqual(corpo["refeicoes"]["previstas"], 31)
        self.assertEqual(corpo["refeicoes"]["produzidas"], 30)
        self.assertEqual(corpo["refeicoes"]["servidas"], 29)
        self.assertEqual(corpo["refeicoes"]["descarte_kg"], "1.250")
        etapas = {etapa["refeicao"]: etapa["status"] for etapa in corpo["refeicoes"]["etapas"]}
        self.assertEqual(etapas, {
            "CAFE_MANHA": "SEM_REGISTRO",
            "ALMOCO": "AGUARDANDO_BAIXA",
            "LANCHE_TARDE": "SEM_REGISTRO",
        })
        self.assertEqual(corpo["estoque"]["itens"], 1)
        self.assertEqual(corpo["estoque"]["criticos"], 1)
        self.assertEqual(corpo["estoque"]["proximos_vencimento"], 1)

    def test_oculta_secao_sem_modulo_autorizado(self):
        perfil = self.user.perfil
        perfil.papel = Perfil.OPERADOR
        perfil.acesso_legado = False
        perfil.save(update_fields=["papel", "acesso_legado"])
        perfil.modulos.clear()
        perfil.modulos.add(Modulo.objects.get(slug="inventario"))

        with CaptureQueriesContext(connection) as consultas_inventario:
            somente_inventario = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(somente_inventario.status_code, 200, somente_inventario.content)
        self.assertIsNone(somente_inventario.json()["presenca"])
        self.assertIsNone(somente_inventario.json()["refeicoes"])
        sql_inventario = "\n".join(consulta["sql"] for consulta in consultas_inventario).lower()
        for tabela in ("core_frequenciadiaria", "core_turma", "core_registrorefeicao", "core_operacaobaixaproducao"):
            with self.subTest(tabela=tabela):
                self.assertNotIn(tabela, sql_inventario)

        perfil.modulos.clear()
        perfil.modulos.add(Modulo.objects.get(slug="merenda"))

        with CaptureQueriesContext(connection) as consultas_merenda:
            somente_merenda = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(somente_merenda.status_code, 200, somente_merenda.content)
        self.assertIsNone(somente_merenda.json()["estoque"])
        sql_merenda = "\n".join(consulta["sql"] for consulta in consultas_merenda).lower()
        self.assertNotIn("core_produto", sql_merenda)
