"""
Testes obrigatórios do Sub-projeto E — Módulo de Operação da Merenda.

Nomes exatos conforme a especificação:
  - test_frequencia_duplicata_bloqueada
  - test_previsao_alerta_reducao
  - test_plano_do_dia_calcula_quantidades
  - test_baixa_producao_atomica_por_item
  - test_endpoint_operacao_rejeita_token_admin
"""

from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.contrib.auth.models import User
from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APIClient, APITestCase

from core.models import (
    Categoria, FatorConsumo, FrequenciaDiaria, Grupo, Movimentacao, PinAcesso,
    OperacaoBaixaProducao, Produto, Turma,
)
from core.operacao import baixa_de_producao, gerar_plano_do_dia
from core.operacao_auth import PERFIL_ALUNO, PERFIL_COZINHA, criar_token
from core.services import calcular_previsao_producao


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _token_aluno(turma="6A", turno="MANHA"):
    return criar_token(PERFIL_ALUNO, turma=turma, turno=turno)


def _token_cozinha():
    return criar_token(PERFIL_COZINHA)


def _client_aluno(turma="6A", turno="MANHA"):
    c = APIClient()
    c.credentials(HTTP_X_OPERACAO_TOKEN=_token_aluno(turma, turno))
    return c


def _client_cozinha():
    c = APIClient()
    c.credentials(HTTP_X_OPERACAO_TOKEN=_token_cozinha())
    return c


# ---------------------------------------------------------------------------
# 1. test_frequencia_duplicata_bloqueada
# ---------------------------------------------------------------------------

class TestFrequenciaDuplicataBloqueada(TestCase):
    """
    Constraint única (data, turno, turma) deve rejeitar o segundo registro
    com HTTP 409 e mensagem clara — sem travar o app nem lançar 500.
    """

    def setUp(self):
        self.hoje = timezone.localdate()
        self.client = _client_aluno()

    def test_frequencia_duplicata_bloqueada(self):
        """Segundo POST idêntico retorna 409 com mensagem de frequência já registrada."""
        payload = {"quantidade_alunos": 30, "data": self.hoje.isoformat()}

        # Primeiro registro — deve criar com 201
        r1 = self.client.post("/api/operacao/contagem/", payload, format="json")
        self.assertEqual(r1.status_code, 201, r1.content)

        # Segundo registro igual — deve receber 409
        r2 = self.client.post("/api/operacao/contagem/", payload, format="json")
        self.assertEqual(r2.status_code, 409, r2.content)
        self.assertIn("Frequência já registrada", r2.data["detail"])

    def test_frequencia_duplicata_model_levanta_integrity_error(self):
        """A constraint do modelo levanta IntegrityError diretamente."""
        from django.db import IntegrityError
        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="MANHA", turma="6A", quantidade_alunos=30
        )
        with self.assertRaises(IntegrityError):
            FrequenciaDiaria.objects.create(
                data=self.hoje, turno="MANHA", turma="6A", quantidade_alunos=25
            )

    def test_turmas_diferentes_mesma_data_aceitas(self):
        """Duas turmas diferentes no mesmo dia/turno são permitidas."""
        client_6b = _client_aluno(turma="6B", turno="MANHA")

        r1 = self.client.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        r2 = client_6b.post("/api/operacao/contagem/", {"quantidade_alunos": 28}, format="json")
        self.assertEqual(r1.status_code, 201, r1.content)
        self.assertEqual(r2.status_code, 201, r2.content)


# ---------------------------------------------------------------------------
# 2. test_previsao_alerta_reducao
# ---------------------------------------------------------------------------

