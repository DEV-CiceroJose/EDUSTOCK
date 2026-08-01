from datetime import timedelta
from decimal import Decimal
from uuid import uuid4

from django.test import TestCase
from django.utils import timezone
from rest_framework.test import APITestCase, APIClient

from core.models import Categoria, FrequenciaDiaria, FatorConsumo, Grupo, Produto
from core.operacao import baixa_de_producao, gerar_plano_do_dia
from core.services import calcular_previsao_producao, registrar_movimentacao
from core.models import Movimentacao


class FrequenciaServiceTest(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()

    def _freq(self, data, turno, turma, qtd):
        FrequenciaDiaria.objects.create(
            data=data, turno=turno, turma=turma, quantidade_alunos=qtd
        )

    def test_previsao_soma_turno(self):
        self._freq(self.hoje, "MANHA", "6A", 30)
        self._freq(self.hoje, "MANHA", "7B", 25)
        prev = calcular_previsao_producao(self.hoje, "MANHA")
        self.assertEqual(prev["total_alunos"], 55)

    def test_alerta_reducao(self):
        for i in range(5):
            d = self.hoje - timedelta(days=i + 1)
            self._freq(d, "MANHA", "Total", 100)
        self._freq(self.hoje, "MANHA", "Total", 40)
        prev = calcular_previsao_producao(self.hoje, "MANHA")
        self.assertTrue(prev["alerta_reducao"])

    def test_duplicata_model(self):
        self._freq(self.hoje, "MANHA", "6A", 10)
        from django.db import IntegrityError
        with self.assertRaises(IntegrityError):
            self._freq(self.hoje, "MANHA", "6A", 20)


class PlanoProducaoTest(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.arroz = Produto.objects.create(
            nome="Arroz", grupo=grupo, unidade="KG", quantidade=Decimal("50"),
        )
        FatorConsumo.objects.create(produto=self.arroz, gramas_por_aluno=Decimal("80"))
        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="MANHA", turma="Total", quantidade_alunos=100
        )

    def test_plano_calcula_kg(self):
        plano = gerar_plano_do_dia(data=self.hoje, turno="MANHA")
        self.assertEqual(len(plano["itens"]), 1)
        item = plano["itens"][0]
        # 80g * 100 / 1000 = 8 kg
        self.assertEqual(item["quantidade"], "8.000")
        self.assertFalse(item["estoque_insuficiente"])

    def test_estoque_insuficiente(self):
        self.arroz.quantidade = Decimal("1")
        self.arroz.save()
        plano = gerar_plano_do_dia(data=self.hoje, turno="MANHA")
        self.assertTrue(plano["itens"][0]["estoque_insuficiente"])


class BaixaProducaoTest(TestCase):
    def setUp(self):
        self.hoje = timezone.localdate()
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        self.arroz = Produto.objects.create(
            nome="Arroz", grupo=grupo, unidade="KG", quantidade=Decimal("50"),
        )
        self.feijao = Produto.objects.create(
            nome="Feijão", grupo=grupo, unidade="KG", quantidade=Decimal("1"),
        )
        FatorConsumo.objects.create(produto=self.arroz, gramas_por_aluno=Decimal("80"))
        FatorConsumo.objects.create(produto=self.feijao, gramas_por_aluno=Decimal("50"))
        FrequenciaDiaria.objects.create(
            data=self.hoje, turno="MANHA", turma="Total", quantidade_alunos=100
        )

    def test_baixa_parcial_nao_aborta(self):
        resultado = baixa_de_producao(data=self.hoje, turno="MANHA")
        self.assertEqual(resultado["sucesso"], 1)
        self.assertEqual(resultado["falhas"], 1)
        self.arroz.refresh_from_db()
        self.feijao.refresh_from_db()
        self.assertEqual(self.arroz.quantidade, Decimal("42.000"))
        self.assertEqual(self.feijao.quantidade, Decimal("1.000"))
        self.assertEqual(Movimentacao.objects.filter(motivo="consumo").count(), 1)


class ContagemApiTest(APITestCase):
    def setUp(self):
        # Cria tokens de operação para os testes de API
        from core.operacao_auth import criar_token, PERFIL_ALUNO, PERFIL_COZINHA
        self.client_aluno = APIClient()
        self.client_aluno.credentials(
            HTTP_X_OPERACAO_TOKEN=criar_token(PERFIL_ALUNO, turma="6A", turno="MANHA")
        )
        self.client_cozinha = APIClient()
        self.client_cozinha.credentials(
            HTTP_X_OPERACAO_TOKEN=criar_token(PERFIL_COZINHA)
        )

    def test_cria_contagem_valida(self):
        resp = self.client_aluno.post("/api/operacao/contagem/", {
            "quantidade_alunos": 32,
        }, format="json")
        self.assertEqual(resp.status_code, 201, resp.content)
        self.assertEqual(resp.data["previsao"]["total_alunos"], 32)

    def test_duplicata_retorna_409(self):
        payload = {"quantidade_alunos": 32}
        self.client_aluno.post("/api/operacao/contagem/", payload, format="json")
        resp = self.client_aluno.post("/api/operacao/contagem/", payload, format="json")
        self.assertEqual(resp.status_code, 409)
        self.assertIn("Frequência já registrada", resp.data["detail"])
        self.assertEqual(resp.data["codigo"], "frequencia_duplicada")

    def test_rejeita_quantidade_acima_do_limite(self):
        resp = self.client_aluno.post("/api/operacao/contagem/", {
            "quantidade_alunos": 46,
        }, format="json")

        self.assertEqual(resp.status_code, 400, resp.content)
        self.assertIn("entre 1 e 45", resp.data["detail"])

    def test_resumo_dia(self):
        from django.contrib.auth.models import User
        from core.operacao_auth import criar_token, PERFIL_ALUNO
        from plataforma.models import Perfil, TokenAcesso

        client_7b = APIClient()
        client_7b.credentials(
            HTTP_X_OPERACAO_TOKEN=criar_token(PERFIL_ALUNO, turma="7B", turno="TARDE")
        )
        self.client_aluno.post("/api/operacao/contagem/", {
            "quantidade_alunos": 30,
        }, format="json")
        client_7b.post("/api/operacao/contagem/", {
            "quantidade_alunos": 20,
        }, format="json")
        self.assertEqual(
            self.client.get("/api/operacao/resumo/").status_code,
            401,
        )

        user = User.objects.create_user(username="admin-resumo", password="x")
        Perfil.objects.create(user=user, papel=Perfil.ADMIN)
        token = TokenAcesso.objects.create(
            user=user,
            expira_em=timezone.now() + timedelta(hours=1),
        )
        client_admin = APIClient()
        client_admin.credentials(HTTP_AUTHORIZATION=f"Token {token.token}")
        resp = client_admin.get("/api/operacao/resumo/")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["total_alunos"], 50)

    def test_plano_do_dia(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p = Produto.objects.create(nome="Arroz", grupo=grupo, unidade="KG", quantidade=10)
        FatorConsumo.objects.create(produto=p, gramas_por_aluno=Decimal("100"))
        hoje = timezone.localdate().isoformat()
        self.client_aluno.post("/api/operacao/contagem/", {
            "quantidade_alunos": 40,
        }, format="json")
        resp = self.client_cozinha.get(f"/api/operacao/plano-do-dia/?data={hoje}&turno=MANHA")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(len(resp.data["itens"]), 1)

    def test_baixa_producao_api(self):
        cat = Categoria.objects.create(name="Alimentos")
        grupo = Grupo.objects.create(nome="Geral", categoria=cat)
        p = Produto.objects.create(nome="Arroz", grupo=grupo, unidade="KG", quantidade=Decimal("20"))
        FatorConsumo.objects.create(produto=p, gramas_por_aluno=Decimal("100"))
        hoje = timezone.localdate().isoformat()
        self.client_aluno.post("/api/operacao/contagem/", {
            "quantidade_alunos": 40,
        }, format="json")
        resp = self.client_cozinha.post("/api/operacao/baixa-de-producao/", {
            "operacao_id": str(uuid4()), "data": hoje, "turno": "MANHA",
        }, format="json")
        self.assertEqual(resp.status_code, 200)
        self.assertEqual(resp.data["sucesso"], 1)
        p.refresh_from_db()
        self.assertEqual(p.quantidade, Decimal("16.000"))
