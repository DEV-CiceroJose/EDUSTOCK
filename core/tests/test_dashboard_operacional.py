from datetime import date, timedelta
from uuid import uuid4

from django.utils import timezone
from django.db import connection
from django.test.utils import CaptureQueriesContext

from core.models import (
    Cardapio,
    Categoria,
    ContagemEstoque,
    FrequenciaDiaria,
    Grupo,
    OperacaoBaixaProducao,
    Produto,
    Receita,
    RegistroRefeicao,
    Turma,
)
from core.tests.utils import AutenticadoAPITestCase
from plataforma.models import (
    Escola,
    Modulo,
    Perfil,
    RegistroAuditoria,
    VinculoUsuario,
    escola_padrao_id,
)


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
        Turma.objects.update(ativo=False)
        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")
        self.assertEqual(resposta.status_code, 200)
        corpo = resposta.json()
        self.assertEqual(corpo["data"], date(2026, 9, 8).isoformat())
        self.assertEqual(corpo["presenca"]["total_alunos"], 0)
        self.assertEqual(corpo["refeicoes"]["previstas"], 0)
        self.assertEqual(corpo["estoque"]["itens"], 0)
        self.assertEqual(corpo["proximas_acoes"], [])
        self.assertEqual(corpo["tendencia"], [
            {"data": "2026-09-02", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-03", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-04", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-05", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-06", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-07", "planejadas": 0, "produzidas": 0, "servidas": 0},
            {"data": "2026-09-08", "planejadas": 0, "produzidas": 0, "servidas": 0},
        ])
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

    def _criar_produto(self, *, nome, quantidade=0, estoque_minimo=10):
        categoria, _ = Categoria.objects.get_or_create(
            escola=self.escola,
            name="Categoria do dashboard",
        )
        grupo, _ = Grupo.objects.get_or_create(
            escola=self.escola,
            categoria=categoria,
            nome="Grupo do dashboard",
        )
        return Produto.objects.create(
            escola=self.escola,
            nome=nome,
            grupo=grupo,
            unidade="KG",
            quantidade=quantidade,
            estoque_minimo=estoque_minimo,
        )

    def _criar_dez_produtos_e_auditorias(self):
        for indice in range(10):
            produto = self._criar_produto(nome=f"Produto extra {indice}", quantidade=20)
            RegistroAuditoria.objects.create(
                user=self.user,
                escola=self.escola,
                acao="ATUALIZOU",
                recurso="Produto",
                objeto_id=str(produto.id),
                detalhes={"quantidade": "informação restrita"},
            )

    def test_retorna_acoes_pendentes_em_ordem_deterministica(self):
        Turma.objects.create(
            escola=self.escola,
            nome="Turma sem frequência",
            curso=Turma.DS,
            ano=1,
            turno=Turma.INTEGRAL,
            ativo=True,
        )
        receita = Receita.objects.create(
            escola=self.escola,
            nome="Almoço pendente",
            refeicao="ALMOCO",
        )
        Cardapio.objects.create(
            escola=self.escola,
            data=self.data_dashboard,
            refeicao="ALMOCO",
            receita=receita,
        )
        produto = self._criar_produto(nome="Produto crítico")
        ContagemEstoque.objects.create(
            escola=self.escola,
            produto=produto,
            data=self.data_dashboard,
            quantidade_sistema="10.000",
            quantidade_fisica="8.000",
        )

        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        acoes = resposta.json()["proximas_acoes"]
        self.assertEqual(
            [item["codigo"] for item in acoes],
            ["TURMAS_PENDENTES", "REFEICAO_PENDENTE", "ESTOQUE_CRITICO", "DIVERGENCIA_ESTOQUE"],
        )
        acao_refeicao = next(
            item for item in acoes if item["codigo"] == "REFEICAO_PENDENTE"
        )
        self.assertEqual(acao_refeicao["href"], "/merenda?view=producao")
        for item in acoes:
            with self.subTest(codigo=item["codigo"]):
                self.assertTrue(
                    {"codigo", "prioridade", "titulo", "descricao", "href"}.issubset(item)
                )
                self.assertIn(
                    item["href"],
                    {"/merenda", "/merenda?view=producao", "/alertas", "/rede"},
                )

    def test_preserva_maior_urgencia_quando_produto_tem_dois_alertas(self):
        produto = self._criar_produto(
            nome="Produto vencido com estoque baixo",
            quantidade=5,
            estoque_minimo=10,
        )
        produto.validade = timezone.localdate() - timedelta(days=1)
        produto.save(update_fields=["validade"])

        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        estoque = resposta.json()["estoque"]
        self.assertEqual(estoque["criticos"], 1)
        self.assertEqual(estoque["atencao"], 0)
        self.assertEqual(estoque["vencidos"], 1)

    def test_baixa_parcial_nao_mantem_acao_de_confirmacao_impossivel(self):
        receita = Receita.objects.create(
            escola=self.escola,
            nome="Almoço parcialmente baixado",
            refeicao="ALMOCO",
        )
        Cardapio.objects.create(
            escola=self.escola,
            data=self.data_dashboard,
            refeicao="ALMOCO",
            receita=receita,
        )
        OperacaoBaixaProducao.objects.create(
            escola=self.escola,
            operacao_id=uuid4(),
            data=self.data_dashboard,
            refeicao="ALMOCO",
            status=OperacaoBaixaProducao.PARCIAL,
        )

        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        codigos = [item["codigo"] for item in resposta.json()["proximas_acoes"]]
        self.assertNotIn("REFEICAO_PENDENTE", codigos)

    def test_divergencia_exige_inventario_e_alertas_autorizados(self):
        produto = self._criar_produto(nome="Produto contado", quantidade=20)
        ContagemEstoque.objects.create(
            escola=self.escola,
            produto=produto,
            data=self.data_dashboard,
            quantidade_sistema="20.000",
            quantidade_fisica="18.000",
        )
        perfil = self.user.perfil
        perfil.papel = Perfil.OPERADOR
        perfil.acesso_legado = False
        perfil.save(update_fields=["papel", "acesso_legado"])
        perfil.modulos.set([Modulo.objects.get(slug="inventario")])

        somente_inventario = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertNotIn(
            "DIVERGENCIA_ESTOQUE",
            [item["codigo"] for item in somente_inventario.json()["proximas_acoes"]],
        )

        perfil.modulos.add(Modulo.objects.get(slug="alertas"))

        inventario_e_alertas = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertIn(
            "DIVERGENCIA_ESTOQUE",
            [item["codigo"] for item in inventario_e_alertas.json()["proximas_acoes"]],
        )

    def test_retorna_tendencia_de_sete_dias_e_atividade_recente_segura(self):
        RegistroRefeicao.objects.create(
            escola=self.escola,
            data=self.data_dashboard - timedelta(days=6),
            refeicao="CAFE_MANHA",
            porcoes_planejadas=20,
            porcoes_produzidas=18,
            porcoes_servidas=17,
        )
        RegistroRefeicao.objects.create(
            escola=self.escola,
            data=self.data_dashboard,
            refeicao="ALMOCO",
            porcoes_planejadas=30,
            porcoes_produzidas=29,
            porcoes_servidas=28,
        )
        RegistroRefeicao.objects.create(
            escola=self.escola,
            data=self.data_dashboard - timedelta(days=8),
            refeicao="LANCHE_TARDE",
            porcoes_planejadas=99,
            porcoes_produzidas=98,
            porcoes_servidas=97,
        )
        for indice in range(10):
            RegistroAuditoria.objects.create(
                user=self.user,
                escola=self.escola,
                acao="ATUALIZOU",
                recurso=f"Recurso {indice}",
                objeto_id=str(indice),
                detalhes={"segredo": "não expor"},
            )
        RegistroAuditoria.objects.create(
            escola=self.outra_escola,
            acao="EXTERNA",
            recurso="Recurso externo",
            detalhes={"segredo": "não expor"},
        )
        RegistroAuditoria.objects.create(
            user=self.user,
            escola=self.escola,
            acao="ATUALIZOU",
            recurso="Produto",
            objeto_id="autorizado",
            detalhes={"segredo": "não expor"},
        )

        resposta = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        tendencia = resposta.json()["tendencia"]
        self.assertEqual([item["data"] for item in tendencia], [
            "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08",
        ])
        self.assertEqual(tendencia[0], {
            "data": "2026-09-02", "planejadas": 20, "produzidas": 18, "servidas": 17,
        })
        self.assertEqual(tendencia[-1], {
            "data": "2026-09-08", "planejadas": 30, "produzidas": 29, "servidas": 28,
        })
        for item in tendencia[1:-1]:
            with self.subTest(data=item["data"]):
                self.assertEqual(item["planejadas"], 0)
                self.assertEqual(item["produzidas"], 0)
                self.assertEqual(item["servidas"], 0)

        atividade = resposta.json()["atividade_recente"]
        self.assertLessEqual(len(atividade), 8)
        self.assertNotIn("Recurso externo", [item["recurso"] for item in atividade])
        self.assertNotIn("Recurso 0", [item["recurso"] for item in atividade])
        self.assertEqual(atividade[0]["recurso"], "Produto")
        self.assertEqual(atividade[0]["ator"], self.user.username)
        for item in atividade:
            with self.subTest(id=item["id"]):
                self.assertEqual(set(item), {"id", "acao", "recurso", "ator", "criado_em"})

    def test_consultas_nao_crescem_por_produto_ou_auditoria(self):
        with CaptureQueriesContext(connection) as consultas_base:
            resposta_base = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta_base.status_code, 200, resposta_base.content)
        self._criar_dez_produtos_e_auditorias()

        with CaptureQueriesContext(connection) as consultas_expandidas:
            resposta_expandida = self.client.get("/api/dashboard/operacao/?data=2026-09-08")

        self.assertEqual(resposta_expandida.status_code, 200, resposta_expandida.content)
        self.assertLessEqual(len(consultas_expandidas), len(consultas_base) + 2)

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