class TestPrevisaoAlertaReducao(TestCase):
    """
    alerta_reducao deve ser True quando o total do dia for menor que 50 %
    da média histórica dos últimos 30 dias.
    """

    def setUp(self):
        self.hoje = timezone.localdate()

    def _freq(self, data, turno, turma, qtd):
        FrequenciaDiaria.objects.create(
            data=data, turno=turno, turma=turma, quantidade_alunos=qtd
        )

    def test_previsao_alerta_reducao(self):
        # Histórico: 100 alunos por dia nos últimos 5 dias → média = 100
        for i in range(1, 6):
            self._freq(self.hoje - timedelta(days=i), "MANHA", "Total", 100)

        # Hoje: 40 alunos (< 50 % de 100)
        self._freq(self.hoje, "MANHA", "Total", 40)

        prev = calcular_previsao_producao(self.hoje, "MANHA")
        self.assertTrue(prev["alerta_reducao"])
        self.assertEqual(prev["total_alunos"], 40)

    def test_sem_alerta_quando_frequencia_normal(self):
        for i in range(1, 6):
            self._freq(self.hoje - timedelta(days=i), "MANHA", "Total", 100)
        self._freq(self.hoje, "MANHA", "Total", 90)  # 90 % — sem alerta

        prev = calcular_previsao_producao(self.hoje, "MANHA")
        self.assertFalse(prev["alerta_reducao"])

    def test_sem_historico_nao_alerta(self):
        """Sem histórico, media=0; não deve disparar alerta."""
        self._freq(self.hoje, "MANHA", "Total", 1)
        prev = calcular_previsao_producao(self.hoje, "MANHA")
        self.assertFalse(prev["alerta_reducao"])


# ---------------------------------------------------------------------------
# 3. test_plano_do_dia_calcula_quantidades
# ---------------------------------------------------------------------------

class TestPlanoDoDiaCalculaQuantidades(TestCase):
    """
    gerar_plano_do_dia deve calcular:
      quantidade_necessaria = gramas_por_aluno × total_alunos / 1000  (para KG)
    e sinalizar estoque_insuficiente quando saldo < quantidade_necessaria.
    """

    def setUp(self):
        self.hoje = timezone.localdate()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)

        self.arroz = Produto.objects.create(
            nome="Arroz", grupo=grupo, unidade="KG", quantidade=Decimal("50")
        )
        FatorConsumo.objects.create(produto=self.arroz, gramas_por_aluno=Decimal("80"))

        # Produto com estoque insuficiente
        self.feijao = Produto.objects.create(
            nome="Feijão", grupo=grupo, unidade="KG", quantidade=Decimal("1")
        )
        FatorConsumo.objects.create(produto=self.feijao, gramas_por_aluno=Decimal("60"))

        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="INTEGRAL", turma="Total", quantidade_alunos=100
        )

    def test_plano_do_dia_calcula_quantidades(self):
        plano = gerar_plano_do_dia(data=self.hoje, turno="INTEGRAL")

        self.assertEqual(plano["total_alunos"], 100)
        self.assertEqual(len(plano["itens"]), 2)

        por_nome = {i["produto_nome"]: i for i in plano["itens"]}

        # Arroz: 80g × 100 / 1000 = 8 kg, saldo=50 → suficiente
        self.assertEqual(por_nome["Arroz"]["quantidade"], "8.000")
        self.assertFalse(por_nome["Arroz"]["estoque_insuficiente"])

        # Feijão: 60g × 100 / 1000 = 6 kg, saldo=1 → insuficiente
        self.assertEqual(por_nome["Feijão"]["quantidade"], "6.000")
        self.assertTrue(por_nome["Feijão"]["estoque_insuficiente"])

    def test_plano_sem_frequencia_retorna_zero_itens(self):
        """Sem frequência registrada, quantidade=0 e itens são omitidos."""
        amanha = self.hoje + timedelta(days=1)
        plano = gerar_plano_do_dia(data=amanha, turno="INTEGRAL")
        self.assertEqual(plano["total_alunos"], 0)
        self.assertEqual(len(plano["itens"]), 0)

    def test_plano_via_api(self):
        client = _client_cozinha()
        resp = client.get(
            f"/api/operacao/plano-do-dia/?data={self.hoje.isoformat()}&refeicao=ALMOCO"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["total_alunos"], 100)


# ---------------------------------------------------------------------------
# 4. test_baixa_producao_atomica_por_item
# ---------------------------------------------------------------------------

class TestBaixaProducaoAtomicaPorItem(TestCase):
    """
    Falha em um item não deve cancelar as saídas já processadas.
    Cada item é baixado em sua própria transação atômica.
    """

    def setUp(self):
        self.hoje = timezone.localdate()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)

        # Arroz: saldo suficiente (100g × 100 = 10 kg, saldo=50)
        self.arroz = Produto.objects.create(
            nome="Arroz", grupo=grupo, unidade="KG", quantidade=Decimal("50")
        )
        FatorConsumo.objects.create(produto=self.arroz, gramas_por_aluno=Decimal("100"))

        # Feijão: saldo INSUFICIENTE (60g × 100 = 6 kg, saldo=1)
        self.feijao = Produto.objects.create(
            nome="Feijão", grupo=grupo, unidade="KG", quantidade=Decimal("1")
        )
        FatorConsumo.objects.create(produto=self.feijao, gramas_por_aluno=Decimal("60"))

        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="INTEGRAL", turma="Total", quantidade_alunos=100
        )

    def test_baixa_producao_atomica_por_item(self):
        resultado = baixa_de_producao(data=self.hoje, turno="INTEGRAL")

        # Um sucesso (Arroz) e uma falha (Feijão)
        self.assertEqual(resultado["sucesso"], 1, resultado)
        self.assertEqual(resultado["falhas"], 1, resultado)

        # Arroz foi baixado: 50 - 10 = 40
        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.quantidade, Decimal("40.000"))

        # Feijão não foi alterado
        self.feijao.refresh_from_db()
        self.assertEqual(self.feijao.quantidade, Decimal("1.000"))

        # Apenas 1 movimentação de consumo no banco
        self.assertEqual(Movimentacao.objects.filter(motivo="consumo").count(), 1)

    def test_baixa_via_api(self):
        client = _client_cozinha()
        resp = client.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": str(uuid4()),
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["sucesso"], 1)
        self.assertEqual(resp.data["falhas"], 1)

    def test_repetir_operacao_nao_duplica_movimentacoes(self):
        client = _client_cozinha()
        operacao_id = str(uuid4())
        payload = {
            "operacao_id": operacao_id,
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }

        primeira = client.post("/api/operacao/baixa-de-producao/", payload, format="json")
        saldo_apos_primeira = Produto.objects.get(pk=self.arroz.pk).quantidade
        segunda = client.post("/api/operacao/baixa-de-producao/", payload, format="json")

        self.assertEqual(primeira.status_code, 200, primeira.content)
        self.assertEqual(segunda.status_code, 200, segunda.content)
        self.assertFalse(primeira.data["repetida"])
        self.assertTrue(segunda.data["repetida"])
        self.assertEqual(Produto.objects.get(pk=self.arroz.pk).quantidade, saldo_apos_primeira)
        self.assertEqual(Movimentacao.objects.filter(motivo="consumo").count(), 1)
        self.assertEqual(OperacaoBaixaProducao.objects.count(), 1)

    def test_resultado_anterior_pode_ser_consultado(self):
        client = _client_cozinha()
        operacao_id = str(uuid4())
        payload = {
            "operacao_id": operacao_id,
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }
        client.post("/api/operacao/baixa-de-producao/", payload, format="json")

        consulta = client.get(
            f"/api/operacao/baixa-de-producao/?operacao_id={operacao_id}"
        )

        self.assertEqual(consulta.status_code, 200, consulta.content)
        self.assertTrue(consulta.data["consultada"])
        self.assertEqual(consulta.data["operacao_id"], operacao_id)

    def test_operacao_id_nao_pode_ser_reutilizado_em_outra_refeicao(self):
        client = _client_cozinha()
        operacao_id = str(uuid4())
        client.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": operacao_id,
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }, format="json")

        conflito = client.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": operacao_id,
            "data": self.hoje.isoformat(),
            "refeicao": "LANCHE_TARDE",
        }, format="json")

        self.assertEqual(conflito.status_code, 409, conflito.content)
        self.assertEqual(conflito.data["codigo"], "operacao_id_reutilizado")

    def test_tres_refeicoes_sao_permitidas_e_quarta_repetida_e_bloqueada(self):
        self.arroz.quantidade = Decimal("35")
        self.arroz.save(update_fields=["quantidade"])
        client = _client_cozinha()

        for refeicao in ("CAFE_MANHA", "ALMOCO", "LANCHE_TARDE"):
            resposta = client.post("/api/operacao/baixa-de-producao/", {
                "operacao_id": str(uuid4()),
                "data": self.hoje.isoformat(),
                "refeicao": refeicao,
            }, format="json")
            self.assertEqual(resposta.status_code, 200, resposta.content)

        repetida = client.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": str(uuid4()),
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }, format="json")

        self.arroz.refresh_from_db()
        self.assertEqual(self.arroz.quantidade, Decimal("5.000"))
        self.assertGreaterEqual(self.arroz.quantidade, Decimal("0"))
        self.assertEqual(repetida.status_code, 409, repetida.content)
        self.assertEqual(repetida.data["codigo"], "refeicao_ja_baixada")
        self.assertEqual(
            Movimentacao.objects.filter(produto=self.arroz, motivo="consumo").count(),
            3,
        )

    def test_payload_invalido_e_data_historica_sao_rejeitados(self):
        client = _client_cozinha()
        sem_identificador = client.post("/api/operacao/baixa-de-producao/", {
            "data": self.hoje.isoformat(),
            "refeicao": "ALMOCO",
        }, format="json")
        data_historica = client.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": str(uuid4()),
            "data": (self.hoje - timedelta(days=1)).isoformat(),
            "refeicao": "ALMOCO",
        }, format="json")

        self.assertEqual(sem_identificador.status_code, 400, sem_identificador.content)
        self.assertEqual(sem_identificador.data["codigo"], "payload_invalido")
        self.assertIn("operacao_id", sem_identificador.data["campos"])
        self.assertEqual(data_historica.status_code, 400, data_historica.content)
        self.assertIn("data", data_historica.data["campos"])

    def test_resultado_lista_erros_individualmente(self):
        resultado = baixa_de_producao(data=self.hoje, turno="INTEGRAL")
        falhas = [r for r in resultado["resultados"] if not r["ok"]]
        self.assertEqual(len(falhas), 1)
        self.assertIn("Feijão", falhas[0]["produto_nome"])
        self.assertIn("erro", falhas[0])


# ---------------------------------------------------------------------------
# 5. test_endpoint_operacao_rejeita_token_admin
# ---------------------------------------------------------------------------

class TestEndpointOperacaoRejeitaTokenAdmin(APITestCase):
    """
    Um usuário Django autenticado (admin) deve receber HTTP 403 em todos
    os endpoints /api/operacao/* que exigem perfil operacional.
    """

    def setUp(self):
        self.hoje = timezone.localdate()
        self.admin = User.objects.create_user(
            username="admin_teste", password="senha123", is_staff=True
        )
        self.client.force_authenticate(user=self.admin)

    def test_endpoint_operacao_rejeita_token_admin_post_contagem(self):
        resp = self.client.post("/api/operacao/contagem/", {
            "turma": "6A", "turno": "MANHA", "quantidade_alunos": 30,
        }, format="json")
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_endpoint_operacao_rejeita_token_admin_get_contagem(self):
        resp = self.client.get(
            f"/api/operacao/contagem/?data={self.hoje.isoformat()}&turno=MANHA"
        )
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_endpoint_operacao_rejeita_token_admin_plano_do_dia(self):
        resp = self.client.get(
            f"/api/operacao/plano-do-dia/?data={self.hoje.isoformat()}&refeicao=ALMOCO"
        )
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_endpoint_operacao_rejeita_token_admin_baixa_producao(self):
        resp = self.client.post("/api/operacao/baixa-de-producao/", {
            "data": self.hoje.isoformat(), "refeicao": "ALMOCO",
        }, format="json")
        self.assertEqual(resp.status_code, 403, resp.content)

    def test_sem_token_retorna_401(self):
        """Request sem autenticação de qualquer tipo recebe 401."""
        anon_client = APIClient()
        resp = anon_client.post("/api/operacao/contagem/", {
            "turma": "6A", "turno": "MANHA", "quantidade_alunos": 30,
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_token_operacao_invalido_retorna_401(self):
        """Token de operação inválido recebe 401."""
        c = APIClient()
        c.credentials(HTTP_X_OPERACAO_TOKEN="token-inexistente")
        resp = c.post("/api/operacao/contagem/", {
            "turma": "6A", "turno": "MANHA", "quantidade_alunos": 30,
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)


# ---------------------------------------------------------------------------
# Testes de login por PIN
# ---------------------------------------------------------------------------

class TestLoginPorPin(APITestCase):
    def setUp(self):
        # Nomes "Teste" para não colidir com as 12 turmas reais semeadas
        # pela migração core.0014_seed_turmas.
        self.turma = Turma.objects.create(nome="1º DS-A (Teste)", curso=Turma.DS, ano=1)
        self.turma_b = Turma.objects.create(nome="1º DS-B (Teste)", curso=Turma.DS, ano=1)
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="0001")
        PinAcesso.objects.create(papel=PinAcesso.ALUNO_REP, turma=self.turma, pin="0002")
        PinAcesso.objects.create(papel=PinAcesso.COZINHA, pin="0099")
        PinAcesso.objects.create(
            papel=PinAcesso.ALUNO_REP, turma=self.turma_b, pin="0003", ativo=False
        )

    def test_login_aluno_pin_valido(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertIn("token", resp.data)
        self.assertEqual(resp.data["turma"], "1º DS-A (Teste)")
        self.assertEqual(resp.data["turno"], "INTEGRAL")

    def test_login_cozinha_pin_valido(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0099", "perfil": "COZINHA",
        }, format="json")
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["perfil"], "COZINHA")

    def test_login_pin_invalido_retorna_401(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0000", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_rate_limit_bloqueia_sexta_tentativa_invalida(self):
        for tentativa in range(5):
            resp = self.client.post(
                "/api/operacao/auth/",
                {"pin": f"8{tentativa:03d}", "perfil": "ALUNO_REP"},
                format="json",
            )
            self.assertEqual(resp.status_code, 401, resp.content)

        bloqueado = self.client.post(
            "/api/operacao/auth/",
            {"pin": "8999", "perfil": "ALUNO_REP"},
            format="json",
        )
        self.assertEqual(bloqueado.status_code, 429, bloqueado.content)
        self.assertIn("Retry-After", bloqueado.headers)

    def test_login_pin_inativo_retorna_401(self):
        resp = self.client.post("/api/operacao/auth/", {
            "pin": "0003", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_dois_pins_da_mesma_turma_autenticam_com_mesmo_nome(self):
        r1 = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        r2 = self.client.post("/api/operacao/auth/", {
            "pin": "0002", "perfil": "ALUNO_REP",
        }, format="json")
        self.assertEqual(r1.data["turma"], r2.data["turma"])

        # Regressão: o segundo aluno da mesma turma que tentar registrar
        # a contagem do mesmo turno/dia deve receber 409, não um novo registro.
        c1 = APIClient()
        c1.credentials(HTTP_X_OPERACAO_TOKEN=r1.data["token"])
        c2 = APIClient()
        c2.credentials(HTTP_X_OPERACAO_TOKEN=r2.data["token"])

        resp1 = c1.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        resp2 = c2.post("/api/operacao/contagem/", {"quantidade_alunos": 31}, format="json")
        self.assertEqual(resp1.status_code, 201, resp1.content)
        self.assertEqual(resp2.status_code, 409, resp2.content)

    def test_logout_invalida_token(self):
        r_login = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        token = r_login.data["token"]

        c = APIClient()
        c.credentials(HTTP_X_OPERACAO_TOKEN=token)
        c.delete("/api/operacao/auth/logout/")

        resp = c.post("/api/operacao/contagem/", {"quantidade_alunos": 30}, format="json")
        self.assertEqual(resp.status_code, 401, resp.content)

    def test_desativar_ou_trocar_pin_revoga_sessao_existente(self):
        login = self.client.post("/api/operacao/auth/", {
            "pin": "0001", "perfil": "ALUNO_REP",
        }, format="json")
        cliente = APIClient()
        cliente.credentials(HTTP_X_OPERACAO_TOKEN=login.data["token"])

        pin = PinAcesso.objects.get(turma=self.turma, pin_fingerprint=PinAcesso.gerar_fingerprint("0001"))
        pin.definir_pin("0004")
        pin.save(update_fields=["pin", "pin_fingerprint"])

        resposta = cliente.get("/api/operacao/status-do-dia/")
        self.assertEqual(resposta.status_code, 401, resposta.content)

        novo_login = self.client.post("/api/operacao/auth/", {
            "pin": "0004", "perfil": "ALUNO_REP",
        }, format="json")
        novo_cliente = APIClient()
        novo_cliente.credentials(HTTP_X_OPERACAO_TOKEN=novo_login.data["token"])
        pin.ativo = False
        pin.save(update_fields=["ativo"])

        revogada = novo_cliente.get("/api/operacao/status-do-dia/")
        self.assertEqual(revogada.status_code, 401, revogada.content)


# ---------------------------------------------------------------------------
# GET /api/operacao/contagem/ — acessível pelo app-cozinha
# ---------------------------------------------------------------------------

class TestGetContagemAppCozinha(APITestCase):

    def setUp(self):
        self.hoje = timezone.localdate()
        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="MANHA", turma="6A", quantidade_alunos=30
        )
        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="MANHA", turma="7B", quantidade_alunos=25
        )

    def test_get_contagem_retorna_total(self):
        client = _client_cozinha()
        resp = client.get(
            f"/api/operacao/contagem/?data={self.hoje.isoformat()}&turno=MANHA"
        )
        self.assertEqual(resp.status_code, 200, resp.content)
        self.assertEqual(resp.data["total_alunos"], 55)
        self.assertEqual(len(resp.data["turmas"]), 2)


class TestStatusOperacionalDoDia(APITestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        self.turma = Turma.objects.create(
            nome="Turma Status Teste",
            curso=Turma.DS,
            ano=1,
        )

    def _cliente_aluno(self):
        token = criar_token(
            PERFIL_ALUNO,
            turma=self.turma.nome,
            turno=self.turma.turno,
            turma_id=self.turma.id,
        )
        cliente = APIClient()
        cliente.credentials(HTTP_X_OPERACAO_TOKEN=token)
        return cliente

    def test_aluno_recupera_frequencia_ja_registrada(self):
        FrequenciaDiaria.objects.create(
            data=self.hoje - timedelta(days=1),
            turno=FrequenciaDiaria.INTEGRAL,
            turma=self.turma.nome,
            quantidade_alunos=31,
        )
        frequencia = FrequenciaDiaria.objects.create(
            data=self.hoje,
            turno=FrequenciaDiaria.INTEGRAL,
            turma=self.turma.nome,
            quantidade_alunos=28,
        )

        resposta = self._cliente_aluno().get("/api/operacao/status-do-dia/")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertTrue(resposta.data["frequencia_registrada"])
        self.assertEqual(resposta.data["frequencia"]["id"], frequencia.id)
        self.assertEqual(resposta.data["frequencia"]["quantidade_alunos"], 28)
        self.assertIn("sincronizado_em", resposta.data)
        self.assertEqual(len(resposta.data["historico_recente"]), 2)
        self.assertEqual(resposta.data["historico_recente"][0]["quantidade_alunos"], 28)

    def test_sessao_reflete_renome_e_bloqueia_turma_desativada(self):
        cliente = self._cliente_aluno()
        self.turma.nome = "Turma Status Renomeada"
        self.turma.save(update_fields=["nome"])

        renomeada = cliente.get("/api/operacao/status-do-dia/")
        self.assertEqual(renomeada.status_code, 200, renomeada.content)
        self.assertEqual(renomeada.data["turma"], "Turma Status Renomeada")

        self.turma.ativo = False
        self.turma.save(update_fields=["ativo"])
        inativa = cliente.get("/api/operacao/status-do-dia/")
        self.assertEqual(inativa.status_code, 403, inativa.content)
        self.assertEqual(inativa.data["codigo"], "turma_inativa")

    def test_cozinha_recebe_estado_das_tres_refeicoes(self):
        OperacaoBaixaProducao.objects.create(
            operacao_id=uuid4(),
            data=self.hoje,
            refeicao=OperacaoBaixaProducao.CAFE_MANHA,
            status=OperacaoBaixaProducao.CONCLUIDA,
        )

        resposta = _client_cozinha().get("/api/operacao/status-do-dia/")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(len(resposta.data["refeicoes"]), 3)
        por_refeicao = {item["refeicao"]: item for item in resposta.data["refeicoes"]}
        self.assertTrue(por_refeicao["CAFE_MANHA"]["baixa_realizada"])
        self.assertFalse(por_refeicao["ALMOCO"]["baixa_realizada"])
        self.assertFalse(por_refeicao["LANCHE_TARDE"]["baixa_realizada"])
        self.assertEqual(len(resposta.data["historico_recente"]), 1)
        self.assertEqual(resposta.data["historico_recente"][0]["refeicao"], "CAFE_MANHA")


class TestHealthCheck(APITestCase):
    def test_health_confirma_banco_e_cache_sem_autenticacao(self):
        resposta = self.client.get("/api/health/")

        self.assertEqual(resposta.status_code, 200, resposta.content)
        self.assertEqual(resposta.data["status"], "ok")
        self.assertEqual(resposta.data["verificacoes"], {"banco": True, "cache": True})
        self.assertIn("verificado_em", resposta.data)
